import React from 'react';
import { useNode } from '@craftjs/core';

export const Divider = ({ marginY }: any) => {
    const { connectors: { connect, drag } } = useNode();

    return (
        <div
            ref={(ref: any) => connect(drag(ref))}
            className="w-full"
            style={{ marginTop: `${marginY}px`, marginBottom: `${marginY}px` }}
        >
            <hr className="border-t border-gray-300" />
        </div>
    );
};

export const DividerSettings = () => {
    const { actions: { setProp }, marginY } = useNode((node) => ({
        marginY: node.data.props.marginY,
    }));

    return (
        <div className="space-y-3 p-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Vertical Margin (px)</label>
                <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={marginY || 16}
                    onChange={(e) => setProp((props: any) => props.marginY = parseInt(e.target.value))}
                />
            </div>
        </div>
    );
};

Divider.craft = {
    displayName: 'Divider',
    props: {
        marginY: 16,
    },
    related: {
        settings: DividerSettings,
    },
};
