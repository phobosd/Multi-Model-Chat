import type { ModelConfig } from '@/store/settingsStore';
import type { Message } from '@/store/chatStore';

interface GeminiPart {
    text?: string;
    inline_data?: {
        mime_type: string;
        data: string;
    };
}

interface GeminiContent {
    role: string;
    parts: GeminiPart[];
}

export async function* sendMessage(
    messages: Message[],
    model: ModelConfig
): AsyncGenerator<string, void, unknown> {
    const { provider, apiKey, baseUrl, modelId } = model;

    // Prepare messages for API
    const apiMessages = messages.map(m => {
        let content: string | unknown[] | object = m.content;

        // Safety check for corrupted data in store
        if (typeof content !== 'string') {
            if (Array.isArray(content)) {
                // If it's already an array, we assume it's valid content parts
                // But we might want to ensure it's not nested incorrectly if we are adding attachments
            } else if (typeof content === 'object' && content !== null) {
                // If it's an object (and not array), it's likely corrupted data like {text: "..."}
                // We extract text or stringify
                const objContent = content as Record<string, unknown>;
                content = (objContent.text as string) || (objContent.content as string) || JSON.stringify(content);
            } else {
                content = String(content || '');
            }
        }

        if (m.attachments && m.attachments.length > 0) {
            // If there are attachments, we need to format content as array
            // If content is already an array, we should probably append to it or handle it carefully
            // For now, assuming if attachments exist, we construct a new array
            const textContent = typeof content === 'string' ? content : JSON.stringify(content);
            const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [{ type: 'text', text: textContent }];
            m.attachments.forEach(att => {
                parts.push({
                    type: 'image_url',
                    image_url: { url: att }
                });
            });
            return { role: m.role, content: parts };
        }

        // If content is an array (from previous check), pass it through, otherwise pass string
        return { role: m.role, content };
    });

    if (provider === 'openai' || provider === 'custom') {
        let url = '';
        if (provider === 'custom') {
            const cleanBaseUrl = baseUrl?.replace(/\/$/, '') || '';
            const finalBaseUrl = cleanBaseUrl.endsWith('/v1') ? cleanBaseUrl : `${cleanBaseUrl}/v1`;
            url = `${finalBaseUrl}/chat/completions`;
        } else {
            url = 'https://api.openai.com/v1/chat/completions';
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const body = {
            model: modelId || (provider === 'openai' ? 'gpt-4-turbo-preview' : 'gpt-3.5-turbo'),
            messages: apiMessages,
            stream: true,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${response.status} - ${JSON.stringify(error)}`);
        }

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) yield content;
                } catch (e) {
                    console.warn('Failed to parse SSE message', e);
                }
            }
        }
    } else if (provider === 'gemini') {
        if (!apiKey) throw new Error('API Key required for Gemini');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId || 'gemini-pro'}:generateContent?key=${apiKey}`;

        const contents: GeminiContent[] = messages.map(m => {
            const parts: GeminiPart[] = [{ text: m.content }];
            if (m.attachments) {
                m.attachments.forEach(att => {
                    const base64Data = att.split(',')[1];
                    const mimeType = att.split(';')[0].split(':')[1];
                    parts.push({
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    });
                });
            }
            return {
                role: m.role === 'user' ? 'user' : 'model',
                parts
            };
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Gemini API Error: ${response.status} - ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        yield text;
    } else {
        throw new Error(`Provider ${provider} not implemented`);
    }
}

export async function fetchModels(config: { provider: string, apiKey?: string, baseUrl?: string }): Promise<string[]> {
    try {
        const { provider, apiKey, baseUrl } = config;
        let url = '';
        const headers: Record<string, string> = {};

        if (provider === 'openai') {
            url = 'https://api.openai.com/v1/models';
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        } else if (provider === 'gemini') {
            if (!apiKey) throw new Error('API Key required for Gemini model discovery');
            url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        } else {
            // Custom
            if (!baseUrl) throw new Error('Base URL required for custom model discovery');
            const cleanBaseUrl = baseUrl.replace(/\/$/, '');
            const finalBaseUrl = cleanBaseUrl.endsWith('/v1') ? cleanBaseUrl : `${cleanBaseUrl}/v1`;
            url = `${finalBaseUrl}/models`;
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.statusText}`);
        }

        const data = await response.json() as { models?: { name: string }[], data?: { id: string }[] };

        if (provider === 'gemini') {
            // Gemini format: { models: [{ name: 'models/gemini-pro', ... }] }
            if (data.models && Array.isArray(data.models)) {
                return data.models.map((m) => m.name.replace('models/', ''));
            }
        } else {
            // OpenAI / Custom format: { data: [{ id: '...' }, ...] }
            if (data.data && Array.isArray(data.data)) {
                return data.data.map((m) => m.id);
            }
        }

        return [];
    } catch (error) {
        console.error('Error fetching models:', error);
        throw error;
    }
}
