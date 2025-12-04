import { AppLayout } from '@/components/layout';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export default function Reports() {
    const stats = [
        { label: 'Total Reports', value: '1,284', change: '+12%', trend: 'up', color: 'blue' },
        { label: 'Storage Used', value: '45.2 GB', change: '+2.4 GB', trend: 'up', color: 'purple' },
        { label: 'Active Users', value: '892', change: '+5%', trend: 'up', color: 'green' },
        { label: 'System Status', value: '99.9%', change: 'Stable', trend: 'neutral', color: 'emerald' },
    ];

    const reportTypes = [
        { label: 'Financial', value: 35, color: 'bg-blue-500' },
        { label: 'Operational', value: 25, color: 'bg-purple-500' },
        { label: 'HR', value: 20, color: 'bg-pink-500' },
        { label: 'Compliance', value: 15, color: 'bg-orange-500' },
        { label: 'Other', value: 5, color: 'bg-gray-400' },
    ];

    const recentReports = [
        { name: 'Q3 Financial Summary', type: 'Financial', date: 'Oct 24, 2024', size: '2.4 MB', status: 'Ready' },
        { name: 'Employee Satisfaction Survey', type: 'HR', date: 'Oct 22, 2024', size: '1.1 MB', status: 'Processing' },
        { name: 'Server Performance Log', type: 'Operational', date: 'Oct 21, 2024', size: '8.5 MB', status: 'Ready' },
        { name: 'Compliance Audit 2024', type: 'Compliance', date: 'Oct 20, 2024', size: '4.2 MB', status: 'Ready' },
        { name: 'Marketing Campaign Results', type: 'Operational', date: 'Oct 18, 2024', size: '3.7 MB', status: 'Archived' },
    ];

    return (
        <>
            <Head>
                <title>System Reports - The Circle</title>
            </Head>

            <AppLayout title="System Reports">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8"
                >
                    {/* Hero Section */}
                    <motion.div
                        variants={item}
                        className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-purple-700 p-10 sm:p-14 shadow-2xl shadow-indigo-500/20 text-white"
                    >
                        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />

                        <div className="relative z-10 max-w-2xl">
                            <h1 className="text-4xl sm:text-5xl font-bold mb-6 tracking-tight">
                                System Intelligence & <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-pink-200">
                                    Analytics Hub
                                </span>
                            </h1>
                            <p className="text-indigo-100 text-lg sm:text-xl leading-relaxed mb-8">
                                Comprehensive insights into your organization's performance.
                                Generate, export, and analyze data with precision.
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <button className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 duration-200">
                                    Generate New Report
                                </button>
                                <button className="bg-indigo-500/30 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-500/40 transition-colors">
                                    View Archives
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {stats.map((stat, i) => (
                            <motion.div
                                key={i}
                                variants={item}
                                whileHover={{ y: -5 }}
                                className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <p className="text-gray-500 font-medium text-sm">{stat.label}</p>
                                        <h3 className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                                    </div>
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                        stat.color === 'blue' && "bg-blue-100 text-blue-600",
                                        stat.color === 'purple' && "bg-purple-100 text-purple-600",
                                        stat.color === 'green' && "bg-green-100 text-green-600",
                                        stat.color === 'emerald' && "bg-emerald-100 text-emerald-600",
                                    )}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className={cn(
                                        "font-medium",
                                        stat.trend === 'up' ? "text-green-600" : "text-gray-600"
                                    )}>
                                        {stat.change}
                                    </span>
                                    <span className="text-gray-400">vs last month</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Reports Distribution */}
                        <motion.div variants={item} className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 shadow-lg">
                            <h3 className="text-xl font-bold text-gray-900 mb-6">Report Distribution</h3>
                            <div className="space-y-6">
                                {reportTypes.map((type, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between text-sm font-medium">
                                            <span className="text-gray-600">{type.label}</span>
                                            <span className="text-gray-900">{type.value}%</span>
                                        </div>
                                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${type.value}%` }}
                                                transition={{ duration: 1, delay: 0.5 + (i * 0.1) }}
                                                className={cn("h-full rounded-full", type.color)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <p className="text-sm text-gray-500 text-center">
                                    Most reports are generated for <span className="font-bold text-gray-900">Financial</span> purposes this quarter.
                                </p>
                            </div>
                        </motion.div>

                        {/* Recent Reports List */}
                        <motion.div variants={item} className="lg:col-span-2 bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 shadow-lg">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-gray-900">Recent Reports</h3>
                                <button className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm">View All</button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                            <th className="pb-4 pl-4">Name</th>
                                            <th className="pb-4">Type</th>
                                            <th className="pb-4">Date</th>
                                            <th className="pb-4">Size</th>
                                            <th className="pb-4">Status</th>
                                            <th className="pb-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {recentReports.map((report, i) => (
                                            <tr key={i} className="group hover:bg-white/50 transition-colors">
                                                <td className="py-4 pl-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                        </div>
                                                        <span className="font-medium text-gray-900">{report.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-sm text-gray-500">{report.type}</td>
                                                <td className="py-4 text-sm text-gray-500">{report.date}</td>
                                                <td className="py-4 text-sm text-gray-500">{report.size}</td>
                                                <td className="py-4">
                                                    <span className={cn(
                                                        "px-2.5 py-1 rounded-full text-xs font-medium border",
                                                        report.status === 'Ready' && "bg-green-50 text-green-700 border-green-100",
                                                        report.status === 'Processing' && "bg-amber-50 text-amber-700 border-amber-100",
                                                        report.status === 'Archived' && "bg-gray-50 text-gray-600 border-gray-100",
                                                    )}>
                                                        {report.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 pr-4 text-right">
                                                    <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </AppLayout>
        </>
    );
}
