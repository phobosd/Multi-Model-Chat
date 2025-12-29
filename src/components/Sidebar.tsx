import { MessageSquarePlus, Settings, MessageSquare, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/store/settingsStore';
import { useChatStore } from '@/store/chatStore';
import { useState, useRef, useEffect } from 'react';

export function Sidebar() {
    const toggleSettings = useSettingsStore((state) => state.toggleSettings);
    const { sessions, currentSessionId, selectSession, createSession, deleteSession, updateSessionTitle } = useChatStore();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    const handleStartEdit = (e: React.MouseEvent, id: string, title: string) => {
        e.stopPropagation();
        setEditingId(id);
        setEditValue(title);
    };

    const handleSaveEdit = (e?: React.FormEvent | React.FocusEvent) => {
        if (e) e.preventDefault();
        if (editingId && editValue.trim()) {
            updateSessionTitle(editingId, editValue.trim());
        }
        setEditingId(null);
    };

    return (
        <aside className="w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col h-full backdrop-blur-xl">
            <div className="p-4 border-b border-slate-800">
                <button
                    onClick={createSession}
                    className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                >
                    <MessageSquarePlus size={20} />
                    <span className="font-medium">New Chat</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Recent
                </div>
                {sessions.map((session) => (
                    <div
                        key={session.id}
                        className={cn(
                            "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer relative",
                            session.id === currentSessionId ? "bg-slate-800/80 text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                        )}
                        onClick={() => selectSession(session.id)}
                    >
                        <MessageSquare size={16} className={cn("shrink-0", session.id === currentSessionId ? "text-blue-400" : "text-slate-500 group-hover:text-slate-400")} />

                        {editingId === session.id ? (
                            <form onSubmit={handleSaveEdit} className="flex-1 flex items-center gap-1 min-w-0">
                                <input
                                    ref={editInputRef}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleSaveEdit}
                                    className="flex-1 bg-slate-950 border border-blue-500 rounded px-1 py-0.5 text-xs outline-none min-w-0"
                                />
                            </form>
                        ) : (
                            <span className="truncate flex-1 text-left">{session.title}</span>
                        )}

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {editingId !== session.id && (
                                <>
                                    <button
                                        onClick={(e) => handleStartEdit(e, session.id, session.title)}
                                        className="p-1 hover:bg-slate-700 rounded transition-all text-slate-400 hover:text-white"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                                        className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                {sessions.length === 0 && (
                    <div className="px-4 py-8 text-center text-slate-600 text-sm">
                        No chats yet. Start a new one!
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={toggleSettings}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
                >
                    <Settings size={18} />
                    <span>Settings</span>
                </button>
            </div>
        </aside>
    );
}
