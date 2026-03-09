import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Lottie from 'lottie-react';
import sendingApprovalAnimation from '../../../Sending approval lottie.json';
import { AppLayout } from '../../../components/layout';

export default function AccommodationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <AppLayout title="Accommodation Request">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Accommodation Options" showBack onBack={() => router.back()} hideNav>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8">
        
        {/* Hero Section */}
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-primary-50 via-white to-amber-50/30 border border-primary-100/50 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-44 h-44 sm:w-56 sm:h-56 flex-shrink-0 relative">
              <div className="absolute inset-0 bg-primary-200/20 rounded-full blur-2xl animate-pulse"></div>
              <Lottie
                animationData={sendingApprovalAnimation}
                loop={true}
                className="w-full h-full drop-shadow-xl relative z-10"
              />
            </div>
            <div className="text-center sm:text-left flex-1">
              <span className="inline-block py-1 px-3 rounded-full bg-primary-100 text-primary-700 text-xs font-bold tracking-wider uppercase mb-3">
                Select Option
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-heading tracking-tight">
                Accommodation Request
              </h1>
              <p className="text-gray-500 mt-4 text-base sm:text-lg max-w-lg leading-relaxed">
                Please select the type of complimentary accommodation you would like to request below to proceed.
              </p>
            </div>
          </div>
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto pb-16">
          
          {/* Hotel Booking Option */}
          <div
            onClick={() => router.push('/requests/new/hotel-booking')}
            className={`
              group relative overflow-hidden bg-white rounded-3xl border border-gray-100 
              p-8 sm:p-10 cursor-pointer transition-all duration-500 ease-out
              hover:shadow-[0_20px_40px_-15px_rgba(29,78,216,0.15)] hover:-translate-y-2 hover:border-primary-300
            `}
          >
            {/* Background decorative glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100 bg-primary-200/50 pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100 bg-primary-100/50 pointer-events-none delay-100" />
            
            <div className="relative z-10 flex flex-col items-center text-center space-y-5 h-full">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-primary-200/50 border border-primary-200">
                <svg className="w-11 h-11 text-primary-600 transition-transform duration-500 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              
              <div className="flex-grow flex flex-col justify-center">
                <h3 className="text-2xl font-bold text-gray-900 group-hover:text-primary-700 transition-colors">
                  Hotel Booking
                </h3>
                <p className="text-gray-500 mt-3 text-sm leading-relaxed max-w-[260px] mx-auto">
                  Submit a form specifically requesting a complimentary domestic or international hotel stay.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-100/80 w-full flex justify-center opacity-70 transition-all duration-500 group-hover:opacity-100 group-hover:border-primary-100">
                <span className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gray-50 text-gray-600 font-semibold text-sm transition-all duration-300 group-hover:bg-primary-500 group-hover:text-white group-hover:shadow-md">
                  Continue Form
                  <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </div>

          {/* Voucher Request Option */}
          <div
            onClick={() => router.push('/requests/new/voucher')}
            className={`
              group relative overflow-hidden bg-white rounded-3xl border border-gray-100 
              p-8 sm:p-10 cursor-pointer transition-all duration-500 ease-out
              hover:shadow-[0_20px_40px_-15px_rgba(217,119,6,0.15)] hover:-translate-y-2 hover:border-amber-300
            `}
          >
            {/* Background decorative glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100 bg-amber-200/50 pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100 bg-amber-100/50 pointer-events-none delay-100" />
            
            <div className="relative z-10 flex flex-col items-center text-center space-y-5 h-full">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-lg group-hover:shadow-amber-200/50 border border-amber-200">
                <svg className="w-11 h-11 text-amber-600 transition-transform duration-500 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              
              <div className="flex-grow flex flex-col justify-center">
                <h3 className="text-2xl font-bold text-gray-900 group-hover:text-amber-700 transition-colors">
                  Voucher Request
                </h3>
                <p className="text-gray-500 mt-3 text-sm leading-relaxed max-w-[260px] mx-auto">
                  Submit a request focusing on securing an accommodation voucher for external use.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-100/80 w-full flex justify-center opacity-70 transition-all duration-500 group-hover:opacity-100 group-hover:border-amber-100">
                <span className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gray-50 text-gray-600 font-semibold text-sm transition-all duration-300 group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-md">
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
