import React from 'react';
import { useNode } from '@craftjs/core';

export const Section = ({ title, description, children }: any) => {
    const { connectors: { connect, drag } } = useNode();

    return (
        <div
            ref={(ref: any) => connect(drag(ref))}
            className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200"
        >
            <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                {description && (
                    <p className="text-sm text-gray-500 mt-1">{description}</p>
                )}
            </div>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    );
};

export const SectionSettings = () => {
    const { actions: { setProp }, title, description } = useNode((node) => ({
        title: node.data.props.title,
        description: node.data.props.description,
    }));

    return (
        <div className="space-y-3 p-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Section Title</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={title || ''}
                    onChange={(e) => setProp((props: any) => props.title = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Description</label>
                <textarea
                    className="w-full px-2 py-1 text-sm border rounded"
                    rows={2}
                    value={description || ''}
                    onChange={(e) => setProp((props: any) => props.description = e.target.value)}
                />
            </div>
        </div>
    );
};

Section.craft = {
    displayName: 'Section',
    props: {
        title: 'Section Title',
        description: 'Section description (optional)',
    },
    related: {
        settings: SectionSettings,
    },
};
