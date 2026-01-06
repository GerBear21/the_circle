import React from 'react';
import { useNode } from '@craftjs/core';

export const Logo = () => {
    const { connectors: { connect, drag } } = useNode();

    return (
        <div
            ref={(ref: any) => connect(drag(ref))}
            className="flex justify-center mb-6"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/images/RTG_LOGO.png"
                alt="RTG Logo"
                className="h-20 object-contain"
            />
        </div>
    );
};

export const LogoSettings = () => {
    return (
        <div className="p-3 text-sm text-gray-500">
            The logo is fixed and cannot be modified.
        </div>
    );
};

Logo.craft = {
    displayName: 'RTG Logo',
    props: {},
    related: {
        settings: LogoSettings,
    },
};
