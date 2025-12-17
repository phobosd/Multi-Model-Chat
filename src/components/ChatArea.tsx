import { PromptBar } from './PromptBar';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore, type Message } from '@/store/chatStore';
import { sendMessage } from '@/services/api';
import { useState, useEffect, useRef } from 'react';
import type { ModelConfig } from '@/store/settingsStore';

export function ChatArea() {
    const { sessions, currentSessionId, addMessage, updateMessage, createSession } = useChatStore();
    const [isGenerating, setIsGenerating] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const currentSession = sessions.find(s => s.id === currentSessionId);

    useEffect(() => {
        if (!currentSessionId && sessions.length === 0) {
            createSession();
        }
    }, [currentSessionId, sessions.length, createSession]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [currentSession?.messages.length, currentSessionId, currentSession?.messages]);

    const handleSend = async (content: string, model: ModelConfig, attachments: string[]) => {
        if (!currentSessionId) return;

        // Add user message
        const userMessage: Omit<Message, 'id' | 'timestamp'> = {
            role: 'user',
            content,
            attachments
        };
        addMessage(currentSessionId, userMessage);

        // Add placeholder for assistant message
        addMessage(currentSessionId, { role: 'assistant', content: '' });

        setIsGenerating(true);

        try {
            // Get the session to find the ID of the message we just added
            const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
            if (!session) return;

            const realAssistantMessage = session.messages[session.messages.length - 1];
            if (!realAssistantMessage) return;

            // Get history for context (excluding the empty assistant message we just added)
            const history = session.messages.slice(0, -1);

            const stream = sendMessage(history, model);
            let fullContent = '';

            for await (const chunk of stream) {
                fullContent += chunk;
                updateMessage(currentSessionId, realAssistantMessage.id, fullContent);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            // We need to find the message again to update it with the error
            const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
            const realAssistantMessage = session?.messages[session.messages.length - 1];
            if (realAssistantMessage) {
                updateMessage(currentSessionId, realAssistantMessage.id, "Error: Failed to generate response.");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    if (!currentSession) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-500">
                Select or create a chat to begin.
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full relative z-10">
            <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
                {currentSession.messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex gap-4 max-w-3xl mx-auto",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                    >
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                <Bot size={18} className="text-white" />
                            </div>
                        )}

                        <div
                            className={cn(
                                "rounded-2xl px-4 py-3 max-w-[80%] shadow-md",
                                msg.role === 'user'
                                    ? "bg-blue-600 text-white rounded-br-none"
                                    : "bg-slate-800/80 text-slate-100 rounded-bl-none backdrop-blur-sm border border-slate-700/50"
                            )}
                        >
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="flex gap-2 mb-2 overflow-x-auto">
                                    {msg.attachments.map((src, i) => (
                                        <img key={i} src={src} alt="attachment" className="max-w-[200px] max-h-[200px] rounded-lg border border-white/10" />
                                    ))}
                                </div>
                            )}
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                                {msg.role === 'assistant' && isGenerating && msg.id === currentSession.messages[currentSession.messages.length - 1].id && (
                                    <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse align-middle" />
                                )}
                            </p>
                        </div>

                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                <User size={18} className="text-slate-300" />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-slate-800/50 bg-slate-950/50 backdrop-blur-md">
                <div className="max-w-3xl mx-auto">
                    <PromptBar onSend={handleSend} disabled={isGenerating} />
                </div>
            </div>
        </div>
    );
}
