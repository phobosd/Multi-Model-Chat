import type { ModelConfig } from '@/store/settingsStore';
import type { Message } from '@/store/chatStore';

const API_BASE = '/api';

export async function* sendMessage(
    messages: Message[],
    model: ModelConfig
): AsyncGenerator<string, void, unknown> {
    // We send everything to our backend proxy
    const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages,
            model
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${response.status} - ${JSON.stringify(error)}`);
    }

    if (!response.body) throw new Error('No response body');

    // Handle streaming for OpenAI/Custom/EXO
    if (model.provider === 'openai' || model.provider === 'custom' || model.provider === 'exo') {
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
    } else {
        // For Gemini (non-streaming in our current proxy implementation)
        const data = await response.json();
        yield data.text || '';
    }
}

export async function fetchModels(config: { provider: string, apiKey?: string, baseUrl?: string }): Promise<string[]> {
    try {
        const response = await fetch(`${API_BASE}/models`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(config),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.statusText}`);
        }

        const data = await response.json();

        if (config.provider === 'gemini') {
            if (data.models && Array.isArray(data.models)) {
                return data.models.map((m: any) => m.name.replace('models/', ''));
            }
        } else {
            if (data.data && Array.isArray(data.data)) {
                return data.data.map((m: any) => m.id);
            }
        }

        return [];
    } catch (error) {
        console.error('Error fetching models:', error);
        throw error;
    }
}
