import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import notFoundAnimation from "../lotties/Page not found 404.json";

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found | The Circle</title>
        <meta name="description" content="The page you are looking for could not be found." />
      </Head>

      <div className="min-h-screen w-full bg-[#FAFAFA] relative overflow-hidden flex flex-col items-center justify-center selection:bg-brand-500 selection:text-white">

        {/* Abstract Background Shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute -top-[20%] -right-[10%] w-[60vw] h-[60vw] bg-gradient-to-br from-purple-200/30 to-blue-200/30 rounded-full blur-[100px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] bg-gradient-to-tr from-rose-200/30 to-orange-200/30 rounded-full blur-[100px]"
          />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay" />
        </div>

        {/* Main Content Container */}
        <div className="relative z-10 w-full max-w-4xl mx-auto p-6 flex flex-col items-center justify-center text-center">

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto mb-2"
          >
            <Lottie 
              animationData={notFoundAnimation} 
              loop={true} 
              className="w-full h-auto drop-shadow-2xl"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6 flex flex-col items-center"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight">
              Aww, snap!
            </h1>
            
            <p className="text-lg sm:text-xl text-gray-500 max-w-md mx-auto leading-relaxed">
              We couldn't find the page you're looking for. It might have been moved, deleted, or perhaps it never existed.
            </p>

            <Link href="/" passHref>
              <div className="mt-8 group relative overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-transform active:scale-[0.98] inline-block cursor-pointer shadow-md hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-500 via-purple-500 to-brand-500 bg-[length:200%_auto] animate-gradient" />
                <div className="relative flex items-center justify-center gap-2 bg-white text-gray-900 font-semibold py-3 px-8 rounded-full transition-all group-hover:bg-opacity-90">
                  <ArrowLeft className="w-5 h-5 text-brand-600 transition-transform group-hover:-translate-x-1" />
                  <span>Return to Home</span>
                </div>
              </div>
            </Link>
          </motion.div>

        </div>
      </div>
    </>
  );
}
