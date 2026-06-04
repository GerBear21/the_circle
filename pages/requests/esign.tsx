import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AppLayout } from '../../components/layout';
import { Button } from '../../components/ui';
import { FileSignature } from 'lucide-react';

const ESignModal = dynamic(() => import('../../components/esign/ESignModal'), { ssr: false });

export default function ESignPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showModal, setShowModal] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  const handleComplete = async (signedPdfBlob: Blob, filename: string) => {
    const url = URL.createObjectURL(signedPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (status === 'loading') {
    return (
      <AppLayout title="E-Sign PDF">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="E-Sign PDF">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-border p-8 sm:p-12 text-center flex flex-col items-center">
          <span className="w-12 h-12 flex items-center justify-center text-neutral-700">
            <FileSignature className="w-7 h-7" strokeWidth={1.5} />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-text-primary tracking-tight">E-Sign a PDF</h1>
          <p className="mt-1.5 text-sm sm:text-base text-text-secondary max-w-md">
            Upload a PDF document, place your signature, and download the signed copy — no approval workflow required.
          </p>
          <Button variant="primary" className="mt-6" onClick={() => setShowModal(true)}>
            Upload a PDF to sign
          </Button>
        </div>
      </div>

      <ESignModal isOpen={showModal} onClose={() => setShowModal(false)} onComplete={handleComplete} />
    </AppLayout>
  );
}
