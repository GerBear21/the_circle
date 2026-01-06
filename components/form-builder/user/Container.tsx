import React from 'react';
import { useNode } from '@craftjs/core';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';

export const Container = ({ children, className = '' }: any) => {
    const { connectors: { connect, drag } } = useNode();

    return (
        <div
            ref={(ref: any) => connect(drag(ref))}
            className={twMerge(clsx('min-h-[100px] p-4 w-full bg-white rounded-lg border border-dashed border-gray-300', className))}
        >
            {children}
        </div>
    );
};

export const ContainerSettings = () => {
    return <div className="p-3 text-sm text-gray-500">No settings for this container.</div>;
};

Container.craft = {
    displayName: 'Container',
    props: {},
    related: {
        settings: ContainerSettings,
    },
};
