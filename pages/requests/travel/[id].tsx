// This page redirects to the main request details page
// All request types use the same /requests/[id] page for consistency

import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { AppLayout } from '../../../components/layout';

export default function TravelAuthDetailsPage() {
    const router = useRouter();
    const { id } = router.query;

    useEffect(() => {
        if (id) {
            // Redirect to the main request details page
            router.replace(`/requests/${id}`);
        }
    }, [id, router]);

    // Show loading while redirecting
    return (
        <AppLayout title="Redirecting...">
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
        </AppLayout>
    );
}
