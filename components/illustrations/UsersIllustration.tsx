import React from 'react';
import Lottie from 'lottie-react';
import animationData from './employees_waving.json';

export const UsersIllustration = () => {
    return (
        <div className="w-full h-full flex items-center justify-center">
            <div className="w-full max-w-md">
                <Lottie
                    animationData={animationData}
                    loop={true}
                    autoplay={true}
                />
            </div>
        </div>
    );
};
