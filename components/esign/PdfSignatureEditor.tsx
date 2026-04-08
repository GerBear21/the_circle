import { useState, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, rgb } from 'pdf-lib';
import PinVerificationModal from '../PinVerificationModal';
import { useUserSignature } from '../../hooks/useUserSignature';

// Use the worker matching react-pdf's bundled pdfjs-dist (5.4.296)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

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

  const pageRef = useRef<HTMLDivElement>(null);

  const { signatureUrl, hasSignature, loading: signatureLoading } = useUserSignature();

  const handleDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    // Fetch raw bytes for pdf-lib (needed for saving)
    fetch(pdfUrl)
      .then(r => r.arrayBuffer())
      .then(bytes => setPdfBytes(bytes))
      .catch(err => console.error('Failed to fetch PDF bytes:', err));
  }, [pdfUrl]);

  const handlePageLoadSuccess = useCallback((page: { originalWidth: number; originalHeight: number }) => {
    setPageSize({ width: page.originalWidth, height: page.originalHeight });
  }, []);

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

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="flex justify-center">
          <Document
            file={pdfUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center h-96 w-[600px] bg-white rounded shadow">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500">Loading PDF...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center h-96 w-[600px] bg-white rounded shadow">
                <svg className="w-12 h-12 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-red-600 font-medium">Failed to load PDF</p>
                <p className="text-xs text-gray-500 mt-1">Please try uploading again</p>
              </div>
            }
          >
            <div
              ref={pageRef}
              className="relative bg-white shadow-lg"
              onClick={handlePageClick}
              style={{ cursor: activeMode !== 'select' ? 'crosshair' : 'default' }}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                onLoadSuccess={handlePageLoadSuccess}
              />

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
          </Document>
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
