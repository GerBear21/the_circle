import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDashboardStats, useSignatureCheck } from '@/hooks';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import animationData from '../../Office illustration.json';
import { supabase } from '@/lib/supabaseClient';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
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

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { stats, recentActivity, teamMembers, pendingForUser, loading: statsLoading } = useDashboardStats();
  const { signatureUrl, hasSignature } = useSignatureCheck();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const user = session.user as any;
  const firstName = user?.name?.split(' ')[0] || 'User';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const statsCards = [
    { label: 'Pending', value: stats.pending.toString(), icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'warning', trend: 'Awaiting action' },
    { label: 'Approved', value: stats.approved.toString(), icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'success', trend: `${stats.completionRate}% approval rate` },
    { label: 'Rejected', value: stats.rejected.toString(), icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'danger', trend: 'Declined requests' },
    { label: 'Total', value: stats.total.toString(), icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'primary', trend: 'All time' },
  ];

  return (
    <>
      <Head>
        <title>Dashboard - The Circle</title>
      </Head>

      <AppLayout title="Dashboard">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8"
        >

          {/* Hero Section */}
          <motion.div
            variants={item}
            className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1e3a8a] via-[#3b82f6] to-[#9333ea] p-10 sm:p-14 shadow-2xl shadow-indigo-500/20"
          >
            {/* Glass Background Elements */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl" />

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="flex-1 text-center lg:text-left space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
                  {getGreeting()}, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-100">
                    {firstName}!
                  </span>
                </h1>

                <p className="text-blue-50 text-lg sm:text-xl max-w-xl leading-relaxed">
                  {pendingForUser > 0 ? (
                    <>You have <span className="font-bold text-white">{pendingForUser} pending item{pendingForUser !== 1 ? 's' : ''}</span> waiting for your review. Let's get things moving!</>
                  ) : (
                    <>You're all caught up! No pending items waiting for your review.</>  
                  )}
                </p>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push('/requests/approvals')}
                  className="group relative inline-flex items-center gap-3 bg-white text-blue-600 font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-white/20 transition-all duration-300"
                >
                  Review Now
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </motion.button>
              </div>

              <div className="w-full max-w-md lg:max-w-lg relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-full blur-2xl transform scale-90" />
                <Lottie animationData={animationData} loop={true} className="relative z-10 drop-shadow-2xl" />
              </div>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsCards.map((stat, i) => (
              <motion.div
                key={i}
                variants={item}
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative bg-white/60 backdrop-blur-xl rounded-3xl p-6 border border-white/50 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden"
              >
                {/* Animated gradient background on hover */}
                <motion.div
                  className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                    stat.color === 'warning' && "bg-gradient-to-br from-amber-50/50 to-orange-50/30",
                    stat.color === 'success' && "bg-gradient-to-br from-green-50/50 to-emerald-50/30",
                    stat.color === 'danger' && "bg-gradient-to-br from-red-50/50 to-rose-50/30",
                    stat.color === 'primary' && "bg-gradient-to-br from-blue-50/50 to-indigo-50/30",
                  )}
                />

                <div className="relative z-10">
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, -5, 0], scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                      stat.color === 'warning' && "bg-warning-100 text-warning-600",
                      stat.color === 'success' && "bg-success-100 text-success-600",
                      stat.color === 'danger' && "bg-red-100 text-red-600",
                      stat.color === 'primary' && "bg-primary-100 text-primary-600",
                    )}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                    </svg>
                  </motion.div>

                  <div className="space-y-1">
                    <p className="text-gray-500 font-medium text-sm">{stat.label}</p>
                    <motion.h3
                      className="text-3xl font-bold text-gray-900"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 + 0.3, type: "spring", stiffness: 200 }}
                    >
                      {stat.value}
                    </motion.h3>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 + 0.5 }}
                    className="mt-4 flex items-center gap-2 text-xs font-medium text-gray-400"
                  >
                    <span className={cn(
                      "px-2 py-1 rounded-lg",
                      stat.trend.includes('+') ? "text-green-600 bg-green-50" : "text-gray-600 bg-gray-100"
                    )}>
                      {stat.trend}
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Activity */}
            <motion.div variants={item} className="lg:col-span-2 bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 shadow-lg">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
                  <p className="text-gray-500 text-sm">Your latest actions and updates</p>
                </div>
                <Link href="/requests/approvals" className="text-blue-600 hover:text-blue-700 font-semibold text-sm bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors">
                  View All
                </Link>
              </div>

              <div className="space-y-4">
                {statsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No recent activity yet</p>
                    <p className="text-sm mt-1">Create your first request to get started</p>
                  </div>
                ) : (
                  recentActivity.slice(0, 4).map((activity) => {
                    const creatorName = activity.creator?.display_name || activity.creator?.email?.split('@')[0] || 'Unknown';
                    const timeAgo = getTimeAgo(activity.created_at);
                    const requestType = activity.metadata?.type || 'Request';
                    const statusDisplay = activity.status.charAt(0).toUpperCase() + activity.status.slice(1);
                    
                    return (
                      <div key={activity.id} className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-white/50 border border-transparent hover:border-white/60 transition-all duration-200">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm",
                          activity.status === 'approved' && "bg-green-100 text-green-600",
                          (activity.status === 'pending' || activity.status === 'draft') && "bg-amber-100 text-amber-600",
                          activity.status === 'rejected' && "bg-red-100 text-red-600",
                        )}>
                          {creatorName.charAt(0).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{activity.title}</h4>
                            <span className="text-xs text-gray-400 font-medium">{timeAgo}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span>{creatorName}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span>{requestType}</span>
                          </div>
                        </div>

                        <div className={cn(
                          "px-3 py-1 rounded-lg text-xs font-bold",
                          activity.status === 'approved' && "bg-green-100 text-green-700",
                          (activity.status === 'pending' || activity.status === 'draft') && "bg-amber-100 text-amber-700",
                          activity.status === 'rejected' && "bg-red-100 text-red-700",
                        )}>
                          {statusDisplay}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>

            {/* Side Column */}
            <div className="space-y-8">
              {/* This Month Card */}
              <motion.div
                variants={item}
                className="relative overflow-hidden bg-gray-900 rounded-[2rem] p-8 text-white shadow-xl"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl -ml-16 -mb-16" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-medium text-purple-200">This Month</span>
                  </div>

                  <div className="space-y-2 mb-8">
                    <h3 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200">+{stats.thisMonthRequests}</h3>
                    <p className="text-purple-200">New requests this month</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Approval Rate</span>
                      <span className="font-bold text-white">{stats.completionRate}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.completionRate}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Signature Card */}
              <motion.div variants={item} className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-6 border border-white/50 shadow-lg">
                <h3 className="font-bold text-gray-900 mb-4">Digital Signature</h3>
                {signatureUrl ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signatureUrl} alt="Your Signature" className="max-h-16 opacity-80" />
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Missing Signature</p>
                        <p className="text-xs text-gray-600 mt-1 mb-3">Please set up your digital signature for approvals.</p>
                        <Link href="/profile/settings" className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-100 px-3 py-1.5 rounded-lg transition-colors inline-block">
                          Setup Now &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>

        </motion.div>
      </AppLayout>
    </>
  );
}
