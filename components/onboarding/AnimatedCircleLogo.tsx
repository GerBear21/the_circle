import { motion } from 'framer-motion';

/**
 * AnimatedCircleLogo
 * ------------------
 * The Circle's brand mark (the same ring used in the login header and sidebar),
 * brought to life for the onboarding welcome screen: it springs in, breathes
 * gently, and the ring's notch orbits slowly. A soft gold halo pulses behind it.
 */
export default function AnimatedCircleLogo({ size = 168 }: { size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, rotate: -120 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 14, mass: 0.9 }}
      style={{ width: size, height: size, position: 'relative' }}
    >
      {/* Pulsing halo */}
      <motion.div
        aria-hidden
        animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.12, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          inset: '8%',
          borderRadius: '9999px',
          background: 'radial-gradient(circle, rgba(201,165,116,0.55) 0%, rgba(201,165,116,0) 70%)',
        }}
      />

      {/* The brand ring — gently breathing, with the notch slowly orbiting */}
      <motion.svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        style={{ position: 'relative', display: 'block' }}
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <defs>
          <linearGradient id="circleLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9A7545" />
            <stop offset="100%" stopColor="#C9A574" />
          </linearGradient>
        </defs>
        <motion.path
          d="M 100 25 C 145 25, 180 60, 180 100 C 180 145, 145 180, 100 180 C 55 180, 20 145, 20 100 C 20 60, 52 28, 95 25 L 100 25 L 98 40 C 60 42, 35 65, 35 100 C 35 138, 65 167, 100 167 C 138 167, 167 138, 167 100 C 167 65, 140 38, 100 38 Z"
          fill="url(#circleLogoGradient)"
          style={{ transformOrigin: '100px 100px', filter: 'drop-shadow(0 6px 14px rgba(154,117,69,0.28))' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        />
      </motion.svg>
    </motion.div>
  );
}
