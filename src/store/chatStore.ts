import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateUUID } from '@/lib/uuid';

export interface MessageStats {
    tokensPerSecond?: number;
    totalTokens?: number;
    thinkingTimeMs?: number;
    totalTimeMs?: number;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    attachments?: string[]; // URLs or base64
    stats?: MessageStats;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
}

interface ChatState {
    sessions: ChatSession[];
    currentSessionId: string | null;
    createSession: () => void;
    selectSession: (id: string) => void;
    addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
    updateMessage: (sessionId: string, messageId: string, content: string) => void;
    updateMessageStats: (sessionId: string, messageId: string, stats: MessageStats) => void;
    updateSessionTitle: (id: string, title: string) => void;
    deleteSession: (id: string) => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            sessions: [],
            currentSessionId: null,

            createSession: () => {
                const newSession: ChatSession = {
                    id: generateUUID(),
                    title: 'New Chat',
                    messages: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                set((state) => ({
                    sessions: [newSession, ...state.sessions],
                    currentSessionId: newSession.id,
                }));
            },

            selectSession: (id) => set({ currentSessionId: id }),

            addMessage: (sessionId, message) => {
                set((state) => ({
                    sessions: state.sessions.map((session) => {
                        if (session.id === sessionId) {
                            return {
                                ...session,
                                messages: [
                                    ...session.messages,
                                    {
                                        ...message,
                                        id: generateUUID(),
                                        timestamp: Date.now(),
                                    },
                                ],
                                updatedAt: Date.now(),
                            };
                        }
                        return session;
                    }),
                }));
            },

            updateMessage: (sessionId, messageId, content) => {
                set((state) => ({
                    sessions: state.sessions.map((session) => {
                        if (session.id === sessionId) {
                            return {
                                ...session,
                                messages: session.messages.map((msg) =>
                                    msg.id === messageId ? { ...msg, content } : msg
                                ),
                                updatedAt: Date.now(),
                            };
                        }
                        return session;
                    }),
                }));
            },

            updateMessageStats: (sessionId, messageId, stats) => {
                set((state) => ({
                    sessions: state.sessions.map((session) => {
                        if (session.id === sessionId) {
                            return {
                                ...session,
                                messages: session.messages.map((msg) =>
                                    msg.id === messageId ? { ...msg, stats } : msg
                                ),
                                updatedAt: Date.now(),
                            };
                        }
                        return session;
                    }),
                }));
            },

            updateSessionTitle: (id, title) => {
                set((state) => ({
                    sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
                }));
            },

            deleteSession: (id) => {
                set((state) => {
                    const newSessions = state.sessions.filter((s) => s.id !== id);
                    return {
                        sessions: newSessions,
                        currentSessionId: state.currentSessionId === id ? (newSessions[0]?.id || null) : state.currentSessionId,
                    };
                });
            },
        }),
        {
            name: 'chat-storage',
        }
    )
);
