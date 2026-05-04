import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { AppLayout } from '../../../components/layout';

interface AccommodationOptionCardProps {
  onClick: () => void;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  tags: string[];
  iconPath: string;
  iconRotate: string;
}

function AccommodationOptionCard({ onClick, badge, badgeColor, title, subtitle, tags, iconPath, iconRotate }: AccommodationOptionCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden bg-white rounded-3xl border border-gray-100 p-7 sm:p-8 cursor-pointer transition-all duration-500 ease-out hover:shadow-[0_20px_40px_-15px_rgba(154,117,69,0.18)] hover:-translate-y-2 hover:border-[#C9B896]"
    >
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100 bg-[#C9A574]/40 pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100 bg-[#F3EADC]/60 pointer-events-none delay-100" />

      <div className="relative z-10 flex flex-col items-center text-center space-y-5 h-full">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>
          {badge}
        </span>

        <div className={`w-24 h-24 rounded-[2rem] bg-gradient-to-br from-[#F3EADC] to-[#C9A574]/30 flex items-center justify-center transition-all duration-500 group-hover:scale-110 ${iconRotate} group-hover:shadow-lg group-hover:shadow-[#C9A574]/50 border border-[#C9B896]`}>
          <svg className="w-11 h-11 text-[#9A7545] transition-transform duration-500 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
          </svg>
        </div>

        <div className="flex-grow flex flex-col justify-center">
          <h3 className="text-xl font-bold text-[#3F2D19] group-hover:text-[#9A7545] transition-colors">
            {title}
          </h3>
          <p className="text-gray-500 mt-3 text-sm leading-relaxed max-w-[260px] mx-auto">
            {subtitle}
          </p>
        </div>

        <ul className="flex flex-col gap-1.5 text-xs text-gray-500 w-full">
          {tags.map((tag) => (
            <li key={tag} className="flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5 text-[#9A7545] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {tag}
            </li>
          ))}
        </ul>

        <div className="mt-2 pt-5 border-t border-gray-100/80 w-full flex justify-center opacity-70 transition-all duration-500 group-hover:opacity-100 group-hover:border-[#C9B896]">
          <span className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gray-50 text-gray-600 font-semibold text-sm transition-all duration-300 group-hover:bg-[#9A7545] group-hover:text-white group-hover:shadow-md">
            Continue Form
            <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9A7545]" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Accommodation Options" showBack onBack={() => router.back()} hideNav>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8">
        
        {/* Hero Section */}
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-[#F3EADC] via-white to-[#F3EADC]/30 border border-[#C9B896] p-6 sm:p-8 shadow-sm">
          <div className="text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-[#F3EADC] text-[#9A7545] text-xs font-bold tracking-wider uppercase mb-3">
              Select Option
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#3F2D19] font-heading tracking-tight">
              Accommodation Request
            </h1>
            <p className="text-gray-500 mt-4 text-base sm:text-lg max-w-lg leading-relaxed mx-auto">
              Please select the type of complimentary accommodation you would like to request below to proceed.
            </p>
          </div>
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto pb-16">

          {/* Staff Complimentary Hotel Booking Option */}
          <AccommodationOptionCard
            onClick={() => router.push('/requests/new/hotel-booking')}
            badge="For Staff"
            badgeColor="bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]"
            title="Staff Complimentary"
            subtitle="Complimentary hotel stay for a member of staff."
            tags={['Staff only', 'Internal use', 'Quick approval']}
            iconPath="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            iconRotate="group-hover:rotate-3"
          />

          {/* External Complimentary Hotel Booking Option */}
          <AccommodationOptionCard
            onClick={() => router.push('/requests/new/external-comp-booking')}
            badge="For Guests"
            badgeColor="bg-[#E3F2FD] text-[#1565C0] border-[#90CAF9]"
            title="External Complimentary"
            subtitle="Complimentary hotel stay for an external guest."
            tags={['External guests', 'Guest details required']}
            iconPath="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            iconRotate="group-hover:rotate-3"
          />

          {/* Voucher Request Option */}
          <AccommodationOptionCard
            onClick={() => router.push('/requests/new/voucher')}
            badge="Voucher"
            badgeColor="bg-[#FFF3E0] text-[#E65100] border-[#FFCC80]"
            title="Voucher Request"
            subtitle="Secure an accommodation voucher for external use."
            tags={['Prepaid voucher', 'Flexible redemption']}
            iconPath="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
            iconRotate="group-hover:-rotate-3"
          />

        </div>
      </div>
    </AppLayout>
  );
}
