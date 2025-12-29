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

export interface ExoActiveModel {
    id: string;
    modelId: string;
}

export async function fetchExoActiveModels(config: { baseUrl: string, apiKey?: string }): Promise<ExoActiveModel[]> {
    try {
        const response = await fetch(`${API_BASE}/exo/state`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(config),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch EXO state: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[EXO] State Data:', data);

        const activeModels: ExoActiveModel[] = [];

        if (data.instances && typeof data.instances === 'object') {
            Object.entries(data.instances).forEach(([id, inst]: [string, any]) => {
                let modelId = '';
                // 1. Try direct model_id
                if (inst.model_id) modelId = inst.model_id;

                // 2. Try nested strategy instances
                if (!modelId) {
                    Object.values(inst).forEach((strategyInst: any) => {
                        if (strategyInst?.shardAssignments?.modelId) {
                            modelId = strategyInst.shardAssignments.modelId;
                        } else if (strategyInst?.modelId) {
                            modelId = strategyInst.modelId;
                        }
                    });
                }

                // 3. Try inst.model.name or similar
                if (!modelId && inst.model?.name) modelId = inst.model.name;
                if (!modelId && inst.model?.model_id) modelId = inst.model.model_id;

                if (modelId) {
                    activeModels.push({ id, modelId });
                }
            });
        }

        console.log('[EXO] Parsed Active Models:', activeModels);
        return activeModels;
    } catch (error) {
        console.error('Error fetching EXO active models:', error);
        throw error;
    }
}

export async function loadExoModel(config: { baseUrl: string, apiKey?: string, modelId: string }): Promise<void> {
    try {
        console.log(`[EXO] Requesting previews for: ${config.modelId}`);
        // 1. Get previews
        const previewRes = await fetch(`${API_BASE}/exo/instance/previews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                modelId: config.modelId
            }),
        });

        if (!previewRes.ok) {
            const err = await previewRes.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `Failed to fetch previews (${previewRes.status})`);
        }

        const data = await previewRes.json();
        console.log('[EXO] Preview Data:', data);

        // Handle different possible response formats
        let previews = [];
        if (Array.isArray(data)) {
            previews = data;
        } else if (data && Array.isArray(data.previews)) {
            previews = data.previews;
        } else if (data && data.instance) {
            // If it returns a single preview object
            previews = [data];
        }

        if (previews.length === 0) {
            throw new Error('No valid placements found for this model on the cluster. Ensure your nodes have enough VRAM.');
        }

        // 2. Use the first preview to create the instance
        const firstPreview = previews[0];
        if (!firstPreview || !firstPreview.instance) {
            console.error('[EXO] Invalid preview structure:', firstPreview);
            throw new Error('Received an invalid preview structure from the cluster.');
        }

        const instanceConfig = firstPreview.instance;
        console.log('[EXO] Creating instance with config:', instanceConfig);

        const createRes = await fetch(`${API_BASE}/exo/instance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                instanceConfig
            }),
        });

        if (!createRes.ok) {
            const err = await createRes.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `Failed to create instance (${createRes.status})`);
        }
        console.log('[EXO] Instance created successfully');
    } catch (error) {
        console.error('Error loading EXO model:', error);
        throw error;
    }
}

export async function unloadExoModel(config: { baseUrl: string, apiKey?: string, instanceId: string }): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/exo/instance/${config.instanceId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || `Failed to unload instance (${response.status})`);
        }
    } catch (error) {
        console.error('Error unloading EXO model:', error);
        throw error;
    }
}
