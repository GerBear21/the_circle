import dynamic from 'next/dynamic';
import React, { useRef } from 'react';
import type { LottieRefCurrentProps } from 'lottie-react';

import errorAnimation from '../../lotties/error-exclamation.json';
import successAnimation from '../../lotties/success-check.json';
import warningAnimation from '../../lotties/warning-exclamation.json';

// Dynamically import Lottie to avoid SSR issues (same pattern as pages/404.tsx)
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export type FeedbackType = 'success' | 'error' | 'warning';

const ANIMATIONS: Record<FeedbackType, unknown> = {
    success: successAnimation,
    error: errorAnimation,
    warning: warningAnimation,
};

// Default playback speed for feedback animations. < 1 plays slower for a
// calmer, less frantic feel in toasts and modals.
const DEFAULT_SPEED = 0.5;

interface FeedbackLottieProps {
    type: FeedbackType;
    /** Pixel size (width & height) of the square animation. */
    size?: number;
    /** Whether the animation should loop. Defaults to true so motion is always visible. */
    loop?: boolean;
    /** Playback speed multiplier. Defaults to 0.5 (half speed). */
    speed?: number;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Renders one of the shared feedback animations (success / error / warning).
 * Centralises the Lottie JSON mapping so toasts, the error boundary and the
 * custom error page all stay visually consistent.
 */
export default function FeedbackLottie({
    type,
    size = 28,
    loop = true,
    speed = DEFAULT_SPEED,
    className,
    style,
}: FeedbackLottieProps) {
    const lottieRef = useRef<LottieRefCurrentProps | null>(null);

    return (
        <Lottie
            lottieRef={lottieRef}
            animationData={ANIMATIONS[type]}
            loop={loop}
            autoplay
            // setSpeed is only safe once the animation instance exists.
            onDOMLoaded={() => lottieRef.current?.setSpeed(speed)}
            className={className}
            style={{ width: size, height: size, ...style }}
        />
    );
}
