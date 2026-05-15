import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { AppLayout } from '../../../components/layout';

export default function TravelAuthorizationChooserPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <AppLayout title="Travel Authorization">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9A7545]" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Travel Authorization" showBack onBack={() => router.back()} hideNav>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8">

        {/* Hero Section */}
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-[#F3EADC] via-white to-[#F3EADC]/30 border border-[#C9B896] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center sm:text-left flex-1">
              <span className="inline-block py-1 px-3 rounded-full bg-[#F3EADC] text-[#9A7545] text-xs font-bold tracking-wider uppercase mb-3">
                Select Option
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#3F2D19] font-heading tracking-tight">
                Travel Authorization
              </h1>
              <p className="text-gray-500 mt-4 text-base sm:text-lg max-w-lg leading-relaxed">
                Choose the type of travel authorization you would like to request below to proceed.
              </p>
            </div>
          </div>
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto pb-16">

          {/* Local Travel Authorization */}
          <div
            onClick={() => router.push('/requests/new/travel-auth')}
            className={`
              group relative overflow-hidden bg-white rounded-3xl border border-gray-100
              p-8 sm:p-10 cursor-pointer transition-all duration-500 ease-out
              hover:shadow-[0_20px_40px_-15px_rgba(154,117,69,0.15)] hover:-translate-y-2 hover:border-[#C9B896]
            `}
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100 bg-[#C9A574]/50 pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100 bg-[#F3EADC]/50 pointer-events-none delay-100" />

            <div className="relative z-10 flex flex-col items-center text-center space-y-5 h-full">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-[#F3EADC] to-[#C9A574]/30 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-[#C9A574]/50 border border-[#C9B896]">
                <svg className="w-11 h-11 text-[#9A7545] transition-transform duration-500 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <div className="flex-grow flex flex-col justify-center">
                <h3 className="text-xl font-bold text-[#3F2D19] group-hover:text-[#9A7545] transition-colors">
                  Local Travel
                </h3>
                <p className="text-gray-500 mt-3 text-sm leading-relaxed max-w-[260px] mx-auto">
                  Travel within the country using business-unit itinerary with auto-calculated distance.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-100/80 w-full flex justify-center opacity-70 transition-all duration-500 group-hover:opacity-100 group-hover:border-[#C9B896]">
                <span className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gray-50 text-gray-600 font-semibold text-sm transition-all duration-300 group-hover:bg-[#9A7545] group-hover:text-white group-hover:shadow-md">
                  Continue Form
                  <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </div>

          {/* International Travel Authorization */}
          <div
            onClick={() => router.push('/requests/new/international-travel-auth')}
            className={`
              group relative overflow-hidden bg-white rounded-3xl border border-gray-100
              p-8 sm:p-10 cursor-pointer transition-all duration-500 ease-out
              hover:shadow-[0_20px_40px_-15px_rgba(154,117,69,0.15)] hover:-translate-y-2 hover:border-[#C9B896]
            `}
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100 bg-[#C9A574]/50 pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100 bg-[#F3EADC]/50 pointer-events-none delay-100" />

            <div className="relative z-10 flex flex-col items-center text-center space-y-5 h-full">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-[#F3EADC] to-[#C9A574]/30 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-lg group-hover:shadow-[#C9A574]/50 border border-[#C9B896]">
                <svg className="w-11 h-11 text-[#9A7545] transition-transform duration-500 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>

              <div className="flex-grow flex flex-col justify-center">
                <h3 className="text-xl font-bold text-[#3F2D19] group-hover:text-[#9A7545] transition-colors">
                  International Travel
                </h3>
                <p className="text-gray-500 mt-3 text-sm leading-relaxed max-w-[260px] mx-auto">
                  Cross-border travel — specify origin and destination cities for your journey.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-100/80 w-full flex justify-center opacity-70 transition-all duration-500 group-hover:opacity-100 group-hover:border-[#C9B896]">
                <span className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gray-50 text-gray-600 font-semibold text-sm transition-all duration-300 group-hover:bg-[#9A7545] group-hover:text-white group-hover:shadow-md">
                  Continue Form
                  <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
