import { X, Plus, Trash2, Save, Search } from 'lucide-react';
import { useSettingsStore, type ModelConfig } from '@/store/settingsStore';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function SettingsModal() {
    const { isOpen, toggleSettings, models, addModel, updateModel, removeModel } = useSettingsStore();
    const [activeTab, setActiveTab] = useState<'models' | 'general'>('models');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white">Settings</h2>
                    <button onClick={toggleSettings} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-48 bg-slate-950/50 border-r border-slate-800 p-2 space-y-1">
                        <button
                            onClick={() => setActiveTab('models')}
                            className={cn(
                                "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                activeTab === 'models' ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            Models
                        </button>
                        <button
                            onClick={() => setActiveTab('general')}
                            className={cn(
                                "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                activeTab === 'general' ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            General
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'models' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium text-white">Configured Models</h3>
                                    <button
                                        onClick={() => addModel({
                                            id: `custom-${Date.now()}`,
                                            name: 'New Model',
                                            provider: 'custom',
                                            enabled: true,
                                            baseUrl: 'http://localhost:11434/v1',
                                            modelId: 'llama2'
                                        })}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
                                    >
                                        <Plus size={16} />
                                        Add Custom
                                    </button>
                                    <button
                                        onClick={() => addModel({
                                            id: `exo-${Date.now()}`,
                                            name: 'EXO Model',
                                            provider: 'exo',
                                            enabled: true,
                                            baseUrl: 'http://localhost:52415/v1',
                                            modelId: 'llama3'
                                        })}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm transition-colors"
                                    >
                                        <Plus size={16} />
                                        Add EXO
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {models.map((model) => (
                                        <ModelCard key={model.id} model={model} onUpdate={updateModel} onRemove={removeModel} />
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeTab === 'general' && (
                            <div className="text-slate-400 text-center py-10">
                                General settings coming soon...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ModelCard({ model, onUpdate, onRemove }: {
    model: ModelConfig;
    onUpdate: (id: string, data: Partial<ModelConfig>) => void;
    onRemove: (id: string) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [data, setData] = useState(model);
    const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
    const [isLoadingModel, setIsLoadingModel] = useState<string | null>(null);

    const handleSave = () => {
        onUpdate(model.id, data);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="bg-slate-800/50 border border-blue-500/50 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Name</label>
                        <input
                            value={data.name}
                            onChange={(e) => setData({ ...data, name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Provider</label>
                        <select
                            value={data.provider}
                            onChange={(e) => setData({ ...data, provider: e.target.value as ModelConfig['provider'] })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                        >
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Gemini</option>
                            <option value="exo">EXO</option>
                            <option value="custom">Custom / Local</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-slate-400 mb-1">API Key</label>
                    <input
                        type="password"
                        value={data.apiKey || ''}
                        onChange={(e) => setData({ ...data, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                    />
                </div>

                {(data.provider === 'custom' || data.provider === 'exo') && (
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">
                            {data.provider === 'exo' ? 'EXO Base URL (Default: http://localhost:52415/v1)' : 'Base URL (e.g., http://localhost:1234/v1)'}
                        </label>
                        <div className="flex gap-2">
                            <input
                                value={data.baseUrl || ''}
                                onChange={(e) => setData({ ...data, baseUrl: e.target.value })}
                                placeholder={data.provider === 'exo' ? 'http://localhost:52415/v1' : 'http://localhost:11434/v1'}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                            />
                            <button
                                onClick={async () => {
                                    if (!data.baseUrl) return;
                                    try {
                                        const { fetchModels } = await import('@/services/api');
                                        const models = await fetchModels({
                                            provider: data.provider,
                                            baseUrl: data.baseUrl,
                                            apiKey: data.apiKey
                                        });
                                        if (models.length > 0) {
                                            alert(`Discovered ${models.length} available models: ${models.join(', ')}`);
                                            setDiscoveredModels(models);
                                        } else {
                                            alert('No models found at this endpoint.');
                                        }
                                    } catch (error) {
                                        alert('Failed to fetch models. Check console for details.');
                                        console.error(error);
                                    }
                                }}
                                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs whitespace-nowrap"
                            >
                                Discover All
                            </button>
                            {data.provider === 'exo' && (
                                <button
                                    onClick={async () => {
                                        if (!data.baseUrl) return;
                                        try {
                                            const { fetchExoActiveModels } = await import('@/services/api');
                                            const models = await fetchExoActiveModels({
                                                baseUrl: data.baseUrl,
                                                apiKey: data.apiKey
                                            });
                                            if (models.length > 0) {
                                                alert(`Discovered ${models.length} ACTIVE instances: ${models.join(', ')}`);
                                                setDiscoveredModels(models);
                                            } else {
                                                alert('No active model instances found. You may need to run "exo run <model>" first.');
                                            }
                                        } catch (error) {
                                            alert('Failed to fetch active models. Check console for details.');
                                            console.error(error);
                                        }
                                    }}
                                    className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs whitespace-nowrap"
                                >
                                    Discover Active
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs text-slate-400 mb-1">Model ID</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                value={data.modelId || ''}
                                onChange={(e) => setData({ ...data, modelId: e.target.value })}
                                placeholder="gpt-4, llama2, etc."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                            />
                            {/* Simple dropdown for discovered models if any */}
                            {discoveredModels.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-20">
                                    {discoveredModels.map(m => (
                                        <div key={m} className="flex items-center justify-between px-3 py-2 hover:bg-slate-800 group/item transition-colors">
                                            <button
                                                onClick={() => {
                                                    setData({ ...data, modelId: m });
                                                    setDiscoveredModels([]);
                                                }}
                                                className="flex-1 text-left text-xs text-slate-300 group-hover/item:text-white truncate mr-2"
                                            >
                                                {m}
                                            </button>
                                            {data.provider === 'exo' && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!data.baseUrl) return;
                                                        setIsLoadingModel(m);
                                                        try {
                                                            const { loadExoModel } = await import('@/services/api');
                                                            await loadExoModel({
                                                                baseUrl: data.baseUrl,
                                                                apiKey: data.apiKey,
                                                                modelId: m
                                                            });
                                                            alert(`Successfully loaded ${m} on the cluster!`);
                                                        } catch (error) {
                                                            alert(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`);
                                                        } finally {
                                                            setIsLoadingModel(null);
                                                        }
                                                    }}
                                                    disabled={!!isLoadingModel}
                                                    className={cn(
                                                        "px-2 py-1 rounded text-[10px] font-bold uppercase transition-all",
                                                        isLoadingModel === m
                                                            ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20"
                                                    )}
                                                >
                                                    {isLoadingModel === m ? 'Loading...' : 'Load'}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={async () => {
                                try {
                                    const { fetchModels } = await import('@/services/api');
                                    const models = await fetchModels({
                                        provider: data.provider,
                                        apiKey: data.apiKey,
                                        baseUrl: data.baseUrl
                                    });
                                    if (models.length > 0) {
                                        setDiscoveredModels(models);
                                        // Optional: Auto-select first if empty
                                        if (!data.modelId) setData({ ...data, modelId: models[0] });
                                    } else {
                                        alert('No models found.');
                                    }
                                } catch (error) {
                                    alert('Failed to fetch models. Check API Key/URL.');
                                    console.error(error);
                                }
                            }}
                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs whitespace-nowrap flex items-center gap-1"
                        >
                            <Search size={14} />
                            Discover
                        </button>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-white">Cancel</button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">
                        <Save size={14} /> Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between group hover:border-slate-600 transition-colors">
            <div>
                <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{model.name}</h4>
                    <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold",
                        model.provider === 'openai' ? "bg-green-500/10 text-green-400" :
                            model.provider === 'gemini' ? "bg-purple-500/10 text-purple-400" :
                                model.provider === 'exo' ? "bg-indigo-500/10 text-indigo-400" :
                                    "bg-orange-500/10 text-orange-400"
                    )}>
                        {model.provider}
                    </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{model.modelId} • {model.baseUrl || 'Default API'}</p>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                    Settings
                </button>
                <button onClick={() => onRemove(model.id)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg">
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}
