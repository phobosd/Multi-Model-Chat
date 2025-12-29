import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col h-full relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none" />
                {children}
            </main>
        </div>
    );
}
