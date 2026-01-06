import React from 'react';
import { useNode } from '@craftjs/core';

export const Heading = ({ text, level, align, color }: any) => {
    const { connectors: { connect, drag } } = useNode();

    const Component = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';

    // Base classes based on level
    let classes = level === 1 ? 'text-2xl font-bold mb-4' : level === 2 ? 'text-xl font-semibold mb-3' : 'text-lg font-medium mb-2';

    // Add alignment
    classes += ` text-${align}`;

    // Initial inline styles for color to avoid extensive tailwind safelisting for arbitrary colors
    const style = { color: color };

    return (
        <div ref={(ref: any) => connect(drag(ref))}>
            <Component className={classes} style={style}>{text}</Component>
        </div>
    );
};

export const HeadingSettings = () => {
    const { actions: { setProp }, text, level, align, color } = useNode((node) => ({
        text: node.data.props.text,
        level: node.data.props.level,
        align: node.data.props.align,
        color: node.data.props.color,
    }));

    return (
        <div className="space-y-3 p-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Text</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={text || ''}
                    onChange={(e) => setProp((props: any) => props.text = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Level</label>
                <select
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={level}
                    onChange={(e) => setProp((props: any) => props.level = parseInt(e.target.value))}
                >
                    <option value={1}>H1</option>
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Alignment</label>
                <div className="flex bg-gray-100 rounded p-1 gap-1">
                    {['left', 'center', 'right'].map((a) => (
                        <button
                            key={a}
                            className={`flex-1 py-1 text-xs rounded capitalize ${align === a ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setProp((props: any) => props.align = a)}
                        >
                            {a}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Color</label>
                <input
                    type="color"
                    className="w-full h-8 p-1 border rounded cursor-pointer"
                    value={color || '#000000'}
                    onChange={(e) => setProp((props: any) => props.color = e.target.value)}
                />
            </div>
        </div>
    );
};

Heading.craft = {
    displayName: 'Heading',
    props: {
        text: 'Section Heading',
        level: 2,
        align: 'left',
        color: '#000000'
    },
    related: {
        settings: HeadingSettings,
    },
};
