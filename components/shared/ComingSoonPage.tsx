import Link from 'next/link';
import { ReactNode } from 'react';
import { AppLayout } from '../layout';
import { Card, Button } from '../ui';

interface ComingSoonPageProps {
  title: string;
  description: string;
  badge?: string;
  backHref?: string;
  backLabel?: string;
  icon?: ReactNode;
}

const defaultIcon = (
  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

export default function ComingSoonPage({
  title,
  description,
  badge = 'Coming Soon',
  backHref = '/requests/new',
  backLabel = 'Back',
  icon = defaultIcon,
}: ComingSoonPageProps) {
  return (
    <AppLayout title={title}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6">
        <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-white via-[#FCF8F2] to-brand-50 px-6 py-6 shadow-sm">
          <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-brand-100/70 blur-3xl" />
          <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-[#F3EADC] blur-2xl" />

          <div className="relative flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 shadow-sm">
              {icon}
            </div>
            <div>
              <span className="inline-flex items-center rounded-full border border-brand-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">
                {badge}
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">{description}</p>
            </div>
          </div>
        </div>

        <Card padding="lg" className="border-brand-100">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">This page is not live yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
              We&apos;ve added the route so people can find it, but the full workflow is still being built.
            </p>
            <div className="mt-6 flex justify-center">
              <Link href={backHref}>
                <Button variant="primary">{backLabel}</Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
