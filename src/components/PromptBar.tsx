import { Paperclip, Send, ChevronDown, Bot } from 'lucide-react';
import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import { useSettingsStore, type ModelConfig } from '@/store/settingsStore';
import { cn } from '@/lib/utils';

interface PromptBarProps {
    onSend: (content: string, model: ModelConfig, attachments: string[]) => void;
    disabled?: boolean;
}

export function PromptBar({ onSend, disabled }: PromptBarProps) {
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState<string[]>([]); // Base64 strings
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { models } = useSettingsStore();
    const [selectedModelId, setSelectedModelId] = useState<string>(models[0]?.id || '');
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

    const selectedModel = models.find(m => m.id === selectedModelId) || models[0];

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    useEffect(() => {
        if (!disabled && textareaRef.current) {
            // Timeout to ensure the element is enabled and ready to receive focus
            const timer = setTimeout(() => {
                textareaRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [disabled]);

    // Also focus on mount
    useEffect(() => {
        if (!disabled && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [disabled]);

    const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const newAttachments: string[] = [];

            for (const file of files) {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    await new Promise((resolve) => {
                        reader.onload = (e) => {
                            if (e.target?.result) {
                                newAttachments.push(e.target.result as string);
                            }
                            resolve(null);
                        };
                        reader.readAsDataURL(file);
                    });
                }
            }
            setAttachments([...attachments, ...newAttachments]);
        }
    };

    const handleSend = () => {
        if ((!input.trim() && attachments.length === 0) || disabled || !selectedModel) return;
        onSend(input, selectedModel, attachments);
        setInput('');
        setAttachments([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="relative bg-slate-800/50 rounded-xl border border-slate-700/50 shadow-2xl backdrop-blur-xl transition-all focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/30">
                <div className="relative">
                    <button
                        onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-700/50 text-xs font-medium text-slate-300 transition-colors"
                    >
                        <Bot size={14} className="text-blue-400" />
                        <span>{selectedModel?.name || 'Select Model'}</span>
                        <ChevronDown size={12} className="text-slate-500" />
                    </button>

                    {isModelMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsModelMenuOpen(false)} />
                            <div className="absolute bottom-full left-0 mb-1 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-20 py-1">
                                {models.map(model => (
                                    <button
                                        key={model.id}
                                        onClick={() => {
                                            setSelectedModelId(model.id);
                                            setIsModelMenuOpen(false);
                                        }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors",
                                            selectedModelId === model.id ? "text-blue-400 bg-blue-900/10" : "text-slate-300"
                                        )}
                                    >
                                        {model.name}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="px-3 pt-3 flex gap-2 overflow-x-auto">
                    {attachments.map((src, idx) => (
                        <div key={idx} className="relative group w-16 h-16 shrink-0">
                            <img src={src} alt="attachment" className="w-full h-full object-cover rounded-lg border border-slate-700" />
                            <button
                                onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <ChevronDown size={10} className="rotate-45" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="flex items-end gap-2 p-3">
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                >
                    <Paperclip size={20} />
                </button>

                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-100 placeholder:text-slate-500 resize-none max-h-32 py-2"
                    rows={1}
                    style={{ minHeight: '40px' }}
                    disabled={disabled}
                />

                <button
                    onClick={handleSend}
                    disabled={(!input.trim() && attachments.length === 0) || disabled}
                    className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}
