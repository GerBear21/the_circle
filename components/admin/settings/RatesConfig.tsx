import React from 'react';
import { Card } from '../../ui';
import { ConfigTabProps, SectionHeading, CardHeading, RateInput, RatesIcon } from './shared';

export function RatesConfig({ getSetting, queueChange }: ConfigTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeading title="Financial Rates & Limits" subtitle="These rates propagate automatically to CAPEX, Travel, Hotel, and Voucher forms." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="!p-6">
          <CardHeading icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} iconBg="bg-green-100" iconColor="text-green-600" title="AA Rates - Petrol (USD/km)" />
          <div className="space-y-3">
            <RateInput label="1.1L - 1.5L" value={getSetting('rates', 'aa_petrol_1500', '0.28')} unit="$/km" onChange={(v) => queueChange('rates', 'aa_petrol_1500', v)} />
            <RateInput label="1.6L - 2.0L" value={getSetting('rates', 'aa_petrol_2000', '0.35')} unit="$/km" onChange={(v) => queueChange('rates', 'aa_petrol_2000', v)} />
            <RateInput label="2.1L - 3.0L" value={getSetting('rates', 'aa_petrol_3000', '0.48')} unit="$/km" onChange={(v) => queueChange('rates', 'aa_petrol_3000', v)} />
            <RateInput label="Above 3.0L" value={getSetting('rates', 'aa_petrol_above3000', '0.59')} unit="$/km" onChange={(v) => queueChange('rates', 'aa_petrol_above3000', v)} />
          </div>
        </Card>

        <Card className="!p-6">
          <CardHeading icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} iconBg="bg-emerald-100" iconColor="text-emerald-600" title="AA Rates - Diesel (USD/km)" />
          <div className="space-y-3">
            <RateInput label="1.1L - 1.5L" value={getSetting('rates', 'aa_diesel_1500', '0.26')} unit="$/km" onChange={(v) => queueChange('rates', 'aa_diesel_1500', v)} />
            <RateInput label="1.6L - 2.0L" value={getSetting('rates', 'aa_diesel_2000', '0.32')} unit="$/km" onChange={(v) => queueChange('rates', 'aa_diesel_2000', v)} />
            <RateInput label="2.1L - 3.0L" value={getSetting('rates', 'aa_diesel_3000', '0.45')} unit="$/km" onChange={(v) => queueChange('rates', 'aa_diesel_3000', v)} />
            <RateInput label="Above 3.0L" value={getSetting('rates', 'aa_diesel_above3000', '0.56')} unit="$/km" onChange={(v) => queueChange('rates', 'aa_diesel_above3000', v)} />
          </div>
        </Card>

        <Card className="!p-6">
          <CardHeading icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} iconBg="bg-blue-100" iconColor="text-blue-600" title="Fuel Pump Prices" />
          <div className="space-y-3">
            <RateInput label="Petrol (Blend)" value={getSetting('rates', 'fuel_petrol', '1.65')} unit="$/L" onChange={(v) => queueChange('rates', 'fuel_petrol', v)} />
            <RateInput label="Diesel" value={getSetting('rates', 'fuel_diesel', '1.55')} unit="$/L" onChange={(v) => queueChange('rates', 'fuel_diesel', v)} />
          </div>
          <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">Used in Travel Authorization budget calculations.</p>
        </Card>

        <Card className="!p-6">
          <CardHeading icon={<RatesIcon />} iconBg="bg-amber-100" iconColor="text-amber-600" title="CAPEX Amount Thresholds" />
          <p className="text-xs text-gray-500 mb-3">Tier thresholds for determining required approval levels.</p>
          <div className="space-y-3">
            <RateInput label="Tier 1 (GM only)" value={getSetting('rates', 'capex_tier1_limit', '5000')} unit="USD" onChange={(v) => queueChange('rates', 'capex_tier1_limit', v)} />
            <RateInput label="Tier 2 (+ MD)" value={getSetting('rates', 'capex_tier2_limit', '25000')} unit="USD" onChange={(v) => queueChange('rates', 'capex_tier2_limit', v)} />
            <RateInput label="Tier 3 (+ FD + CEO)" value={getSetting('rates', 'capex_tier3_limit', '100000')} unit="USD" onChange={(v) => queueChange('rates', 'capex_tier3_limit', v)} />
          </div>
        </Card>

        <Card className="!p-6 lg:col-span-2">
          <CardHeading icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} iconBg="bg-purple-100" iconColor="text-purple-600" title="Per Diem & Allowances" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <RateInput label="Local Daily Allowance" value={getSetting('rates', 'per_diem_local', '120.00')} unit="$/day" onChange={(v) => queueChange('rates', 'per_diem_local', v)} />
            <RateInput label="Regional Allowance" value={getSetting('rates', 'per_diem_regional', '250.00')} unit="$/day" onChange={(v) => queueChange('rates', 'per_diem_regional', v)} />
            <RateInput label="International Allowance" value={getSetting('rates', 'per_diem_international', '450.00')} unit="$/day" onChange={(v) => queueChange('rates', 'per_diem_international', v)} />
            <RateInput label="Accommodation Limit" value={getSetting('rates', 'accommodation_limit', '150.00')} unit="$/night" onChange={(v) => queueChange('rates', 'accommodation_limit', v)} />
            <RateInput label="Breakfast Limit" value={getSetting('rates', 'breakfast_limit', '25.00')} unit="$/meal" onChange={(v) => queueChange('rates', 'breakfast_limit', v)} />
            <RateInput label="Lunch Limit" value={getSetting('rates', 'lunch_limit', '30.00')} unit="$/meal" onChange={(v) => queueChange('rates', 'lunch_limit', v)} />
            <RateInput label="Dinner Limit" value={getSetting('rates', 'dinner_limit', '45.00')} unit="$/meal" onChange={(v) => queueChange('rates', 'dinner_limit', v)} />
            <RateInput label="Incidental Allowance" value={getSetting('rates', 'incidental_allowance', '15.00')} unit="$/day" onChange={(v) => queueChange('rates', 'incidental_allowance', v)} />
          </div>
        </Card>
      </div>
    </div>
  );
}
