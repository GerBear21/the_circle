import React, { useState, useEffect } from 'react';
import { useNode } from '@craftjs/core';
import { useUserSignature } from '../../../hooks/useUserSignature';

// Cell field types
export type CellFieldType = 'text' | 'checkbox' | 'signature' | 'date' | 'number' | 'dropdown';

export interface TableCellConfig {
    type: CellFieldType;
    value?: string;
    checked?: boolean;
    signatureData?: string;
    signatureLabel?: string;
    signatureSublabel?: string;
    signatureName?: string;
    options?: string[];
    placeholder?: string;
}

export interface TableColumn {
    name: string;
    fieldType: CellFieldType;
    width?: string;
    signatureLabel?: string;
    signatureSublabel?: string;
    options?: string[]; // For dropdown columns
}

export interface TableRow {
    cells: TableCellConfig[];
}

interface TableProps {
    columns?: TableColumn[];
    rows?: TableRow[];
    showBorders?: boolean;
    headerBgColor?: string;
    allowAddRows?: boolean;
}

// Cell renderers for different field types
const TextCell = ({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input
        type="text"
        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-300 rounded"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Enter text...'}
    />
);

const NumberCell = ({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input
        type="number"
        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-300 rounded"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '0'}
    />
);

const DateCell = ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <input
        type="date"
        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-300 rounded"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
    />
);

const CheckboxCell = ({ checked, onChange }: { checked?: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-center">
        <input
            type="checkbox"
            className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
            checked={checked || false}
            onChange={(e) => onChange(e.target.checked)}
        />
    </div>
);

const DropdownCell = ({ value, onChange, options }: { value?: string; onChange: (v: string) => void; options?: string[] }) => (
    <select
        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-300 rounded cursor-pointer"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
    >
        <option value="">Select...</option>
        {(options || ['Option 1', 'Option 2']).map((opt, idx) => (
            <option key={idx} value={opt}>{opt}</option>
        ))}
    </select>
);

interface SignatureCellProps {
    signatureData?: string;
    signatureLabel?: string;
    signatureSublabel?: string;
    signatureName?: string;
    onSign: () => void;
    onClear: () => void;
}

const SignatureCell = ({ signatureData, signatureLabel, signatureSublabel, signatureName, onSign, onClear }: SignatureCellProps) => (
    <div className="w-full h-full min-h-[80px] flex flex-col">
        {/* Signature labels */}
        {(signatureLabel || signatureSublabel) && (
            <div className="mb-1">
                {signatureLabel && (
                    <div className="text-xs font-medium text-gray-700">{signatureLabel}</div>
                )}
                {signatureSublabel && (
                    <div className="text-[10px] text-gray-500">{signatureSublabel}</div>
                )}
            </div>
        )}

        {/* Signature area */}
        {signatureData ? (
            <div className="flex-1 flex flex-col">
                <div className="flex-1 border border-gray-200 rounded bg-white flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signatureData} alt="Signature" className="max-h-[50px] object-contain" />
                </div>
                {signatureName && (
                    <div className="text-xs text-gray-600 mt-1 text-center font-medium">{signatureName}</div>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onClear(); }}
                    className="text-xs text-red-500 hover:text-red-700 mt-1 self-center"
                >
                    Clear
                </button>
            </div>
        ) : (
            <div
                className="flex-1 border border-dashed border-gray-300 rounded bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-primary-400 transition-colors min-h-[60px]"
                onClick={(e) => { e.stopPropagation(); onSign(); }}
            >
                <svg className="w-5 h-5 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="text-xs text-gray-500">Click to sign</span>
            </div>
        )}
    </div>
);

const defaultColumns: TableColumn[] = [
    { name: 'Item', fieldType: 'text' as CellFieldType },
    { name: 'Quantity', fieldType: 'number' as CellFieldType },
    { name: 'Completed', fieldType: 'checkbox' as CellFieldType },
];

const defaultRows: TableRow[] = [
    { cells: [{ type: 'text' }, { type: 'number' }, { type: 'checkbox' }] },
    { cells: [{ type: 'text' }, { type: 'number' }, { type: 'checkbox' }] },
];

export const Table = ({ columns = defaultColumns, rows = defaultRows, showBorders = true, headerBgColor = '#f9fafb', allowAddRows = true }: TableProps) => {
    const { connectors: { connect, drag }, actions: { setProp } } = useNode();
    const [activeSignature, setActiveSignature] = useState<{ row: number; col: number } | null>(null);

    const handleCellChange = (rowIndex: number, colIndex: number, field: keyof TableCellConfig, value: any) => {
        setProp((props: any) => {
            if (!props.rows[rowIndex]) return;
            if (!props.rows[rowIndex].cells[colIndex]) {
                props.rows[rowIndex].cells[colIndex] = { type: columns[colIndex]?.fieldType || 'text' };
            }
            props.rows[rowIndex].cells[colIndex][field] = value;
        });
    };

    const handleAddRow = () => {
        setProp((props: any) => {
            const newRow: TableRow = {
                cells: columns.map(col => ({
                    type: col.fieldType,
                    signatureLabel: col.signatureLabel,
                    signatureSublabel: col.signatureSublabel,
                    options: col.options
                }))
            };
            props.rows = [...props.rows, newRow];
        });
    };

    const handleRemoveRow = (rowIndex: number) => {
        if (rows.length <= 1) return;
        setProp((props: any) => {
            props.rows = props.rows.filter((_: any, i: number) => i !== rowIndex);
        });
    };

    const renderCell = (cell: TableCellConfig, column: TableColumn, rowIndex: number, colIndex: number) => {
        const cellType = cell?.type || column.fieldType || 'text';

        switch (cellType) {
            case 'checkbox':
                return (
                    <CheckboxCell
                        checked={cell?.checked}
                        onChange={(v) => handleCellChange(rowIndex, colIndex, 'checked', v)}
                    />
                );
            case 'signature':
                return (
                    <SignatureCell
                        signatureData={cell?.signatureData}
                        signatureLabel={cell?.signatureLabel || column.signatureLabel}
                        signatureSublabel={cell?.signatureSublabel || column.signatureSublabel}
                        signatureName={cell?.signatureName}
                        onSign={() => setActiveSignature({ row: rowIndex, col: colIndex })}
                        onClear={() => {
                            handleCellChange(rowIndex, colIndex, 'signatureData', undefined);
                            handleCellChange(rowIndex, colIndex, 'signatureName', undefined);
                        }}
                    />
                );
            case 'date':
                return (
                    <DateCell
                        value={cell?.value}
                        onChange={(v) => handleCellChange(rowIndex, colIndex, 'value', v)}
                    />
                );
            case 'number':
                return (
                    <NumberCell
                        value={cell?.value}
                        onChange={(v) => handleCellChange(rowIndex, colIndex, 'value', v)}
                        placeholder={cell?.placeholder}
                    />
                );
            case 'dropdown':
                return (
                    <DropdownCell
                        value={cell?.value}
                        onChange={(v) => handleCellChange(rowIndex, colIndex, 'value', v)}
                        options={cell?.options || column.options}
                    />
                );
            case 'text':
            default:
                return (
                    <TextCell
                        value={cell?.value}
                        onChange={(v) => handleCellChange(rowIndex, colIndex, 'value', v)}
                        placeholder={cell?.placeholder}
                    />
                );
        }
    };

    return (
        <div ref={(ref: any) => connect(drag(ref))} className="mb-4 overflow-x-auto">
            <table className={`min-w-full divide-y divide-gray-200 ${showBorders ? 'border' : ''}`}>
                <thead style={{ backgroundColor: headerBgColor }}>
                    <tr>
                        {columns.map((col, i) => (
                            <th
                                key={i}
                                className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${showBorders ? 'border-r last:border-r-0' : ''}`}
                                style={{ width: col.width }}
                            >
                                {col.name}
                            </th>
                        ))}
                        {allowAddRows && (
                            <th className="w-10 px-2 py-3"></th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map((row, rIndex) => (
                        <tr key={rIndex} className="hover:bg-gray-50 transition-colors">
                            {columns.map((col, cIndex) => (
                                <td
                                    key={cIndex}
                                    className={`px-4 py-3 ${showBorders ? 'border-r last:border-r-0' : ''} text-sm text-gray-700 align-top`}
                                >
                                    {renderCell(row.cells?.[cIndex] || { type: col.fieldType }, col, rIndex, cIndex)}
                                </td>
                            ))}
                            {allowAddRows && (
                                <td className="w-10 px-2 py-3 text-center align-middle">
                                    {rows.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveRow(rIndex)}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                            title="Remove row"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>

            {allowAddRows && (
                <button
                    onClick={handleAddRow}
                    className="mt-2 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-1"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Row
                </button>
            )}

            {/* Signature Modal */}
            {activeSignature && (
                <SignatureModal
                    onSave={(signatureData, name) => {
                        handleCellChange(activeSignature.row, activeSignature.col, 'signatureData', signatureData);
                        if (name) {
                            handleCellChange(activeSignature.row, activeSignature.col, 'signatureName', name);
                        }
                        setActiveSignature(null);
                    }}
                    onClose={() => setActiveSignature(null)}
                />
            )}
        </div>
    );
};

// Signature Modal Component
interface SignatureModalProps {
    onSave: (signatureData: string, name?: string) => void;
    onClose: () => void;
}

const SignatureModal = ({ onSave, onClose }: SignatureModalProps) => {
    const { signatureUrl, userName, hasSignature, loading } = useUserSignature();
    const [useMySignature, setUseMySignature] = useState(false);
    const [signatureName, setSignatureName] = useState('');
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    // Pre-fill name when using stored signature
    useEffect(() => {
        if (useMySignature && userName) {
            setSignatureName(userName);
        }
    }, [useMySignature, userName]);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        ctx.beginPath();

        const rect = canvas.getBoundingClientRect();
        let x, y;

        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }

        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        let x, y;

        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }

        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#333';
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasDrawn(true);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const handleSave = () => {
        if (useMySignature && signatureUrl) {
            onSave(signatureUrl, signatureName || userName || undefined);
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas || !hasDrawn) return;

        const signatureData = canvas.toDataURL('image/png');
        onSave(signatureData, signatureName || undefined);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Add Signature</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Use my signature checkbox */}
                {hasSignature && (
                    <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={useMySignature}
                                onChange={(e) => setUseMySignature(e.target.checked)}
                                className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">Use my saved signature</span>
                                <p className="text-xs text-gray-500">Use the signature from your profile</p>
                            </div>
                        </label>
                        {useMySignature && signatureUrl && (
                            <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={signatureUrl} alt="Your signature" className="max-h-[60px] mx-auto object-contain" />
                            </div>
                        )}
                    </div>
                )}

                {/* Name input */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name {useMySignature ? '' : '(optional)'}
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter your name..."
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                    />
                </div>

                {/* Signature canvas - only show if not using saved signature */}
                {!useMySignature && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Draw your signature
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                            <canvas
                                ref={canvasRef}
                                width={380}
                                height={150}
                                className="w-full cursor-crosshair touch-none"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                        </div>
                        <button
                            onClick={clearCanvas}
                            className="mt-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Clear signature
                        </button>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!useMySignature && !hasDrawn}
                        className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {useMySignature ? 'Add My Signature' : 'Save Signature'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Settings Panel
export const TableSettings = () => {
    const { actions: { setProp }, columns, rows, showBorders, headerBgColor, allowAddRows } = useNode((node) => ({
        columns: node.data.props.columns as TableColumn[],
        rows: node.data.props.rows as TableRow[],
        showBorders: node.data.props.showBorders,
        headerBgColor: node.data.props.headerBgColor,
        allowAddRows: node.data.props.allowAddRows,
    }));

    const fieldTypes: { value: CellFieldType; label: string; icon: string }[] = [
        { value: 'text', label: 'Text', icon: 'M4 6h16M4 12h16M4 18h7' },
        { value: 'number', label: 'Number', icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14' },
        { value: 'date', label: 'Date', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
        { value: 'checkbox', label: 'Checkbox', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        { value: 'signature', label: 'Signature', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
        { value: 'dropdown', label: 'Dropdown', icon: 'M19 9l-7 7-7-7' },
    ];

    const handleAddColumn = () => {
        setProp((props: any) => {
            const newCol: TableColumn = {
                name: `Column ${props.columns.length + 1}`,
                fieldType: 'text'
            };
            props.columns = [...props.columns, newCol];
            // Add cell to each row
            props.rows = props.rows.map((row: TableRow) => ({
                ...row,
                cells: [...(row.cells || []), { type: 'text' }]
            }));
        });
    };

    const handleColumnChange = (index: number, field: keyof TableColumn, value: any) => {
        setProp((props: any) => {
            props.columns[index][field] = value;
            // Update cell types if field type changed
            if (field === 'fieldType') {
                props.rows = props.rows.map((row: TableRow) => {
                    const newCells = [...(row.cells || [])];
                    if (newCells[index]) {
                        newCells[index] = { ...newCells[index], type: value };
                    } else {
                        newCells[index] = { type: value };
                    }
                    return { ...row, cells: newCells };
                });
            }
        });
    };

    const handleRemoveColumn = (index: number) => {
        if (columns.length <= 1) return;
        setProp((props: any) => {
            props.columns = props.columns.filter((_: any, i: number) => i !== index);
            props.rows = props.rows.map((row: TableRow) => ({
                ...row,
                cells: (row.cells || []).filter((_: any, i: number) => i !== index)
            }));
        });
    };

    const [expandedColumn, setExpandedColumn] = useState<number | null>(null);

    return (
        <div className="space-y-4 p-3">
            {/* Table Settings */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Table Settings</h4>

                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700">Show Borders</label>
                    <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-primary-600"
                        checked={showBorders !== false}
                        onChange={(e) => setProp((props: any) => props.showBorders = e.target.checked)}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700">Allow Add Rows</label>
                    <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-primary-600"
                        checked={allowAddRows !== false}
                        onChange={(e) => setProp((props: any) => props.allowAddRows = e.target.checked)}
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Header Color</label>
                    <input
                        type="color"
                        className="w-full h-8 rounded cursor-pointer"
                        value={headerBgColor || '#f9fafb'}
                        onChange={(e) => setProp((props: any) => props.headerBgColor = e.target.value)}
                    />
                </div>
            </div>

            <div className="border-t border-gray-200 pt-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Columns</h4>

                <div className="space-y-2">
                    {columns.map((col: TableColumn, index: number) => (
                        <div key={index} className="bg-gray-50 rounded-lg overflow-hidden">
                            {/* Column Header */}
                            <div
                                className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-100"
                                onClick={() => setExpandedColumn(expandedColumn === index ? null : index)}
                            >
                                <svg
                                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedColumn === index ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <input
                                    className="flex-1 px-2 py-1 text-sm border rounded bg-white"
                                    value={col.name}
                                    onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-xs text-gray-500 capitalize px-1.5 py-0.5 bg-gray-200 rounded">
                                    {col.fieldType}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRemoveColumn(index); }}
                                    className="text-red-400 hover:text-red-600"
                                    disabled={columns.length <= 1}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Expanded Settings */}
                            {expandedColumn === index && (
                                <div className="p-3 border-t border-gray-200 space-y-3">
                                    {/* Field Type */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Field Type</label>
                                        <div className="grid grid-cols-3 gap-1">
                                            {fieldTypes.map((ft) => (
                                                <button
                                                    key={ft.value}
                                                    onClick={() => handleColumnChange(index, 'fieldType', ft.value)}
                                                    className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${col.fieldType === ft.value
                                                            ? 'bg-primary-100 text-primary-700 border border-primary-300'
                                                            : 'bg-white border border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ft.icon} />
                                                    </svg>
                                                    {ft.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Signature-specific settings */}
                                    {col.fieldType === 'signature' && (
                                        <>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Signature Label</label>
                                                <input
                                                    className="w-full px-2 py-1 text-sm border rounded"
                                                    placeholder="e.g., Approved by"
                                                    value={col.signatureLabel || ''}
                                                    onChange={(e) => handleColumnChange(index, 'signatureLabel', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Signature Sublabel</label>
                                                <input
                                                    className="w-full px-2 py-1 text-sm border rounded"
                                                    placeholder="e.g., Department Manager"
                                                    value={col.signatureSublabel || ''}
                                                    onChange={(e) => handleColumnChange(index, 'signatureSublabel', e.target.value)}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Dropdown-specific settings */}
                                    {col.fieldType === 'dropdown' && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Options (one per line)</label>
                                            <textarea
                                                className="w-full px-2 py-1 text-sm border rounded"
                                                rows={3}
                                                placeholder="Option 1&#10;Option 2&#10;Option 3"
                                                value={(col.options || []).join('\n')}
                                                onChange={(e) => handleColumnChange(index, 'options', e.target.value.split('\n').filter(o => o.trim()))}
                                            />
                                        </div>
                                    )}

                                    {/* Column width */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Column Width</label>
                                        <input
                                            className="w-full px-2 py-1 text-sm border rounded"
                                            placeholder="auto, 100px, 25%, etc."
                                            value={col.width || ''}
                                            onChange={(e) => handleColumnChange(index, 'width', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleAddColumn}
                    className="mt-2 w-full text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center justify-center gap-1 py-2 border border-dashed border-primary-300 rounded-lg hover:bg-primary-50"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Column
                </button>
            </div>

            {/* Initial Rows */}
            <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-700">Rows</label>
                    <span className="text-xs text-gray-500">{rows.length} row(s)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Use the &quot;Add Row&quot; button in the table preview to add more rows.</p>
            </div>
        </div>
    );
};

// Default props and craft config
Table.craft = {
    displayName: 'Advanced Table',
    props: {
        columns: [
            { name: 'Item', fieldType: 'text' as CellFieldType },
            { name: 'Quantity', fieldType: 'number' as CellFieldType },
            { name: 'Completed', fieldType: 'checkbox' as CellFieldType },
        ] as TableColumn[],
        rows: [
            { cells: [{ type: 'text' }, { type: 'number' }, { type: 'checkbox' }] },
            { cells: [{ type: 'text' }, { type: 'number' }, { type: 'checkbox' }] },
        ] as TableRow[],
        showBorders: true,
        headerBgColor: '#f9fafb',
        allowAddRows: true,
    },
    related: {
        settings: TableSettings,
    },
};
