import React from 'react';

interface LoaderProps {
  /**
   * When true (default) the loader is a fixed full-screen overlay — use it for
   * initial page / route loads. When false it renders inline within its
   * container — use it for section-level loading states (tables, panels, etc.).
   */
  fullScreen?: boolean;
  /** Overall width of the three-ball animation in px. Height scales with it. */
  size?: number;
  /** Optional caption shown beneath the animation. */
  label?: string;
  className?: string;
}

// Native design dimensions the keyframes (globals.css) are authored against.
const NATIVE_W = 200;
const NATIVE_H = 60;
const BALL = 20;

const circles: Array<{ left?: string; right?: string; delay: string; color: string }> = [
  { left: '15%', delay: '0s', color: '#9A7545' },
  { left: '45%', delay: '.2s', color: '#D4B483' },
  { right: '15%', delay: '.3s', color: '#C9A574' },
];
const shadows: Array<{ left?: string; right?: string; delay: string; color: string }> = [
  { left: '15%', delay: '0s', color: 'rgba(154, 117, 69, 0.3)' },
  { left: '45%', delay: '.2s', color: 'rgba(212, 180, 131, 0.3)' },
  { right: '15%', delay: '.3s', color: 'rgba(201, 165, 116, 0.3)' },
];

/**
 * The Circle's single app loader: three bouncing balls. Implemented with plain
 * elements + inline styles referencing global keyframes, so it renders
 * identically on the server and client (no styled-components class hashing,
 * hence no hydration mismatch).
 */
const Loader = ({ fullScreen = true, size = NATIVE_W, label, className }: LoaderProps) => {
  const scale = size / NATIVE_W;

  const overlayStyle: React.CSSProperties = fullScreen
    ? {
        position: 'fixed',
        inset: 0,
        backgroundColor: '#FEFEFE',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }
    : {
        position: 'relative',
        width: '100%',
        padding: '2rem 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };

  return (
    <div className={className} style={overlayStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        {/* Outer box reserves the scaled footprint; inner box holds the native
            design scaled from the top-left. */}
        <div style={{ width: NATIVE_W * scale, height: NATIVE_H * scale }}>
          <div style={{ width: NATIVE_W, height: NATIVE_H, position: 'relative', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            {circles.map((c, i) => (
              <div
                key={`c${i}`}
                style={{
                  width: BALL,
                  height: BALL,
                  position: 'absolute',
                  borderRadius: '50%',
                  backgroundColor: c.color,
                  left: c.left,
                  right: c.right,
                  transformOrigin: '50%',
                  animation: `loader-bounce .5s ${c.delay} alternate infinite ease`,
                }}
              />
            ))}
            {shadows.map((s, i) => (
              <div
                key={`s${i}`}
                style={{
                  width: BALL,
                  height: 4,
                  borderRadius: '50%',
                  backgroundColor: s.color,
                  position: 'absolute',
                  top: 62,
                  left: s.left,
                  right: s.right,
                  transformOrigin: '50%',
                  zIndex: -1,
                  filter: 'blur(1px)',
                  animation: `loader-shadow .5s ${s.delay} alternate infinite ease`,
                }}
              />
            ))}
          </div>
        </div>
        {label && <p style={{ fontSize: '0.875rem', color: '#9A7545', fontWeight: 500, margin: 0 }}>{label}</p>}
      </div>
    </div>
  );
};

export default Loader;
