import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { AppLayout } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { motion } from 'framer-motion';

// --- Mock Data ---

const generateChartData = (points = 20) => {
    return Array.from({ length: points }).map((_, i) => ({
        value: 30 + Math.random() * 40 + (Math.sin(i / 3) * 20), // Random wave
        timestamp: new Date(Date.now() - (points - i) * 60000).toISOString(),
    }));
};

const RECENT_ACTIVITY = [
    { id: 1, user: 'Admin', action: 'System Update', target: 'Core Module', time: '2 mins ago', status: 'success' },
    { id: 2, user: 'Sarah Connor', action: 'Login Attempt', target: 'Main Portal', time: '15 mins ago', status: 'warning' },
    { id: 3, user: 'System', action: 'Backup Created', target: 'Daily Backup', time: '1 hour ago', status: 'success' },
    { id: 4, user: 'John Doe', action: 'File Upload', target: 'Project X', time: '2 hours ago', status: 'success' },
    { id: 5, user: 'Jane Smith', action: 'Permission Change', target: 'User Group A', time: '3 hours ago', status: 'danger' },
];

// --- Components ---

const StatCard = ({ title, value, subtext, trend, color = 'primary' }: any) => {
    const colors: any = {
        primary: 'bg-primary-50 text-primary-700 border-primary-100',
        success: 'bg-success-50 text-success-700 border-success-100',
        warning: 'bg-warning-50 text-warning-700 border-warning-100',
        danger: 'bg-danger-50 text-danger-700 border-danger-100',
    };

    return (
        <Card className={`border-l-4 ${colors[color].replace('bg-', 'border-l-').split(' ')[2]} hover:shadow-md transition-all duration-300`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-text-secondary">{title}</p>
                    <h3 className="text-2xl font-bold text-text-primary mt-1">{value}</h3>
                </div>
                <div className={`p-2 rounded-lg ${colors[color]}`}>
                    {/* Icon placeholder based on color/type could go here */}
                    <div className="w-4 h-4 rounded-full bg-current opacity-20" />
                </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
                <span className={trend > 0 ? 'text-success-600' : 'text-danger-600'}>
                    {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                </span>
                <span className="text-text-secondary ml-2">{subtext}</span>
            </div>
        </Card>
    );
};

const ActivityItem = ({ activity }: any) => {
    const statusColors: any = {
        success: 'bg-success-100 text-success-700',
        warning: 'bg-warning-100 text-warning-700',
        danger: 'bg-danger-100 text-danger-700',
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-border"
        >
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${statusColors[activity.status] || 'bg-gray-100 text-gray-600'}`}>
                    {activity.user.charAt(0)}
                </div>
                <div>
                    <p className="text-sm font-medium text-text-primary">
                        <span className="font-bold">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-text-secondary">
                        {activity.target} • {activity.time}
                    </p>
                </div>
            </div>
            <div className={`h-2 w-2 rounded-full ${activity.status === 'success' ? 'bg-success' : activity.status === 'warning' ? 'bg-warning' : 'bg-danger'}`} />
        </motion.div>
    );
};

const LiveChart = () => {
    const [data, setData] = useState(generateChartData(30));

    useEffect(() => {
        const interval = setInterval(() => {
            setData(prev => {
                const next = [...prev.slice(1), {
                    value: 30 + Math.random() * 40 + (Math.sin(Date.now() / 1000) * 20),
                    timestamp: new Date().toISOString()
                }];
                return next;
            });
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const points = useMemo(() => {
        const max = 100;
        const min = 0;
        const width = 100; // percent
        const height = 100; // percent

        return data.map((d, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((d.value - min) / (max - min)) * height;
            return `${x},${y}`;
        }).join(' ');
    }, [data]);

    return (
        <div className="relative h-64 w-full overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <motion.path
                    d={`M0,100 L${points} L100,100 Z`}
                    fill="url(#chartGradient)"
                    className="transition-all duration-500 ease-linear"
                />
                <motion.polyline
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="0.5"
                    points={points}
                    className="transition-all duration-500 ease-linear"
                />
            </svg>
            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between text-xs text-text-secondary opacity-20">
                <div className="border-b border-gray-400 w-full h-full flex items-end pb-1">0%</div>
                <div className="border-b border-gray-400 w-full h-full absolute top-1/4"></div>
                <div className="border-b border-gray-400 w-full h-full absolute top-2/4"></div>
                <div className="border-b border-gray-400 w-full h-full absolute top-3/4"></div>
            </div>
        </div>
    );
};

export default function ActivityMonitor() {
    return (
        <>
            <Head>
                <title>Activity Monitor - The Circle</title>
            </Head>

            <AppLayout title="System Activity Monitor">
                <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-text-primary font-heading">Activity Monitor</h1>
                            <p className="text-text-secondary mt-1">Real-time system performance and user activity tracking.</p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline">Download Logs</Button>
                            <Button>Refresh Data</Button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard
                            title="System Load"
                            value="42%"
                            subtext="vs last hour"
                            trend={5.2}
                            color="primary"
                        />
                        <StatCard
                            title="Active Users"
                            value="1,284"
                            subtext="vs last hour"
                            trend={12.5}
                            color="success"
                        />
                        <StatCard
                            title="Memory Usage"
                            value="6.4 GB"
                            subtext="of 16 GB"
                            trend={-2.4}
                            color="warning"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Chart Section */}
                        <Card className="lg:col-span-2 p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-text-primary">System Performance</h3>
                                <select className="bg-gray-50 border border-border rounded-lg text-sm px-3 py-1 text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20">
                                    <option>Last Hour</option>
                                    <option>Last 24 Hours</option>
                                    <option>Last 7 Days</option>
                                </select>
                            </div>
                            <LiveChart />
                        </Card>

                        {/* Recent Activity Feed */}
                        <Card className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-text-primary">Recent Activity</h3>
                                <Button variant="ghost" size="sm" className="text-primary hover:text-primary-hover">View All</Button>
                            </div>
                            <div className="space-y-2">
                                {RECENT_ACTIVITY.map(activity => (
                                    <ActivityItem key={activity.id} activity={activity} />
                                ))}
                            </div>
                        </Card>
                    </div>

                </div>
            </AppLayout>
        </>
    );
}
