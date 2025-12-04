import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Head from "next/head";
import Loader from "../components/Loader";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <Loader />
          <p className="text-text-secondary text-sm">Loading...</p>
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

      <div className="min-h-screen bg-gray-50 flex">
        {/* Left Panel - Branding (hidden on mobile) */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-brand-900">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700" />
          
          {/* Decorative Elements */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-brand-400/20 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-brand-300/10 rounded-full blur-2xl" />
          </div>

          {/* Grid Pattern */}
          <div className="absolute inset-0 opacity-10" 
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 max-w-4xl mx-auto w-full">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-white font-semibold text-xl">The Circle</span>
            </div>

            {/* Main Content */}
            <div className="max-w-lg">
              <Loader />
              <p className="text-lg text-brand-100 leading-relaxed mt-6">
                Transform how your organization handles approvals. Fast, secure, and designed for modern teams.
              </p>

              {/* Features */}
              <div className="mt-10 space-y-4">
                {[
                  { icon: "M13 10V3L4 14h7v7l9-11h-7z", text: "Lightning-fast approvals" },
                  { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", text: "Enterprise-grade security" },
                  { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", text: "Complete audit trails" },
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-brand-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                      </svg>
                    </div>
                    <span className="text-white/90">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <p className="text-brand-100/50 text-sm">
              Trusted by organizations worldwide
            </p>
          </div>
        </div>

        {/* Right Panel - Login */}
        <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 sm:p-12 bg-white">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-12">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-gray-800 font-semibold text-2xl">The Circle</span>
            </div>

            {/* Login Card */}
            <div className="bg-white shadow-xl border border-gray-200 rounded-2xl p-8 sm:p-10">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
                <p className="text-gray-500">Sign in to access your dashboard</p>
              </div>

              {/* Sign In Button */}
              <button
                onClick={() => signIn("azure-ad")}
                className="w-full flex items-center justify-center gap-3 bg-brand-500 hover:bg-brand-600 text-white font-medium py-4 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5 active:translate-y-0"
              >
                <svg className="w-5 h-5" viewBox="0 0 21 21" fill="currentColor">
                  <path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z"/>
                </svg>
                Sign in with Microsoft
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-gray-400 text-sm">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Alternative Options */}
              <div className="space-y-3">
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-3 bg-gray-100 text-gray-400 font-medium py-4 px-6 rounded-xl cursor-not-allowed border border-gray-200"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub (Coming Soon)
                </button>
              </div>

              {/* Help Text */}
              <p className="text-center text-gray-500 text-sm mt-8">
                Use your organization&apos;s Microsoft account to sign in.
                <br />
                <a href="#" className="text-brand-500 hover:text-brand-600 transition-colors">
                  Need help?
                </a>
              </p>
            </div>

            {/* Footer */}
            <p className="text-center text-gray-500 text-xs mt-8">
              By signing in, you agree to our{" "}
              <a href="#" className="text-brand-600 hover:text-brand-700">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="text-brand-600 hover:text-brand-700">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
