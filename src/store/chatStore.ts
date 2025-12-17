import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    attachments?: string[]; // URLs or base64
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
                    id: crypto.randomUUID(),
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
                                        id: crypto.randomUUID(),
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
