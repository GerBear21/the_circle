import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { AppLayout } from '../../components/layout';
import Loader from '@/components/Loader';
import AuditAccessGate from '../../components/audit/AuditAccessGate';
import AuditSectionTabs from '../../components/audit/AuditSectionTabs';
import { CATEGORY_STYLES, formatEventTime } from '../../components/audit/AuditEventExplorer';
import archivesAnimation from '../../lotties/archives.json';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Users,
  FileBarChart2,
  ChevronRight,
} from 'lucide-react';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface AuditStats {
  totalAllTime: number;
  totalLast30Days: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byOutcome: Record<string, number>;
  dailySeries: { date: string; [k: string]: any }[];
  topActors: { name: string; count: number }[];
  recentAlerts: any[];
}

const SEVERITY_COLORS: Record<string, string> = {
  info: '#9CA3AF',
  notice: '#60A5FA',
  warning: '#F59E0B',
  critical: '#EF4444',
};

export default function AuditDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [integrity, setIntegrity] = useState<{ isValid: boolean; eventsChecked: number; verifiedAt: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        setLoading(true);
        const resp = await fetch('/api/audit/stats');
        if (resp.ok) setStats(await resp.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const runVerification = async () => {
    try {
      setVerifying(true);
      const resp = await fetch('/api/audit/verify', { method: 'POST' });
      if (resp.ok) setIntegrity(await resp.json());
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  if (status === 'loading') {
    return (
      <AppLayout title="Audit">
        <Loader fullScreen={false} />
      </AppLayout>
    );
  }
  if (!session) return null;

  const severityData = stats
    ? Object.entries(stats.bySeverity).map(([name, value]) => ({ name, value }))
    : [];

  const categoryEntries = stats ? Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]) : [];

  return (
    <AuditAccessGate title="Audit">
      <AppLayout title="Audit">
        <Head><title>Audit Dashboard | The Circle</title></Head>
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

          {/* Hero header — carries the lottie moved over from the Archives page */}
          <div className="rounded-3xl bg-gradient-to-br from-brand-50 via-white to-[#FAF6F1]/10 border border-brand-100/50 p-6 sm:p-10 relative overflow-hidden shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className="w-56 h-56 sm:w-64 sm:h-64 flex-shrink-0 transition-transform hover:scale-105 duration-500">
                <Lottie animationData={archivesAnimation} loop className="w-full h-full drop-shadow-xl" />
              </div>
              <div className="flex-1 text-center md:text-left space-y-4">
                <h1 className="text-4xl font-bold text-gray-900 font-heading tracking-tight">
                  Audit Centre
                </h1>
                <p className="text-gray-600 text-lg max-w-2xl leading-relaxed">
                  Immutable, ISO-aligned records of every action taken in the system — security,
                  configuration, user activity, and the full lifecycle of every transaction and workflow.
                  Each entry is sealed into a SHA-256 hash chain and can never be edited or deleted.
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                  <div className="px-5 py-3 bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
                    <div className="text-sm text-gray-500 font-medium">Total Recorded Events</div>
                    <div className="text-2xl font-bold text-brand-600">{(stats?.totalAllTime ?? 0).toLocaleString()}</div>
                  </div>
                  <div className="px-5 py-3 bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
                    <div className="text-sm text-gray-500 font-medium">Last 30 Days</div>
                    <div className="text-2xl font-bold text-gray-900">{(stats?.totalLast30Days ?? 0).toLocaleString()}</div>
                  </div>
                  <button
                    onClick={runVerification}
                    disabled={verifying}
                    className={`px-5 py-3 rounded-2xl border shadow-sm text-left transition-all hover:scale-[1.02] ${
                      integrity
                        ? integrity.isValid
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-red-50 border-red-200'
                        : 'bg-white/60 backdrop-blur-md border-white/50'
                    }`}
                  >
                    <div className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
                      Chain Integrity
                    </div>
                    <div className={`text-lg font-bold ${integrity ? (integrity.isValid ? 'text-emerald-600' : 'text-red-600') : 'text-gray-900'}`}>
                      {verifying ? 'Verifying…' : integrity ? (integrity.isValid ? `Verified (${integrity.eventsChecked})` : 'TAMPERED') : 'Run Verification'}
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-brand-100/40 to-[#F3EADC]/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          </div>

          <AuditSectionTabs />

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
            </div>
          ) : (
            <>
              {/* Category cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { key: 'security', label: 'Security Events', icon: ShieldAlert, href: '/audit/security', color: 'text-red-500 bg-red-50' },
                  { key: 'system', label: 'System Events', icon: Activity, href: '/audit/system', color: 'text-violet-500 bg-violet-50' },
                  { key: 'activity', label: 'User Activity', icon: Users, href: '/audit/activity', color: 'text-sky-500 bg-sky-50' },
                  { key: 'transaction', label: 'Transactions', icon: FileBarChart2, href: '/audit/transactions', color: 'text-emerald-500 bg-emerald-50' },
                ].map((c) => {
                  const Icon = c.icon;
                  const count = (stats?.byCategory[c.key] || 0) + (c.key === 'transaction' ? (stats?.byCategory['workflow'] || 0) : 0);
                  return (
                    <Link key={c.key} href={c.href}
                      className="group bg-white rounded-2xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/5 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
                          <Icon className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</div>
                      <div className="text-sm text-gray-500 font-medium">{c.label} <span className="text-gray-300">· 30d</span></div>
                    </Link>
                  );
                })}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-1">Event Volume — last 30 days</h3>
                  <p className="text-xs text-gray-400 mb-4">All recorded audit events per day, by category</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats?.dailySeries || []}>
                        <defs>
                          {Object.keys(CATEGORY_STYLES).map((cat, i) => (
                            <linearGradient key={cat} id={`grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={['#EF4444', '#8B5CF6', '#0EA5E9', '#10B981', '#F59E0B', '#06B6D4', '#6366F1'][i]} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={['#EF4444', '#8B5CF6', '#0EA5E9', '#10B981', '#F59E0B', '#06B6D4', '#6366F1'][i]} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(d: string) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} width={32} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }} />
                        {Object.keys(CATEGORY_STYLES).map((cat, i) => (
                          <Area key={cat} type="monotone" dataKey={cat} stackId="1" name={CATEGORY_STYLES[cat].label}
                            stroke={['#EF4444', '#8B5CF6', '#0EA5E9', '#10B981', '#F59E0B', '#06B6D4', '#6366F1'][i]}
                            fill={`url(#grad-${cat})`} strokeWidth={1.5} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-1">Severity Mix</h3>
                  <p className="text-xs text-gray-400 mb-2">Last 30 days</p>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                          {severityData.map((s) => (
                            <Cell key={s.name} fill={SEVERITY_COLORS[s.name] || '#9CA3AF'} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {severityData.map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 capitalize text-gray-600">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: SEVERITY_COLORS[s.name] }} />
                          {s.name}
                        </span>
                        <span className="font-semibold text-gray-900">{s.value}</span>
                      </div>
                    ))}
                    {severityData.length === 0 && <div className="text-xs text-gray-400">No events yet.</div>}
                  </div>
                </div>
              </div>

              {/* Bottom row: alerts + top actors + categories */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
                      Recent Alerts
                    </h3>
                    <Link href="/audit/logs" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                      View all logs <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Link>
                  </div>
                  {(stats?.recentAlerts || []).length === 0 ? (
                    <div className="text-sm text-gray-400 py-6 text-center">No warnings or critical events recorded. All clear.</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {(stats?.recentAlerts || []).map((a: any) => (
                        <div key={a.id} className="py-2.5 flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${a.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{a.action}</div>
                            <div className="text-xs text-gray-400">{a.actor_name || 'System'} — {formatEventTime(a.occurred_at)}</div>
                          </div>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${a.severity === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                            {a.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3">Most Active Users <span className="text-xs font-normal text-gray-400">30d</span></h3>
                    <div className="space-y-2.5">
                      {(stats?.topActors || []).map((a, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="flex-1 text-sm text-gray-700 truncate">{a.name}</span>
                          <span className="text-xs font-bold text-gray-900">{a.count}</span>
                        </div>
                      ))}
                      {(stats?.topActors || []).length === 0 && <div className="text-xs text-gray-400">No activity yet.</div>}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3">By Category <span className="text-xs font-normal text-gray-400">30d</span></h3>
                    <div className="space-y-2">
                      {categoryEntries.map(([cat, count]) => (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${CATEGORY_STYLES[cat]?.chip || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                            {CATEGORY_STYLES[cat]?.label || cat}
                          </span>
                          <span className="font-semibold text-gray-900">{count}</span>
                        </div>
                      ))}
                      {categoryEntries.length === 0 && <div className="text-xs text-gray-400">No events yet.</div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick link into the full explorer */}
              <Link href="/audit/logs"
                className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-2xl p-5 hover:shadow-lg hover:shadow-brand-500/20 transition-all group">
                <div className="flex items-center gap-3">
                  <ScrollText className="w-6 h-6" strokeWidth={1.5} />
                  <div>
                    <div className="font-bold">Open the Immutable Log Explorer</div>
                    <div className="text-sm opacity-80">Filter, sort, inspect and export every recorded event</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
              </Link>
            </>
          )}
        </div>
      </AppLayout>
    </AuditAccessGate>
  );
}
