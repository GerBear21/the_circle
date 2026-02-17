import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
import archivesAnimation from '../../lotties/archives.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface ArchivedDocument {
    id: string;
    request_id: string;
    filename: string;
    storage_path: string;
    file_size: number;
    archived_at: string;
    request_title: string;
    request_reference: string;
    requester_name: string;
    requester_department: string | null;
    total_amount: number | null;
    currency: string | null;
    approval_completed_at: string;
    approver_count: number;
    attached_documents: any[];
    download_url: string | null;
    folder_name: string | null;
    template_id: string | null;
    category: string | null;
}

interface FolderSummary {
    folder_name: string;
    document_count: number;
    latest_archived_at: string;
    template_id: string | null;
    category: string | null;
}

export default function ArchivePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [archivedDocuments, setArchivedDocuments] = useState<ArchivedDocument[]>([]);
    const [folders, setFolders] = useState<FolderSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedArchive, setSelectedArchive] = useState<ArchivedDocument | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [viewMode, setViewMode] = useState<'folders' | 'documents'>('folders');
    const [currentFolder, setCurrentFolder] = useState<string | null>(null);

    // Filters & Sort State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState('All Time');
    const [sortBy, setSortBy] = useState('newest');
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    const fetchArchived = async () => {
        if (!session) return;
        try {
            setLoading(true);
            const response = await fetch('/api/archives');
            if (!response.ok) {
                throw new Error('Failed to fetch archived documents');
            }
            const data = await response.json();
            setArchivedDocuments(data.archives || []);
            
            // Group documents by folder
            const folderMap = new Map<string, FolderSummary>();
            (data.archives || []).forEach((doc: ArchivedDocument) => {
                const folderName = doc.folder_name || 'Uncategorized';
                if (!folderMap.has(folderName)) {
                    folderMap.set(folderName, {
                        folder_name: folderName,
                        document_count: 0,
                        latest_archived_at: doc.archived_at,
                        template_id: doc.template_id,
                        category: doc.category,
                    });
                }
                const folder = folderMap.get(folderName)!;
                folder.document_count++;
                if (new Date(doc.archived_at) > new Date(folder.latest_archived_at)) {
                    folder.latest_archived_at = doc.archived_at;
                }
            });
            setFolders(Array.from(folderMap.values()));
        } catch (err: any) {
            console.error('Error fetching archive:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchArchived();
        }
    }, [session, status]);

    const syncArchives = async () => {
        setSyncing(true);
        setSyncMessage(null);
        try {
            const response = await fetch('/api/archives/backfill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            const msg = data.errors?.length
                ? `${data.message}. Errors: ${data.errors.join('; ')}`
                : data.message;
            setSyncMessage(msg);
            await fetchArchived();
        } catch (err: any) {
            setSyncMessage(`Error: ${err.message}`);
        } finally {
            setSyncing(false);
            setTimeout(() => setSyncMessage(null), 5000);
        }
    };

    // Filter and sort archived documents
    const filteredData = archivedDocuments.filter((archive) => {
        // Folder Filter
        if (currentFolder) {
            const folderName = archive.folder_name || 'Uncategorized';
            if (folderName !== currentFolder) return false;
        }

        // Search Filter
        const matchesSearch =
            archive.request_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            archive.request_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
            archive.requester_name.toLowerCase().includes(searchQuery.toLowerCase());

        // Date Filter
        let matchesDate = true;
        const archivedDate = new Date(archive.archived_at);
        const now = new Date();
        if (filterDate === 'This Month') {
            matchesDate = archivedDate.getMonth() === now.getMonth() && archivedDate.getFullYear() === now.getFullYear();
        } else if (filterDate === 'Last 3 Months') {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            matchesDate = archivedDate >= threeMonthsAgo;
        } else if (filterDate === 'This Year') {
            matchesDate = archivedDate.getFullYear() === now.getFullYear();
        }

        return matchesSearch && matchesDate;
    }).sort((a, b) => {
        // Sort Logic
        switch (sortBy) {
            case 'newest':
                return new Date(b.archived_at).getTime() - new Date(a.archived_at).getTime();
            case 'oldest':
                return new Date(a.archived_at).getTime() - new Date(b.archived_at).getTime();
            case 'amount_high':
                return (Number(b.total_amount) || 0) - (Number(a.total_amount) || 0);
            case 'amount_low':
                return (Number(a.total_amount) || 0) - (Number(b.total_amount) || 0);
            case 'title_az':
                return a.request_title.localeCompare(b.request_title);
            default:
                return 0;
        }
    });

    // Stats Calculation
    const totalRequests = filteredData.length;
    const totalValue = filteredData.reduce((sum, archive) => sum + (Number(archive.total_amount) || 0), 0);
    const currency = filteredData[0]?.currency || '$';

    const viewArchive = (archive: ArchivedDocument, e: React.MouseEvent) => {
        e.stopPropagation();
        if (archive.download_url) {
            window.open(archive.download_url, '_blank');
        }
    };

    const downloadArchive = (archive: ArchivedDocument, e: React.MouseEvent) => {
        e.stopPropagation();
        if (archive.download_url) {
            const link = document.createElement('a');
            link.href = archive.download_url;
            link.download = archive.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const openDetailModal = (archive: ArchivedDocument) => {
        setSelectedArchive(archive);
        setShowDetailModal(true);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (status === 'loading' || (loading && !archivedDocuments.length)) {
        return (
            <AppLayout title="Archives">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                </div>
            </AppLayout>
        );
    }

    if (!session) return null;

    return (
        <AppLayout title="Archives">
            <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">

                {/* Header Section */}
                <div className="rounded-3xl bg-gradient-to-br from-brand-50 via-white to-purple-50/10 border border-brand-100/50 p-6 sm:p-10 relative overflow-hidden shadow-sm">
                    <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                        <div className="w-60 h-60 sm:w-72 sm:h-72 flex-shrink-0 transition-transform hover:scale-105 duration-500">
                            <Lottie
                                animationData={archivesAnimation}
                                loop={true}
                                className="w-full h-full drop-shadow-xl"
                            />
                        </div>
                        <div className="flex-1 text-center md:text-left space-y-4">
                            <h1 className="text-4xl font-bold text-gray-900 font-heading tracking-tight">
                                Approval Archives
                            </h1>
                            <p className="text-gray-600 text-lg max-w-2xl leading-relaxed">
                                Access your secure history of approved requests. Download official PDF summaries and track past expenditures in one place.
                            </p>

                            {/* Quick Stats in Header */}
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 pt-4">
                                <div className="px-5 py-3 bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
                                    <div className="text-sm text-gray-500 font-medium">Total Archived</div>
                                    <div className="text-2xl font-bold text-brand-600">{totalRequests} Requests</div>
                                </div>
                                <div className="px-5 py-3 bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
                                    <div className="text-sm text-gray-500 font-medium">Total Value</div>
                                    <div className="text-2xl font-bold text-gray-900">{currency} {totalValue.toLocaleString()}</div>
                                </div>
                                <button
                                    onClick={syncArchives}
                                    disabled={syncing}
                                    className="px-5 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-2xl shadow-sm font-medium text-sm flex items-center gap-2 transition-colors"
                                >
                                    <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {syncing ? 'Syncing...' : 'Sync Archives'}
                                </button>
                            </div>
                            {syncMessage && (
                                <div className={`mt-3 text-sm font-medium px-4 py-2 rounded-xl inline-block ${syncMessage.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {syncMessage}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Background Decoration */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-brand-100/40 to-purple-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                </div>

                {/* Breadcrumb Navigation */}
                {currentFolder && (
                    <div className="flex items-center gap-2 text-sm">
                        <button
                            onClick={() => {
                                setCurrentFolder(null);
                                setViewMode('folders');
                            }}
                            className="text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            All Folders
                        </button>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-700 font-medium">{currentFolder}</span>
                    </div>
                )}

                {/* Controls Bar: Search, Filter, Sort */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row items-center gap-4 sticky top-4 z-20">
                    {/* View Mode Toggle */}
                    {!currentFolder && (
                        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('folders')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    viewMode === 'folders'
                                        ? 'bg-white text-brand-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                    Folders
                                </div>
                            </button>
                            <button
                                onClick={() => setViewMode('documents')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    viewMode === 'documents'
                                        ? 'bg-white text-brand-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    All Documents
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Search */}
                    <div className="relative flex-1 w-full">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by title, reference, or requester..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
                        />
                    </div>

                    {/* Filters & Sort Group */}
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <select
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 cursor-pointer min-w-[140px]"
                        >
                            <option value="All Time">All Time</option>
                            <option value="This Month">This Month</option>
                            <option value="Last 3 Months">Last 3 Months</option>
                            <option value="This Year">This Year</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 cursor-pointer min-w-[140px]"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="amount_high">Highest Amount</option>
                            <option value="amount_low">Lowest Amount</option>
                            <option value="title_az">A-Z</option>
                        </select>
                    </div>
                </div>

                {/* Folder Grid View */}
                {viewMode === 'folders' && !currentFolder && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {folders.map((folder) => (
                            <button
                                key={folder.folder_name}
                                onClick={() => {
                                    setCurrentFolder(folder.folder_name);
                                    setViewMode('documents');
                                }}
                                className="group bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-brand-400 hover:shadow-lg hover:shadow-brand-500/10 transition-all duration-300 text-left"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                        <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-brand-600 transition-colors truncate mb-1">
                                            {folder.folder_name}
                                        </h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <span className="font-medium">{folder.document_count}</span>
                                            <span>{folder.document_count === 1 ? 'document' : 'documents'}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            Last updated {formatDate(folder.latest_archived_at)}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Content Grid */}
                {(viewMode === 'documents' || currentFolder) && (
                    <>
                {error ? (
                    <Card className="bg-red-50 border-red-200 p-6 text-center">
                        <p className="text-red-600 font-medium">Error loading archives: {error}</p>
                    </Card>
                ) : filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">No archived documents found</h3>
                        <p className="text-gray-500 mt-2 max-w-sm text-center">
                            Approved requests will automatically appear here with their signed PDF documents.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-6"
                            onClick={() => {
                                setSearchQuery('');
                                setFilterDate('All Time');
                            }}
                        >
                            Clear all filters
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {filteredData.map((archive) => (
                            <div
                                key={archive.id}
                                onClick={() => openDetailModal(archive)}
                                className="group bg-white rounded-2xl border border-gray-100 p-5 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden"
                            >
                                <div className="flex items-start gap-4">
                                    {/* Document Icon */}
                                    <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 uppercase tracking-wide">
                                                    Signed
                                                </span>
                                                <span className="text-xs text-gray-400">• {formatDateTime(archive.archived_at)}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 font-mono hidden sm:inline-block">
                                                {archive.request_reference}
                                            </span>
                                        </div>

                                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-brand-600 transition-colors truncate mb-1">
                                            {archive.request_title}
                                        </h3>

                                        <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-gray-500 mb-4">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-bold">
                                                    {archive.requester_name.charAt(0)}
                                                </div>
                                                <span className="truncate max-w-[150px]">{archive.requester_name}</span>
                                            </div>

                                            {archive.total_amount && (
                                                <div className="flex items-center gap-1.5 font-medium text-gray-700 bg-gray-50 px-2 py-0.5 rounded-md">
                                                    <span>{archive.currency || '$'}</span>
                                                    <span>{Number(archive.total_amount).toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                            <div className="flex items-center gap-3 text-xs text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {archive.approver_count} sigs
                                                </span>
                                                {archive.attached_documents?.length > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                        </svg>
                                                        {archive.attached_documents.length} files
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => viewArchive(archive, e)}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                                                    title="View Document"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => downloadArchive(archive, e)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 font-medium text-xs hover:bg-brand-100 transition-colors"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    PDF
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                    </>
                )}

                {/* Detail Modal */}
                {showDetailModal && selectedArchive && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDetailModal(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-4 text-white">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm opacity-80 font-medium">{selectedArchive.request_reference}</div>
                                        <h2 className="text-xl font-bold">{selectedArchive.request_title}</h2>
                                    </div>
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Requester</div>
                                        <div className="font-semibold text-gray-900">{selectedArchive.requester_name}</div>
                                        {selectedArchive.requester_department && (
                                            <div className="text-sm text-gray-600">{selectedArchive.requester_department}</div>
                                        )}
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Archived On</div>
                                        <div className="font-semibold text-gray-900">{formatDateTime(selectedArchive.archived_at)}</div>
                                    </div>
                                    {selectedArchive.total_amount && (
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Amount</div>
                                            <div className="font-bold text-gray-900 text-lg">
                                                {selectedArchive.currency || '$'} {Number(selectedArchive.total_amount).toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Approvers</div>
                                        <div className="font-semibold text-gray-900">{selectedArchive.approver_count} signature{selectedArchive.approver_count !== 1 ? 's' : ''}</div>
                                    </div>
                                </div>

                                {/* Attached Documents */}
                                {selectedArchive.attached_documents && selectedArchive.attached_documents.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Attached Documents</h3>
                                        <div className="space-y-2">
                                            {selectedArchive.attached_documents.map((doc: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                        </svg>
                                                        <span className="text-sm font-medium text-gray-700">{doc.filename}</span>
                                                    </div>
                                                    {doc.download_url && (
                                                        <a
                                                            href={doc.download_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                                                        >
                                                            Download
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
                                <button
                                    onClick={() => router.push(`/requests/${selectedArchive.request_id}`)}
                                    className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                                >
                                    View Original Request
                                </button>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={(e) => {
                                            viewArchive(selectedArchive, e);
                                            setShowDetailModal(false);
                                        }}
                                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-100 transition-colors"
                                    >
                                        View Document
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            downloadArchive(selectedArchive, e);
                                            setShowDetailModal(false);
                                        }}
                                        className="px-4 py-2 rounded-lg bg-brand-600 text-white font-medium text-sm hover:bg-brand-700 transition-colors flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download PDF
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
