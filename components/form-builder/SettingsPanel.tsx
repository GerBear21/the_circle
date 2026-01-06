import React from 'react';
import { useEditor } from '@craftjs/core';

export const SettingsPanel = () => {
    const { selected, actions } = useEditor((state, query) => {
        // Handling Set iteration safely
        const selectedNodes = Array.from(state.events.selected || []);
        const currentNodeId = selectedNodes[0];
        let selected;

        if (currentNodeId) {
            selected = {
                id: currentNodeId,
                name: state.nodes[currentNodeId].data.displayName,
                settings: state.nodes[currentNodeId].related && state.nodes[currentNodeId].related.settings,
                isDeletable: query.node(currentNodeId).isDeletable(),
            };
        }

        return {
            selected,
        };
    });

    return selected ? (
        <div className="w-72 bg-white border-l border-gray-200 h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <h3 className="font-semibold text-gray-900">{selected.name} Settings</h3>
                {selected.isDeletable && (
                    <button
                        onClick={() => actions.delete(selected.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto">
                {selected.settings && React.createElement(selected.settings)}
            </div>
        </div>
    ) : (
        <div className="w-72 bg-gray-50 border-l border-gray-200 h-full flex items-center justify-center p-6 text-center">
            <div className="text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <p className="text-sm">Select an element to customize its properties</p>
            </div>
        </div>
    );
};
