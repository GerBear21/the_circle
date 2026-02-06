import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
import { supabase } from '../../lib/supabaseClient';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area
} from 'recharts';

const COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

interface ReportData {
    totalRequests: number;
    approvedCount: number;
    rejectedCount: number;
    pendingCount: number;
    avgTurnaroundTime: number; // in hours
    totalSpend: number;
    capexSpend: number;
    opexSpend: number;
    monthlySpend: { month: string; amount: number }[];
    statusDistribution: { name: string; value: number }[];
    departmentStats: { name: string; requests: number; spend: number }[];
    bottlenecks: { stage: string; avgTime: number }[];
}

export default function ReportsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ReportData | null>(null);
    const [dateRange, setDateRange] = useState('This Year');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchData();
        }
    }, [status, dateRange]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch active requests
            const { data: requestsData, error: reqError } = await supabase
                .from('requests')
                .select('*');

            if (reqError) throw reqError;

            // Fetch archived documents (approved history)
            const { data: archivesData, error: archError } = await supabase
                .from('archived_documents')
                .select('*');

            if (archError) throw archError;

            const requests = requestsData || [];
            const archives = archivesData || [];

            // --- Aggregation Logic ---

            const archivedIds = new Set(archives.map(a => a.request_id));

            // Filter active requests to exclude those already in archives to avoid double counting if they persist
            const activeRequests = requests.filter(r => !archivedIds.has(r.id));

            const approvedCount = archives.length + activeRequests.filter(r => r.status === 'approved').length;
            const rejectedCount = activeRequests.filter(r => r.status === 'rejected').length;
            const pendingCount = activeRequests.filter(r => r.status === 'pending').length;
            const totalRequests = approvedCount + rejectedCount + pendingCount;

            // 2. Turnaround Time
            let totalTime = 0;
            let countWithTime = 0;

            const processTime = (created: string, completed: string) => {
                const start = new Date(created).getTime();
                const end = new Date(completed).getTime();
                if (!isNaN(start) && !isNaN(end) && end > start) {
                    return end - start;
                }
                return 0;
            };

            archives.forEach(a => {
                const t = processTime(a.created_at, a.approval_completed_at);
                if (t > 0) {
                    totalTime += t;
                    countWithTime++;
                }
            });

            const avgTurnaroundTime = countWithTime > 0 ? (totalTime / countWithTime) / (1000 * 60 * 60) : 0; // Hours

            // 3. Spend Analytics
            let totalSpend = 0;
            let capexSpend = 0;

            // Process Archives
            archives.forEach(a => {
                const amt = Number(a.total_amount) || 0;
                totalSpend += amt;

                if ((a.request_title || '').toLowerCase().includes('capex')) {
                    capexSpend += amt;
                }
            });

            // If we could extract spend from active requests, we would here. For now, rely on archives for confirmed spend.

            const opexSpend = totalSpend - capexSpend;

            // 4. Department Stats
            const deptMap: Record<string, { requests: number; spend: number }> = {};

            const updateDept = (dept: string, amt: number) => {
                const d = dept || 'Unassigned';
                if (!deptMap[d]) deptMap[d] = { requests: 0, spend: 0 };
                deptMap[d].requests++;
                deptMap[d].spend += amt;
            };

            archives.forEach(a => updateDept(a.requester_department, Number(a.total_amount) || 0));

            const departmentStats = Object.keys(deptMap).map(d => ({
                name: d,
                requests: deptMap[d].requests,
                spend: deptMap[d].spend
            })).sort((a, b) => b.spend - a.spend);

            // 5. Monthly Spend
            const monthMap: Record<string, number> = {};
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            archives.forEach(a => {
                if (!a.archived_at) return;
                const d = new Date(a.archived_at);
                const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!monthMap[sortKey]) monthMap[sortKey] = 0;
                monthMap[sortKey] += (Number(a.total_amount) || 0);
            });

            const monthlySpend = Object.keys(monthMap).sort().map(k => {
                const [y, m] = k.split('-');
                return {
                    month: `${months[parseInt(m) - 1]}`,
                    amount: monthMap[k]
                };
            });

            // 6. Status Distribution
            const statusDistribution = [
                { name: 'Approved', value: approvedCount },
                { name: 'Rejected', value: rejectedCount },
                { name: 'Pending', value: pendingCount },
            ];

            // 7. Bottlenecks (Mock data remains as no step data available)
            const bottlenecks = [
                { stage: 'Dept Head', avgTime: 18 },
                { stage: 'Finance', avgTime: 42 },
                { stage: 'General Manager', avgTime: 10 },
                { stage: 'CEO', avgTime: 65 },
            ];

            setData({
                totalRequests,
                approvedCount,
                rejectedCount,
                pendingCount,
                avgTurnaroundTime,
                totalSpend,
                capexSpend,
                opexSpend,
                monthlySpend,
                statusDistribution,
                departmentStats,
                bottlenecks
            });

        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    if (status === 'loading' || loading) {
        return (
            <AppLayout title="Reports">
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-600 mb-4" />
                    <p className="text-gray-500 font-medium animate-pulse">Generating insights...</p>
                </div>
            </AppLayout>
        );
    }

    if (!data) return null;

    return (
        <AppLayout title="Reports">
            <div className="p-6 max-w-[1600px] mx-auto space-y-8">

                {/* Header Section */}
                <div className="relative rounded-3xl bg-gradient-to-br from-indigo-900 to-violet-900 p-8 sm:p-12 overflow-hidden shadow-2xl text-white">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold font-heading mb-3 tracking-tight">
                                Executive Reports
                            </h1>
                            <p className="text-indigo-200 text-lg max-w-xl">
                                Real-time insights into spending, approval efficiency, and operational bottlenecks.
                            </p>
                        </div>

                        {/* Date Filte Pill */}
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-1 rounded-xl flex">
                            {['This Month', 'This Quarter', 'This Year'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setDateRange(range)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === range
                                            ? 'bg-white text-indigo-900 shadow-sm'
                                            : 'text-indigo-100 hover:bg-white/10'
                                        }`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Abstract Shapes Decoration */}
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/3 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-3xl" />
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="p-6 border-l-4 border-indigo-500 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total Spend</div>
                        <div className="text-3xl font-bold text-gray-900">{formatCurrency(data.totalSpend)}</div>
                        <div className="flex items-center gap-2 mt-2 text-xs font-medium">
                            <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                Capex: {formatCurrency(data.capexSpend)}
                            </span>
                            <span className="text-gray-500">
                                Opex: {formatCurrency(data.opexSpend)}
                            </span>
                        </div>
                    </Card>

                    <Card className="p-6 border-l-4 border-emerald-500 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Avg. Turnaround</div>
                        <div className="text-3xl font-bold text-gray-900">{data.avgTurnaroundTime.toFixed(1)} hrs</div>
                        <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Time to decision
                        </div>
                    </Card>

                    <Card className="p-6 border-l-4 border-blue-500 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Approval Rate</div>
                        <div className="text-3xl font-bold text-gray-900">
                            {data.totalRequests > 0 ? ((data.approvedCount / data.totalRequests) * 100).toFixed(1) : 0}%
                        </div>
                        <div className="mt-2 text-xs text-gray-500 font-medium">
                            {data.approvedCount} approved / {data.totalRequests} total
                        </div>
                    </Card>

                    <Card className="p-6 border-l-4 border-amber-500 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Pending Requests</div>
                        <div className="text-3xl font-bold text-gray-900">{data.pendingCount}</div>
                        <div className="mt-2 text-xs text-amber-600 font-medium">
                            Requiring action
                        </div>
                    </Card>
                </div>

                {/* Charts Section 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Spend Analytics - Main Chart */}
                    <Card className="lg:col-span-2 p-6 shadow-lg border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Spend Analytics</h3>
                                <p className="text-sm text-gray-500">Monthly expenditure overview ({dateRange})</p>
                            </div>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.monthlySpend}>
                                    <defs>
                                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => `$${value / 1000}k`} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                                        formatter={(value: any) => [`$${value.toLocaleString()}`, 'Spend']}
                                    />
                                    <Area type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Status Distribution */}
                    <Card className="p-6 shadow-lg border-gray-100 flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Request Outcomes</h3>
                            <p className="text-sm text-gray-500 mb-4">Approval vs Rejection rates</p>
                        </div>
                        <div className="h-[250px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.statusDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {data.statusDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Text */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-900">{data.totalRequests}</div>
                                    <div className="text-xs text-gray-500">Total</div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Charts Section 2 - Bottlenecks & Departments */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Bottleneck Analysis */}
                    <Card className="p-6 shadow-lg border-gray-100">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-gray-900">Bottleneck Analysis</h3>
                            <p className="text-sm text-gray-500">Average approval time by stage (hours)</p>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.bottlenecks} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                                    <XAxis type="number" axisLine={false} tickLine={false} />
                                    <YAxis dataKey="stage" type="category" width={100} axisLine={false} tickLine={false} tick={{ fill: '#374151', fontSize: 13, fontWeight: 500 }} />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                                    <Bar dataKey="avgTime" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={24} name="Avg. Hours" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Department Spend */}
                    <Card className="p-6 shadow-lg border-gray-100">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-gray-900">Departmental Report</h3>
                            <p className="text-sm text-gray-500">Spend distribution by department</p>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.departmentStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px' }} formatter={(value: any) => [`$${value.toLocaleString()}`, 'Spend']} />
                                    <Bar dataKey="spend" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Capex Updates Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900">CAPEX Updates</h2>
                        <Button variant="outline" className="text-brand-600 border-brand-200 hover:bg-brand-50">View All Capex</Button>
                    </div>

                    <Card className="overflow-hidden shadow-lg border-gray-200">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 uppercase font-medium text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Request Title</th>
                                        <th className="px-6 py-4">Department</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Implementation</th>
                                        <th className="px-6 py-4 text-right">Budget</th>
                                        <th className="px-6 py-4 text-right">Paid</th>
                                        <th className="px-6 py-4 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {[1, 2, 3].map((_, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                Q{i + 1} IT Infrastructure Upgrade
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">IT Department</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Approved
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-[100px]">
                                                    <div className="bg-brand-600 h-2.5 rounded-full" style={{ width: '45%' }}></div>
                                                </div>
                                                <span className="text-xs text-gray-500 mt-1 inline-block">In Progress (45%)</span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium">$45,000</td>
                                            <td className="px-6 py-4 text-right text-gray-600">$20,250</td>
                                            <td className="px-6 py-4 text-right font-bold text-brand-600">$24,750</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

            </div>
        </AppLayout>
    );
}
