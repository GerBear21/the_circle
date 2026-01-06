import React from 'react';
import { useNode } from '@craftjs/core';

export const Rating = ({ label, maxStars, required }: any) => {
    const { connectors: { connect, drag } } = useNode();

    return (
        <div ref={(ref: any) => connect(drag(ref))} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="flex gap-1">
                {[...Array(maxStars)].map((_, i) => (
                    <svg key={i} className="w-6 h-6 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                ))}
            </div>
        </div>
    );
};

export const RatingSettings = () => {
    const { actions: { setProp }, label, maxStars, required } = useNode((node) => ({
        label: node.data.props.label,
        maxStars: node.data.props.maxStars,
        required: node.data.props.required,
    }));

    return (
        <div className="space-y-3 p-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Label</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={label || ''}
                    onChange={(e) => setProp((props: any) => props.label = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Max Stars</label>
                <input
                    type="number"
                    min="1"
                    max="10"
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={maxStars || 5}
                    onChange={(e) => setProp((props: any) => props.maxStars = parseInt(e.target.value))}
                />
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={required || false}
                    onChange={(e) => setProp((props: any) => props.required = e.target.checked)}
                />
                <label className="text-sm text-gray-700">Required</label>
            </div>
        </div>
    );
};

Rating.craft = {
    displayName: 'Rating',
    props: {
        label: 'Rating',
        maxStars: 5,
        required: false,
    },
    related: {
        settings: RatingSettings,
    },
};
