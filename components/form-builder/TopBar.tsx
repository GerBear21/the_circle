import React, { useState } from 'react';
import { useEditor } from '@craftjs/core';
import { Button } from '../ui';
import { useRouter } from 'next/router';

export const TopBar = () => {
    const { query } = useEditor();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        const json = query.serialize();
        console.log('Saved JSON:', json);
        // Here we would call an API to save the form
        // await fetch('/api/save-form', { method: 'POST', body: json });

        // Simulate save delay
        await new Promise(resolve => setTimeout(resolve, 800));
        setLoading(false);

        // Redirect to workflow page as per original flow
        router.push('/requests/new/workflow');
    };

    return (
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="secondary" onClick={() => router.back()} className="!py-1.5 h-9">
                    Exit
                </Button>
            </div>
            <div className="flex items-center gap-3">
                <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={loading}
                    className="!py-1.5 h-9"
                >
                    {loading ? 'Saving...' : 'Save Form'}
                </Button>
            </div>
        </div>
    );
};
