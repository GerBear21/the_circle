import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
// Dynamically import Loader to avoid styled-components hydration mismatch
const Loader = dynamic(() => import("../components/Loader"), { ssr: false });
import heroAnimation from "../Girl doing remote job using laptop.json";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-6">
          <Loader />
          <p className="text-gray-500 text-sm animate-pulse">Initializing The Circle...</p>
        </div>
      </div>
    );
  }

  if (session) {
    return null;
  }

  return (
    <>
      <Head>
        <title>The Circle - Enterprise Approval Workflows</title>
        <meta name="description" content="Streamline your approval processes with The Circle" />
      </Head>

      <div className="min-h-screen w-full bg-[#FAFAFA] relative overflow-hidden flex items-center justify-center selection:bg-brand-500 selection:text-white">

        {/* Abstract Background Shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute -top-[20%] -right-[10%] w-[60vw] h-[60vw] bg-gradient-to-br from-purple-200/40 to-blue-200/40 rounded-full blur-[100px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] bg-gradient-to-tr from-brand-200/40 to-teal-200/40 rounded-full blur-[100px]"
          />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 brightness-100 contrast-150 mix-blend-overlay" />
        </div>

        {/* Main Content Container */}
        <div className="relative z-10 w-full max-w-7xl mx-auto p-6 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-12 lg:gap-24">

          {/* Left Side: Brand & Value Prop */}
          <div className="flex-1 w-full max-w-2xl text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full bg-white/60 border border-gray-200/50 backdrop-blur-sm shadow-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-gray-600 text-xs font-semibold tracking-wide uppercase">System Operational</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 tracking-tight mb-6 leading-[1.1]"
            >
              Approvals, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-purple-600">Reimagined.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-gray-500 leading-relaxed mb-10 max-w-lg mx-auto lg:mx-0"
            >
              Experience the next generation of enterprise workflow automation. Fast, secure, and beautifully designed for modern teams.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="w-full max-w-md mx-auto lg:mx-0"
            >
              <Lottie animationData={heroAnimation} loop={true} className="w-full h-auto drop-shadow-2xl" />
            </motion.div>
          </div>

          {/* Right Side: Glass Login Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="w-full max-w-md relative"
          >
            {/* Glossy Card */}
            <div className="relative bg-white/80 backdrop-blur-xl border border-white/50 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl shadow-brand-900/5">

              <div className="flex flex-col items-center mb-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 p-[1px] shadow-lg shadow-brand-500/20 mb-6">
                  <div className="w-full h-full rounded-2xl bg-white flex items-center justify-center">
                    <svg className="w-10 h-10" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="brandGradientLogin" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#2D9CDB" />
                          <stop offset="100%" stopColor="#A78BFA" />
                        </linearGradient>
                      </defs>
                      <path d="M 100 25
                         C 145 25, 180 60, 180 100
                         C 180 145, 145 180, 100 180
                         C 55 180, 20 145, 20 100
                         C 20 60, 52 28, 95 25
                         L 100 25
                         L 98 40
                         C 60 42, 35 65, 35 100
                         C 35 138, 65 167, 100 167
                         C 138 167, 167 138, 167 100
                         C 167 65, 140 38, 100 38
                         Z"
                        fill="url(#brandGradientLogin)"
                      />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                <p className="text-gray-500 text-center text-sm">
                  Enter your credentials to access the workspace
                </p>
              </div>

              {/* Login Actions */}
              <div className="space-y-4">
                <button
                  onClick={() => signIn("azure-ad")}
                  className="group relative w-full overflow-hidden rounded-xl bg-gray-900 p-[1px] focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-transform active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 group-hover:via-gray-500 transition-all duration-300" />
                  <div className="relative flex items-center justify-center gap-3 w-full bg-gray-900 group-hover:bg-gray-800/90 text-white font-semibold py-4 px-6 rounded-xl transition-all">
                    <svg className="w-5 h-5" viewBox="0 0 21 21" fill="currentColor">
                      <path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z" />
                    </svg>
                    <span>Sign in with Microsoft</span>
                  </div>
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase tracking-wider">Alternative</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <button
                  disabled
                  className="w-full flex items-center justify-center gap-3 bg-gray-50 text-gray-400 font-medium py-4 px-6 rounded-xl border border-gray-200 cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub (Coming Soon)
                </button>
              </div>

              {/* Footer Links */}
              <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center gap-4">
                <p className="text-gray-400 text-xs text-center">
                  By signing in, you agree to our <a href="#" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">Terms</a> and <a href="#" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">Privacy Policy</a>
                </p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </>
  );
}
