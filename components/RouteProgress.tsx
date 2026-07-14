import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

/**
 * Thin top-of-page progress bar shown during client-side route transitions.
 *
 * Server-rendered pages (e.g. /notifications, which fetches in
 * getServerSideProps) otherwise navigate with no feedback — the screen just
 * hangs on the old page until the new one is ready. This gives that wait a
 * visible loader.
 */
export default function RouteProgress() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let trickle: ReturnType<typeof setInterval> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      if (hideTimer) clearTimeout(hideTimer);
      setVisible(true);
      setWidth(10);
      if (trickle) clearInterval(trickle);
      // Creep towards 90% while the next page loads; never reach 100 until done.
      trickle = setInterval(() => {
        setWidth((w) => (w < 90 ? w + Math.max(1, (90 - w) * 0.15) : w));
      }, 200);
    };

    const done = () => {
      if (trickle) clearInterval(trickle);
      setWidth(100);
      hideTimer = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 300);
    };

    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', done);
    router.events.on('routeChangeError', done);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', done);
      router.events.off('routeChangeError', done);
      if (trickle) clearInterval(trickle);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [router]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: `${width}%`,
        height: 3,
        zIndex: 9999,
        background: 'linear-gradient(90deg, #9A7545, #C9A227)',
        boxShadow: '0 0 8px rgba(154,117,69,0.6)',
        transition: 'width 0.2s ease-out, opacity 0.3s ease-out',
        opacity: width >= 100 ? 0 : 1,
      }}
    />
  );
}
