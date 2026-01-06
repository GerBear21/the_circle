import React, { useEffect } from 'react';
import { useEditor } from '@craftjs/core';
import { Toolbox } from './Toolbox';
import { SettingsPanel } from './SettingsPanel';
import { TopBar } from './TopBar';

export const Viewport = ({ children }: { children: React.ReactNode }) => {
    const { connectors, actions } = useEditor();

    useEffect(() => {
        // Basic click handler to deselect if clicking on empty space
        const handleClick = (e: MouseEvent) => {
            // Implementation left simple for now
        };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [actions]);

    return (
        <div className="flex flex-col h-screen max-h-screen bg-gray-100 overflow-hidden">
            <TopBar />
            <div className="flex flex-1 overflow-hidden">
                <Toolbox />
                <div className="flex-1 overflow-y-auto p-8 relative">
                    <div className="max-w-3xl mx-auto h-full pb-20">
                        {children}
                    </div>
                </div>
                <SettingsPanel />
            </div>
        </div>
    );
};
