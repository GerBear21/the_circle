import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function RequestsIndex() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/requests/all');
    }, [router]);

    return null;
}
