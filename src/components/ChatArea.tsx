import { PromptBar } from './PromptBar';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore, type Message, type MessageStats } from '@/store/chatStore';
import { sendMessage } from '@/services/api';
import { useState, useEffect, useRef } from 'react';
import type { ModelConfig } from '@/store/settingsStore';
import { Brain, ChevronDown, ChevronUp, Zap, Clock, Activity, Square } from 'lucide-react';

function MessageContent({ content, isGenerating, stats }: { content: string; isGenerating: boolean; stats?: MessageStats }) {
    const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);

    // Parse thinking tags
    const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    const hasThink = !!thinkMatch;
    const thoughtContent = thinkMatch ? thinkMatch[1].trim() : '';
    const mainContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim() || (thinkMatch && !content.includes('</think>') ? '' : content);

    if (!hasThink) {
        return (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {content}
                {isGenerating && <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse align-middle" />}
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="border-l-2 border-slate-700 pl-3 py-1 my-1">
                <button
                    onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-500 hover:text-slate-400 transition-colors mb-1"
                >
                    <Brain size={12} className="text-blue-500/50" />
                    <span>Thought Process</span>
                    {isThoughtExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>

                {isThoughtExpanded ? (
                    <div className="text-xs text-slate-400 italic leading-relaxed whitespace-pre-wrap">
                        {thoughtContent}
                        {!content.includes('</think>') && isGenerating && (
                            <span className="inline-block w-1.5 h-3 ml-1 bg-slate-600 animate-pulse align-middle" />
                        )}
                    </div>
                ) : (
                    <div className="text-[10px] text-slate-600 truncate max-w-md italic">
                        {thoughtContent.substring(0, 100)}...
                    </div>
                )}
            </div>

            {mainContent && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {mainContent}
                    {isGenerating && <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse align-middle" />}
                </p>
            )}

            {!mainContent && !content.includes('</think>') && isGenerating && (
                <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Generating response...
                </div>
            )}

            {stats && !isGenerating && (
                <div className="mt-4 pt-3 border-t border-slate-700/30 flex flex-wrap gap-4 text-[10px] text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                        <Zap size={12} className="text-amber-500/50" />
                        <span>{stats.tokensPerSecond} t/s</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Activity size={12} className="text-blue-500/50" />
                        <span>{stats.totalTokens} tokens</span>
                    </div>
                    {stats.thinkingTimeMs !== undefined && stats.thinkingTimeMs > 0 && (
                        <div className="flex items-center gap-1.5">
                            <Brain size={12} className="text-purple-500/50" />
                            <span>{(stats.thinkingTimeMs / 1000).toFixed(2)}s thought</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-emerald-500/50" />
                        <span>{(stats.totalTimeMs! / 1000).toFixed(2)}s total</span>
                    </div>
                </div>
            )}
        </div>
    );
}


export function ChatArea() {
    const { sessions, currentSessionId, addMessage, updateMessage, createSession, updateSessionTitle } = useChatStore();
    const [isGenerating, setIsGenerating] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

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

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsGenerating(false);
        }
    };

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
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const startTime = Date.now();
        let firstTokenTime: number | null = null;
        let tokenCount = 0;

        try {
            // Get the session to find the ID of the message we just added
            const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
            if (!session) return;

            const isFirstMessage = session.messages.length === 2; // User message + Assistant placeholder

            const realAssistantMessage = session.messages[session.messages.length - 1];
            if (!realAssistantMessage) return;

            // Get history for context (excluding the empty assistant message we just added)
            const history = session.messages.slice(0, -1);

            const stream = sendMessage(history, model, controller.signal);
            let fullContent = '';

            for await (const chunk of stream) {
                if (firstTokenTime === null && chunk.trim().length > 0) {
                    firstTokenTime = Date.now();
                }

                fullContent += chunk;
                // Estimate tokens: 1 token per 4 characters is a common heuristic
                tokenCount = Math.ceil(fullContent.length / 4);

                updateMessage(currentSessionId, realAssistantMessage.id, fullContent);
            }

            const endTime = Date.now();
            const totalTimeMs = endTime - startTime;
            const thinkingTimeMs = firstTokenTime ? firstTokenTime - startTime : 0;
            const generationTimeMs = firstTokenTime ? endTime - firstTokenTime : totalTimeMs;

            const tokensPerSecond = generationTimeMs > 0 ? (tokenCount / (generationTimeMs / 1000)) : 0;

            useChatStore.getState().updateMessageStats(currentSessionId, realAssistantMessage.id, {
                tokensPerSecond: parseFloat(tokensPerSecond.toFixed(1)),
                totalTokens: tokenCount,
                thinkingTimeMs,
                totalTimeMs
            });

            // Auto-name the chat if it's the first message
            if (isFirstMessage) {
                const firstPrompt = content.trim();
                // Simple logic: first 40 chars, or first line
                let title = firstPrompt.split('\n')[0];
                if (title.length > 40) {
                    title = title.substring(0, 37) + '...';
                }
                updateSessionTitle(currentSessionId, title);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Generation aborted by user');
                // Update message to indicate it was stopped
                const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
                const realAssistantMessage = session?.messages[session.messages.length - 1];
                if (realAssistantMessage && !realAssistantMessage.content) {
                    updateMessage(currentSessionId, realAssistantMessage.id, "_Generation stopped by user._");
                }
            } else {
                console.error('Failed to send message:', error);
                // We need to find the message again to update it with the error
                const session = useChatStore.getState().sessions.find(s => s.id === currentSessionId);
                const realAssistantMessage = session?.messages[session.messages.length - 1];
                if (realAssistantMessage) {
                    updateMessage(currentSessionId, realAssistantMessage.id, "Error: Failed to generate response.");
                }
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
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
                            <MessageContent
                                content={typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                                isGenerating={msg.role === 'assistant' && isGenerating && msg.id === currentSession.messages[currentSession.messages.length - 1].id}
                                stats={msg.stats}
                            />
                        </div>

                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                <User size={18} className="text-slate-300" />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-slate-800/50 bg-slate-950/50 backdrop-blur-md relative">
                {isGenerating && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                        <button
                            onClick={handleStop}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full text-xs font-medium shadow-lg border border-slate-700 transition-all animate-in fade-in slide-in-from-bottom-2"
                        >
                            <Square size={12} className="fill-white" />
                            Stop Generating
                        </button>
                    </div>
                )}
                <div className="max-w-3xl mx-auto">
                    <PromptBar onSend={handleSend} disabled={isGenerating} />
                </div>
            </div>
        </div>
    );
}
