import { useState, useRef, useCallback, useEffect } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import PinVerificationModal from '../PinVerificationModal';
import { useUserSignature } from '../../hooks/useUserSignature';

// =============================================================================
// pdf.js loader — bypasses webpack entirely.
//
// Background: react-pdf v10 + pdfjs-dist v5 ships an ESM-only `pdf.mjs`. When
// webpack bundles it, the CJS interop wrapper crashes with
// "Object.defineProperty called on non-object" inside `__webpack_require__.r`,
// the chunk fails to load, and the e-sign editor hangs forever. We tried
// `transpilePackages`, `type: 'javascript/auto'`, `fullySpecified: false`, and
// none of them fix it for Next 14.2 + react-pdf 10.
//
// The fix: load pdfjs-dist at runtime from /public via a dynamic import marked
// with /* webpackIgnore: true */. Webpack leaves the import statement alone,
// the browser fetches /pdf.min.mjs natively as an ES module, and we get a real
// ESM namespace back — no CJS interop, no webpack runtime involved at all.
//
// Make sure these two files exist in public/ and are the SAME version:
//   public/pdf.min.mjs        (the library)
//   public/pdf.worker.min.mjs (the worker)
// Both are copied verbatim from node_modules/pdfjs-dist/build/.
// =============================================================================

interface PdfJsLib {
  getDocument: (src: { data: Uint8Array } | { url: string }) => { promise: Promise<PdfJsDocument> };
  GlobalWorkerOptions: { workerSrc: string };
  version: string;
}

interface PdfJsDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfJsPage>;
  destroy: () => Promise<void>;
}

interface PdfJsPage {
  getViewport: (opts: { scale: number }) => PdfJsViewport;
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfJsViewport }) => { promise: Promise<void>; cancel?: () => void };
}

interface PdfJsViewport {
  width: number;
  height: number;
}

let pdfjsLibPromise: Promise<PdfJsLib> | null = null;
function loadPdfJs(): Promise<PdfJsLib> {
  if (pdfjsLibPromise) return pdfjsLibPromise;
  pdfjsLibPromise = (async () => {
    // The /* webpackIgnore: true */ comment is REQUIRED. Without it, webpack
    // tries to bundle the file and we hit the original interop bug again.
    // @ts-expect-error - runtime import served from /public, not a real module path
    const mod = (await import(/* webpackIgnore: true */ '/pdf.min.mjs')) as unknown as PdfJsLib;
    mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    // eslint-disable-next-line no-console
    console.log('[esign] pdfjs-dist loaded via webpackIgnore', { version: mod.version, workerSrc: mod.GlobalWorkerOptions.workerSrc });
    return mod;
  })().catch((err) => {
    pdfjsLibPromise = null; // allow retry
    // eslint-disable-next-line no-console
    console.error('[esign] failed to load pdfjs-dist from /pdf.min.mjs', err);
    throw err;
  });
  return pdfjsLibPromise;
}

interface PdfSignatureEditorProps {
  pdfUrl: string;
  onSave: (signedPdfBlob: Blob) => void;
  onCancel: () => void;
}

interface PlacedElement {
  id: string;
  type: 'signature' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  content?: string;
  color?: string;
  fontSize?: number;
}

const SIGNATURE_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#1e40af' },
  { name: 'Navy', value: '#1e3a5f' },
  { name: 'Dark Gray', value: '#374151' },
];

interface DiagnosticEntry {
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  detail?: unknown;
}

export default function PdfSignatureEditor({ pdfUrl, onSave, onCancel }: PdfSignatureEditorProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [placedElements, setPlacedElements] = useState<PlacedElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [signatureColor, setSignatureColor] = useState('#000000');
  const [textColor, setTextColor] = useState('#000000');
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [activeMode, setActiveMode] = useState<'select' | 'signature' | 'text'>('select');
  const [saving, setSaving] = useState(false);
  // originalWidth/originalHeight of the PDF page in PDF points (scale-independent)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  // --- Diagnostics ---------------------------------------------------------
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(true);
  const [workerProbe, setWorkerProbe] = useState<{ status: string; contentType?: string } | null>(null);
  const [libProbe, setLibProbe] = useState<{ status: string; contentType?: string } | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfJsDocument | null>(null);
  const [renderingPage, setRenderingPage] = useState(false);

  const log = useCallback((level: DiagnosticEntry['level'], message: string, detail?: unknown) => {
    const entry: DiagnosticEntry = { ts: Date.now(), level, message, detail };
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[esign] ${message}`, detail ?? '');
    setDiagnostics(prev => [...prev, entry].slice(-50));
  }, []);

  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { signatureUrl, hasSignature, loading: signatureLoading } = useUserSignature();

  // ---------------------------------------------------------------------------
  // Boot: probe assets, fetch PDF bytes, load pdfjs, parse the document.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let loadedDoc: PdfJsDocument | null = null;

    log('info', 'mounted', { pdfUrl });

    // Probe both /public assets so we know they're reachable.
    fetch('/pdf.worker.min.mjs', { method: 'HEAD' })
      .then(r => {
        const probe = { status: `${r.status} ${r.statusText}`, contentType: r.headers.get('content-type') || undefined };
        if (!cancelled) setWorkerProbe(probe);
        log(r.ok ? 'info' : 'error', 'worker probe', probe);
      })
      .catch(err => {
        if (!cancelled) setWorkerProbe({ status: `fetch failed: ${err?.message || err}` });
        log('error', 'worker probe failed', err);
      });

    fetch('/pdf.min.mjs', { method: 'HEAD' })
      .then(r => {
        const probe = { status: `${r.status} ${r.statusText}`, contentType: r.headers.get('content-type') || undefined };
        if (!cancelled) setLibProbe(probe);
        log(r.ok ? 'info' : 'error', 'pdfjs lib probe', probe);
      })
      .catch(err => {
        if (!cancelled) setLibProbe({ status: `fetch failed: ${err?.message || err}` });
        log('error', 'pdfjs lib probe failed', err);
      });

    if (!pdfUrl) {
      log('error', 'no pdfUrl provided');
      setLoadError('No PDF URL was provided to the editor.');
      return;
    }

    (async () => {
      try {
        log('info', 'fetching pdf bytes from blob url');
        const r = await fetch(pdfUrl);
        log('info', 'fetch response', { ok: r.ok, status: r.status, type: r.headers.get('content-type') });
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching PDF`);
        const bytes = await r.arrayBuffer();
        if (cancelled) return;
        log('info', 'pdf bytes loaded', { byteLength: bytes.byteLength });
        if (bytes.byteLength === 0) throw new Error('PDF file is empty (0 bytes)');

        const head = new Uint8Array(bytes.slice(0, 5));
        const magic = String.fromCharCode(...head);
        if (magic !== '%PDF-') log('warn', 'file does not start with %PDF- magic', { magic });

        setPdfBytes(bytes);

        log('info', 'loading pdfjs library');
        const pdfjsLib = await loadPdfJs();
        if (cancelled) return;
        log('info', 'pdfjs loaded', { version: pdfjsLib.version });

        // pdf.js transfers (detaches) the TypedArray we hand it, so clone.
        const docTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) });
        const doc = await docTask.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        loadedDoc = doc;
        log('info', 'document parsed', { numPages: doc.numPages });
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoadError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        log('error', 'failed to load pdf', { message: msg, error: err });
        setLoadError(msg);
      }
    })();

    return () => {
      cancelled = true;
      if (loadedDoc) {
        loadedDoc.destroy().catch(() => {});
      }
    };
  }, [pdfUrl, log]);

  // ---------------------------------------------------------------------------
  // Render the current page to the canvas whenever page or scale changes.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: { cancel?: () => void } | null = null;

    (async () => {
      try {
        setRenderingPage(true);
        log('info', 'rendering page', { page: currentPage, scale });
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        // Capture the unscaled (scale=1) viewport for coordinate math when saving.
        const baseViewport = page.getViewport({ scale: 1 });
        setPageSize({ width: baseViewport.width, height: baseViewport.height });

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const task = page.render({ canvasContext: ctx, viewport });
        renderTask = task;
        await task.promise;
        if (cancelled) return;
        log('info', 'page rendered', { page: currentPage });
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        // pdf.js throws "Rendering cancelled" when we cancel — that's fine.
        if (!msg.toLowerCase().includes('cancel')) {
          log('error', 'page render error', { message: msg });
          setLoadError(`Failed to render page: ${msg}`);
        }
      } finally {
        if (!cancelled) setRenderingPage(false);
      }
    })();

    return () => {
      cancelled = true;
      if (renderTask?.cancel) renderTask.cancel();
    };
  }, [pdfDoc, currentPage, scale, log]);

  const handleAddSignature = () => {
    if (!hasSignature) {
      alert('Please set up your signature in your profile settings first.');
      return;
    }
    if (!pinVerified) {
      setShowPinModal(true);
      return;
    }
    setActiveMode('signature');
  };

  const handlePinVerified = () => {
    setShowPinModal(false);
    setPinVerified(true);
    setActiveMode('signature');
  };

  const handleAddText = () => {
    setActiveMode('text');
    setShowTextInput(true);
  };

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeMode === 'select') return;

    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (activeMode === 'signature' && signatureUrl) {
      const newElement: PlacedElement = {
        id: `sig-${Date.now()}`,
        type: 'signature',
        x,
        y,
        width: 150,
        height: 60,
        page: currentPage,
        color: signatureColor,
      };
      setPlacedElements(prev => [...prev, newElement]);
      setSelectedElement(newElement.id);
      setActiveMode('select');
    } else if (activeMode === 'text' && textInput.trim()) {
      const newElement: PlacedElement = {
        id: `text-${Date.now()}`,
        type: 'text',
        x,
        y,
        width: 200,
        height: 30,
        page: currentPage,
        content: textInput,
        color: textColor,
        fontSize: 14,
      };
      setPlacedElements(prev => [...prev, newElement]);
      setSelectedElement(newElement.id);
      setTextInput('');
      setShowTextInput(false);
      setActiveMode('select');
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    setSelectedElement(elementId);
    setIsDragging(true);

    const element = placedElements.find(el => el.id === elementId);
    if (element) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !selectedElement || !pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - dragOffset.x) / scale;
    const y = (e.clientY - rect.top - dragOffset.y) / scale;

    setPlacedElements(elements =>
      elements.map(el =>
        el.id === selectedElement
          ? { ...el, x: Math.max(0, x), y: Math.max(0, y) }
          : el
      )
    );
  }, [isDragging, selectedElement, dragOffset, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach/detach drag listeners
  const handleOverlayMouseDown = useCallback((e: React.MouseEvent, elementId: string) => {
    handleElementMouseDown(e, elementId);
    window.addEventListener('mousemove', handleMouseMove);
    const cleanup = () => {
      handleMouseUp();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', cleanup);
    };
    window.addEventListener('mouseup', cleanup);
  }, [handleMouseMove, handleMouseUp, placedElements]); // eslint-disable-line

  const handleDeleteElement = (elementId: string) => {
    setPlacedElements(elements => elements.filter(el => el.id !== elementId));
    setSelectedElement(null);
  };

  const handleResizeElement = (elementId: string, newWidth: number, newHeight: number) => {
    setPlacedElements(elements =>
      elements.map(el =>
        el.id === elementId
          ? { ...el, width: newWidth, height: newHeight }
          : el
      )
    );
  };

  const handleSave = async () => {
    if (!pdfBytes || placedElements.length === 0) return;

    setSaving(true);
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      for (const element of placedElements) {
        const page = pages[element.page - 1];
        if (!page) continue;

        const pageHeight = page.getHeight();
        const pageWidth = page.getWidth();

        // Scale from rendered (CSS px at scale=1) to PDF points
        const scaleX = pageWidth / pageSize.width;
        const scaleY = pageHeight / pageSize.height;

        // Convert coordinates (PDF origin is bottom-left)
        const pdfX = element.x * scaleX;
        const pdfY = pageHeight - (element.y * scaleY) - (element.height * scaleY);

        if (element.type === 'signature' && signatureUrl) {
          try {
            const sigResponse = await fetch(signatureUrl);
            const sigBytes = await sigResponse.arrayBuffer();

            let sigImage;
            try {
              sigImage = await pdfDoc.embedPng(sigBytes);
            } catch {
              sigImage = await pdfDoc.embedJpg(sigBytes);
            }

            page.drawImage(sigImage, {
              x: pdfX,
              y: pdfY,
              width: element.width * scaleX,
              height: element.height * scaleY,
            });
          } catch (error) {
            console.error('Error embedding signature:', error);
          }
        } else if (element.type === 'text' && element.content) {
          const colorHex = element.color || '#000000';
          const r = parseInt(colorHex.slice(1, 3), 16) / 255;
          const g = parseInt(colorHex.slice(3, 5), 16) / 255;
          const b = parseInt(colorHex.slice(5, 7), 16) / 255;

          page.drawText(element.content, {
            x: pdfX,
            y: pdfY + (element.height * scaleY * 0.7),
            size: (element.fontSize || 14) * scaleX,
            color: rgb(r, g, b),
          });
        }
      }

      const signedPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(signedPdfBytes)], { type: 'application/pdf' });
      onSave(blob);
    } catch (error) {
      console.error('Error saving PDF:', error);
      alert('Failed to save the signed document. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentPageElements = placedElements.filter(el => el.page === currentPage);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveMode('select')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeMode === 'select' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            Select
          </button>

          <button
            onClick={handleAddSignature}
            disabled={signatureLoading}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeMode === 'signature' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
            } disabled:opacity-50`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Add Signature
          </button>

          <button
            onClick={handleAddText}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeMode === 'text' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Add Text
          </button>

          <div className="h-6 w-px bg-gray-300 mx-1" />

          {activeMode === 'signature' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Color:</span>
              <div className="flex gap-1">
                {SIGNATURE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSignatureColor(color.value)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      signatureColor === color.value ? 'border-primary-500 scale-110' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}

          {activeMode === 'text' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Color:</span>
              <div className="flex gap-1">
                {SIGNATURE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setTextColor(color.value)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      textColor === color.value ? 'border-primary-500 scale-110' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.1).toFixed(1))))}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-sm text-gray-600 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(2, parseFloat((s + 0.1).toFixed(1))))}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Text Input Modal */}
      {showTextInput && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80">
          <h3 className="font-semibold text-gray-900 mb-3">Add Text</h3>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter text..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowTextInput(false);
                setTextInput('');
                setActiveMode('select');
              }}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (textInput.trim()) setShowTextInput(false);
              }}
              disabled={!textInput.trim()}
              className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300"
            >
              Click to Place
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">Click on the document to place the text</p>
        </div>
      )}

      {/* Debug panel — visible by default until preview works. Click "Hide debug" to collapse. */}
      {showDebug && (
        <div className="border-b border-amber-200 bg-amber-50 text-xs text-amber-900 px-3 py-2 font-mono space-y-1 max-h-56 overflow-auto flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="font-bold uppercase tracking-wider">E-Sign Diagnostics</div>
            <button
              type="button"
              onClick={() => setShowDebug(false)}
              className="text-amber-700 hover:text-amber-900 font-sans normal-case font-medium"
            >
              Hide debug
            </button>
          </div>
          <div>loader: webpackIgnore dynamic import of /pdf.min.mjs</div>
          <div>pdfjs lib probe: {libProbe?.status ?? 'pending…'} {libProbe?.contentType ? `(${libProbe.contentType})` : ''}</div>
          <div>worker probe: {workerProbe?.status ?? 'pending…'} {workerProbe?.contentType ? `(${workerProbe.contentType})` : ''}</div>
          <div>pdfUrl: {pdfUrl ? `${pdfUrl.slice(0, 80)}${pdfUrl.length > 80 ? '…' : ''}` : '(none)'}</div>
          <div>pdf bytes: {pdfBytes ? `${pdfBytes.byteLength} bytes` : 'not loaded'}</div>
          <div>pdfDoc: {pdfDoc ? 'parsed' : 'not parsed'} | numPages: {numPages || '(none)'} | currentPage: {currentPage} | rendering: {String(renderingPage)}</div>
          <div>signatureLoading: {String(signatureLoading)} | hasSignature: {String(hasSignature)}</div>
          {loadError && <div className="text-red-700 font-bold">ERROR: {loadError}</div>}
          <details className="mt-1">
            <summary className="cursor-pointer">log ({diagnostics.length})</summary>
            <ul className="mt-1 space-y-0.5">
              {diagnostics.map((d, i) => (
                <li
                  key={i}
                  className={
                    d.level === 'error' ? 'text-red-700' : d.level === 'warn' ? 'text-orange-700' : 'text-amber-900'
                  }
                >
                  [{new Date(d.ts).toISOString().slice(11, 23)}] {d.level.toUpperCase()} {d.message}
                  {d.detail !== undefined && d.detail !== null && d.detail !== '' && (
                    <span className="opacity-75"> — {typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail)}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
      {!showDebug && (
        <button
          type="button"
          onClick={() => setShowDebug(true)}
          className="text-xs text-amber-700 hover:text-amber-900 font-medium px-3 py-1 self-start"
        >
          Show debug
        </button>
      )}

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="flex justify-center">
          {loadError ? (
            <div className="flex flex-col items-center justify-center h-96 w-[600px] bg-white rounded shadow">
              <svg className="w-12 h-12 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-600 font-medium">Failed to load PDF</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs text-center break-words">{loadError}</p>
              <p className="text-xs text-gray-400 mt-2">See diagnostics panel above for details.</p>
            </div>
          ) : !pdfDoc ? (
            <div className="flex flex-col items-center justify-center h-96 w-[600px] bg-white rounded shadow">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">
                {pdfBytes ? 'Parsing PDF…' : 'Reading uploaded file…'}
              </p>
              {pdfBytes && <p className="text-xs text-gray-400 mt-1">{pdfBytes.byteLength} bytes loaded</p>}
            </div>
          ) : (
            <div
              ref={pageRef}
              className="relative bg-white shadow-lg"
              onClick={handlePageClick}
              style={{ cursor: activeMode !== 'select' ? 'crosshair' : 'default' }}
            >
              <canvas ref={canvasRef} className="block" />

              {/* Signature/Text overlays */}
              {currentPageElements.map((element) => (
                <div
                  key={element.id}
                  className={`absolute cursor-move ${
                    selectedElement === element.id
                      ? 'ring-2 ring-primary-500 ring-offset-1'
                      : 'hover:ring-2 hover:ring-primary-300'
                  }`}
                  style={{
                    left: element.x * scale,
                    top: element.y * scale,
                    width: element.width * scale,
                    height: element.height * scale,
                  }}
                  onMouseDown={(e) => handleOverlayMouseDown(e, element.id)}
                >
                  {element.type === 'signature' && signatureUrl && (
                    <img
                      src={signatureUrl}
                      alt="Signature"
                      className="w-full h-full object-contain"
                      style={{
                        filter: element.color !== '#000000'
                          ? `drop-shadow(0 0 0 ${element.color})`
                          : undefined,
                      }}
                      draggable={false}
                    />
                  )}
                  {element.type === 'text' && (
                    <div
                      className="w-full h-full flex items-center"
                      style={{ color: element.color, fontSize: (element.fontSize || 14) * scale }}
                    >
                      {element.content}
                    </div>
                  )}

                  {selectedElement === element.id && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteElement(element.id); }}
                        className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md z-10"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div
                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-primary-500 rounded-full cursor-se-resize"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startWidth = element.width;
                          const startHeight = element.height;
                          const onMove = (ev: MouseEvent) => {
                            handleResizeElement(
                              element.id,
                              Math.max(50, startWidth + (ev.clientX - startX) / scale),
                              Math.max(30, startHeight + (ev.clientY - startY) / scale)
                            );
                          };
                          const onUp = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Page Navigation */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-4 p-3 border-t border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm text-gray-600">Page {currentPage} of {numPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="text-sm text-gray-500">
          {placedElements.length === 0
            ? 'Add your signature or text to the document'
            : `${placedElements.length} element${placedElements.length > 1 ? 's' : ''} added`}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={placedElements.length === 0 || saving}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Signed Document
              </>
            )}
          </button>
        </div>
      </div>

      <PinVerificationModal
        isOpen={showPinModal}
        onVerified={handlePinVerified}
        onCancel={() => setShowPinModal(false)}
        title="Verify Your Identity"
        description="Enter your PIN to access your signature"
      />
    </div>
  );
}
