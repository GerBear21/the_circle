import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { AppLayout } from '../../../components/layout';
import { Car, Plane, Check, ArrowRight, type LucideIcon } from 'lucide-react';

interface TravelOptionCardProps {
  onClick: () => void;
  badge: string;
  title: string;
  subtitle: string;
  tags: string[];
  Icon: LucideIcon;
}

function TravelOptionCard({ onClick, badge, title, subtitle, tags, Icon }: TravelOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-white rounded-2xl border border-border p-6 cursor-pointer transition-all duration-200 hover:border-neutral-300 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between">
          {/* Monochrome icon — no colour chip, matches the side navigation */}
          <span className="text-neutral-700">
            <Icon className="w-6 h-6" strokeWidth={1.5} />
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-border">
            {badge}
          </span>
        </div>

        <h3 className="mt-5 text-lg font-semibold text-text-primary tracking-tight group-hover:text-primary-700 transition-colors">
          {title}
        </h3>
        <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
          {subtitle}
        </p>

        <ul className="mt-4 space-y-2 text-sm text-text-secondary">
          {tags.map((tag) => (
            <li key={tag} className="flex items-center gap-2">
              <Check className="w-4 h-4 text-neutral-400 shrink-0" strokeWidth={1.5} />
              {tag}
            </li>
          ))}
        </ul>

        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-sm font-medium text-text-secondary group-hover:text-primary-700 transition-colors">
          Continue
          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={1.5} />
        </div>
      </div>
    </button>
  );
}

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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Travel Authorization" showBack onBack={() => router.back()} hideNav>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="rounded-2xl bg-white border border-border p-6 sm:p-8">
          <span className="inline-block py-1 px-3 rounded-full bg-neutral-100 text-neutral-600 text-[11px] font-semibold tracking-wider uppercase mb-3">
            Select Option
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
            Travel Authorization
          </h1>
          <p className="text-text-secondary mt-2 text-sm sm:text-base max-w-lg leading-relaxed">
            Choose the type of travel authorization you would like to request to proceed.
          </p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <TravelOptionCard
            onClick={() => router.push('/requests/new/travel-auth')}
            badge="Domestic"
            title="Local Travel"
            subtitle="Travel within the country using the business-unit itinerary."
            tags={['Within the country', 'Auto-calculated distance', 'Business-unit itinerary']}
            Icon={Car}
          />
          <TravelOptionCard
            onClick={() => router.push('/requests/new/international-travel-auth')}
            badge="Cross-border"
            title="International Travel"
            subtitle="Cross-border travel with origin and destination cities."
            tags={['Origin & destination cities', 'Cross-border journey']}
            Icon={Plane}
          />
        </div>
      </div>
    </AppLayout>
  );
}
