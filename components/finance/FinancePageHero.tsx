import { ReactNode } from 'react';

interface FinancePageHeroProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export default function FinancePageHero({ title, description, icon }: FinancePageHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-white via-[#FCF8F2] to-brand-50 px-6 py-6 shadow-sm">
      <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-brand-100/70 blur-3xl" />
      <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-[#F3EADC] blur-2xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 shadow-sm">
            {icon}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Finance</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 sm:text-base">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
