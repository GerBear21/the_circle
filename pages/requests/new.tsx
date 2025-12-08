import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Lottie from 'lottie-react';
import sendingApprovalAnimation from '../../Sending approval lottie.json';
import { AppLayout } from '../../components/layout';
import { Card } from '../../components/ui';

const requestTypes = [
  {
    id: 'approval',
    title: 'Approval Request',
    description: 'Submit a new request for approval',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'primary',
    href: '/requests/new/approval',
  },

  {
    id: 'form',
    title: 'Design New Form',
    description: 'Create a custom form with fields',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'accent',
    href: '/requests/new/form',
  },
  {
    id: 'template',
    title: 'Create Template',
    description: 'Build reusable approval templates',
    icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
    color: 'success',
    href: '/requests/new/template',
  },
  {
    id: 'capex',
    title: 'CAPEX Request',
    description: 'Capital expenditure approval form',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'warning',
    href: '/requests/new/capex',
  },
  {
    id: 'hotel',
    title: 'Complimentary Hotel Guest Booking Form',
    description: 'Complimentary hotel accommodation request',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    color: 'primary',
    href: '/requests/new/hotel-booking',
  },
  {
    id: 'travel',
    title: 'Travel Authorization',
    description: 'Local travel authorization form',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'success',
    href: '/requests/new/travel-auth',
  },
];

const frequentlyUsedForms = [
  {
    id: 'leave',
    title: 'Leave Request',
    category: 'HR',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    href: '/requests/new/leave',
  },
  {
    id: 'expense',
    title: 'Expense Claim',
    category: 'Finance',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    href: '/requests/new/expense',
  },
  {
    id: 'it_help',
    title: 'IT Help Desk',
    category: 'IT Support',
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    href: '/requests/new/it-request',
  },
];

const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; icon: string; hover: string }> = {
    primary: { bg: 'bg-primary-100', icon: 'text-primary-600', hover: 'hover:border-primary-300 hover:bg-primary-50/50' },
    accent: { bg: 'bg-accent/20', icon: 'text-accent', hover: 'hover:border-accent/50 hover:bg-accent/10' },
    success: { bg: 'bg-success-100', icon: 'text-success-600', hover: 'hover:border-success-300 hover:bg-success-50/50' },
    warning: { bg: 'bg-warning-100', icon: 'text-warning-600', hover: 'hover:border-warning-300 hover:bg-warning-50/50' },
    secondary: { bg: 'bg-gray-100', icon: 'text-gray-600', hover: 'hover:border-gray-300 hover:bg-gray-50/50' },
  };
  return colors[color] || colors.primary;
};

export default function NewRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <AppLayout title="Create New">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Create New">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {/* Hero Section with Animation */}
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-primary-50 via-white to-accent/5 border border-primary-100/50 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0">
              <Lottie
                animationData={sendingApprovalAnimation}
                loop={true}
                className="w-full h-full drop-shadow-lg"
              />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">
                What would you like to create?
              </h1>
              <p className="text-text-secondary mt-2 text-base sm:text-lg max-w-md">
                Select an option below to get started with your approval workflow
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {requestTypes.map((type) => {
            const colors = getColorClasses(type.color);
            return (
              <Card
                key={type.id}
                variant="outlined"
                className={`cursor-pointer transition-all duration-200 ${colors.hover} hover:shadow-md hover:-translate-y-0.5`}
                onClick={() => router.push(type.href)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={type.icon} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text-primary">{type.title}</h3>
                    <p className="text-sm text-text-secondary mt-0.5">{type.description}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Frequently Used Section */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-text-primary mb-4 font-heading">Frequently Used</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {frequentlyUsedForms.map((form) => (
              <button
                key={form.id}
                onClick={() => router.push(form.href)}
                className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 group-hover:text-primary-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={form.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-text-primary group-hover:text-primary-600 transition-colors">{form.title}</h3>
                  <p className="text-xs text-text-secondary">{form.category}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <Card className="mt-6 bg-gray-50 border-gray-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-text-primary">Need help?</h4>
              <p className="text-sm text-text-secondary mt-0.5">
                Not sure which option to choose? Contact your administrator or check the documentation.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
