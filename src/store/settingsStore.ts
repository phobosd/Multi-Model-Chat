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
                {
                    id: 'exo-qwen-30b',
                    name: 'EXO Cluster',
                    provider: 'exo',
                    enabled: true,
                    baseUrl: 'http://10.244.250.55:8000/v1',
                    modelId: 'mlx-community/Qwen3-30B-A3B-4bit'
                },
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
