import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AppLayout } from '@/components/layout';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSignatureCheck } from '@/hooks';
import { useState, useEffect } from 'react';
import dashboardAnimation from '@/lotties/Dashboard.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

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
  return date.toLocaleDateString('en-US');
}

function TimeAgo({ dateString }: { dateString: string }) {
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeAgo(getTimeAgo(dateString));
    
    const interval = setInterval(() => {
      setTimeAgo(getTimeAgo(dateString));
    }, 60000);
    
    return () => clearInterval(interval);
  }, [dateString]);

  if (!mounted) return null;
  
  return <>{timeAgo}</>;
}

interface DashboardStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  thisMonthRequests: number;
  completionRate: number;
}

interface RecentActivity {
  id: string;
  title: string;
  status: string;
  created_at: string;
  creator: {
    display_name: string | null;
    email: string;
  } | null;
  metadata: Record<string, any>;
}

interface DashboardProps {
  initialStats: DashboardStats;
  initialRecentActivity: RecentActivity[];
  initialPendingForUser: number;
  userName: string;
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

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const user = session.user as any;
  const organizationId = user.org_id;
  const userId = user.id;

  let stats: DashboardStats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
    thisMonthRequests: 0,
    completionRate: 0,
  };
  let recentActivity: RecentActivity[] = [];
  let pendingForUser = 0;

  try {
    if (organizationId) {
      // Fetch all requests for the organization (excluding other users' drafts)
      const { data: requests } = await supabaseAdmin
        .from('requests')
        .select('id, status, created_at, creator_id')
        .eq('organization_id', organizationId);

      // Filter out drafts that don't belong to the current user
      const allRequests = (requests || []).filter(r => {
        if (r.status === 'draft') {
          return r.creator_id === userId;
        }
        return true;
      });
      
      // Calculate stats (drafts are NOT counted as pending - they are separate)
      stats.pending = allRequests.filter(r => r.status === 'pending').length;
      stats.approved = allRequests.filter(r => r.status === 'approved').length;
      stats.rejected = allRequests.filter(r => r.status === 'rejected').length;
      // Exclude drafts from total count for organization-wide stats
      stats.total = allRequests.filter(r => r.status !== 'draft').length;

      // This month's requests
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      stats.thisMonthRequests = allRequests.filter(
        r => new Date(r.created_at) >= startOfMonth
      ).length;

      // Completion rate
      const completed = stats.approved + stats.rejected;
      stats.completionRate = completed > 0 ? Math.round((stats.approved / completed) * 100) : 0;

      // Fetch pending approvals for the current user
      if (userId) {
        const { data: pendingSteps } = await supabaseAdmin
          .from('request_steps')
          .select('id')
          .eq('approver_user_id', userId)
          .eq('status', 'pending');
        
        pendingForUser = pendingSteps?.length || 0;
      }

      // Fetch recent activity with request_steps for visibility filtering
      const { data: recentRequests } = await supabaseAdmin
        .from('requests')
        .select(`
          id,
          title,
          status,
          created_at,
          metadata,
          creator_id,
          creator:app_users!requests_creator_id_fkey (
            display_name,
            email
          ),
          request_steps (
            approver_user_id,
            status
          )
        `)
        .eq('organization_id', organizationId)
        .neq('status', 'draft') // Exclude all drafts from recent activity
        .order('created_at', { ascending: false })
        .limit(50); // Fetch more to filter down

      // SEQUENTIAL APPROVAL VISIBILITY: Filter requests user can see
      // User can see if: creator, watcher, or approver with non-waiting step
      const filteredRequests = (recentRequests || []).filter((req: any) => {
        // Creator can always see
        if (req.creator_id === userId) return true;
        
        // Check if user is a watcher
        const watcherIds = req.metadata?.watchers || [];
        const isWatcher = Array.isArray(watcherIds) && watcherIds.some((w: any) => 
          typeof w === 'string' ? w === userId : w?.id === userId
        );
        if (isWatcher) return true;
        
        // Check if user is an approver with non-waiting step
        const userStep = req.request_steps?.find(
          (step: any) => step.approver_user_id === userId
        );
        if (userStep && userStep.status !== 'waiting') return true;
        
        return false;
      }).slice(0, 10); // Take only first 10 after filtering

      recentActivity = filteredRequests.map((req: any) => ({
        ...req,
        creator: Array.isArray(req.creator) ? req.creator[0] : req.creator,
      })) as RecentActivity[];
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  }

  return {
    props: {
      initialStats: stats,
      initialRecentActivity: recentActivity,
      initialPendingForUser: pendingForUser,
      userName: user.name || 'User',
    },
  };
};

export default function Dashboard({ 
  initialStats, 
  initialRecentActivity, 
  initialPendingForUser,
  userName 
}: DashboardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { signatureUrl, hasSignature } = useSignatureCheck();

  // Use SSR data directly - no loading state needed for initial render
  const stats = initialStats;
  const recentActivity = initialRecentActivity;
  const pendingForUser = initialPendingForUser;
  const statsLoading = false;

  const firstName = userName?.split(' ')[0] || 'User';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const statsCards = [
    { label: 'Pending', value: stats.pending.toString(), icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', color: 'warning', trend: 'Awaiting action' },
    { label: 'Approved', value: stats.approved.toString(), icon: 'M5 13l4 4L19 7', color: 'success', trend: `${stats.completionRate}% approval rate` },
    { label: 'Rejected', value: stats.rejected.toString(), icon: 'M6 18L18 6M6 6l12 12', color: 'danger', trend: 'Declined requests' },
    { label: 'Total', value: stats.total.toString(), icon: 'M4 6h16M4 12h16M4 18h16', color: 'primary', trend: 'All time' },
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
          <div
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-500 via-blue-400 to-indigo-400 p-8 sm:p-10 shadow-lg shadow-blue-500/10"
          >
            {/* Subtle background accents */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-blue-300/10 rounded-full blur-3xl" />

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="flex-1 text-center lg:text-left space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-white text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
                  {getGreeting()}, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-100">
                    {firstName}!
                  </span>
                </h1>

                <p className="text-blue-50 text-base sm:text-lg max-w-xl">
                  {pendingForUser > 0 ? (
                    <>You have <span className="font-bold text-white">{pendingForUser} pending item{pendingForUser !== 1 ? 's' : ''}</span> waiting for your review. Let's get things moving!</>
                  ) : (
                    <>You're all caught up! No pending items waiting for your review.</>  
                  )}
                </p>

                <button
                  onClick={() => router.push('/approvals')}
                  className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  Review Now
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>

              {/* Lottie Animation */}
              <div className="hidden lg:block w-64 h-64 xl:w-80 xl:h-80">
                <Lottie animationData={dashboardAnimation} loop={true} className="w-full h-full" />
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsCards.map((stat, i) => (
              <div
                key={i}
                className="group bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    stat.color === 'warning' && "bg-amber-50 text-amber-600",
                    stat.color === 'success' && "bg-green-50 text-green-600",
                    stat.color === 'danger' && "bg-red-50 text-red-600",
                    stat.color === 'primary' && "bg-blue-50 text-blue-600",
                  )}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                    {stat.trend}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                </div>
              </div>
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
                <Link href="/requests/all" className="text-blue-600 hover:text-blue-700 font-semibold text-sm bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors">
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
                            <span className="text-xs text-gray-400 font-medium"><TimeAgo dateString={activity.created_at} /></span>
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
