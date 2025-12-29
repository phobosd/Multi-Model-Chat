import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModelConfig {
    id: string;
    name: string;
    provider: 'openai' | 'gemini' | 'custom' | 'exo';
    enabled: boolean;
    apiKey?: string;
    baseUrl?: string; // For custom/local models
    modelId?: string; // specific model string e.g. 'gpt-4'
}

interface SettingsState {
    models: ModelConfig[];
    addModel: (model: ModelConfig) => void;
    updateModel: (id: string, updates: Partial<ModelConfig>) => void;
    removeModel: (id: string) => void;
    isOpen: boolean;
    toggleSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            models: [
                { id: 'gpt-4', name: 'GPT-4 Turbo', provider: 'openai', enabled: true, modelId: 'gpt-4-turbo' },
                { id: 'gemini-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', enabled: true, modelId: 'gemini-1.5-flash' },
            ],
            isOpen: false,
            addModel: (model) => set((state) => ({ models: [...state.models, model] })),
            updateModel: (id, updates) => set((state) => ({
                models: state.models.map((m) => (m.id === id ? { ...m, ...updates } : m)),
            })),
            removeModel: (id) => set((state) => ({ models: state.models.filter((m) => m.id !== id) })),
            toggleSettings: () => set((state) => ({ isOpen: !state.isOpen })),
        }),
        {
            name: 'settings-storage',
        }
    )
);
