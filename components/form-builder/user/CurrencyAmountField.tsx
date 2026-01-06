import React from 'react';
import { useNode } from '@craftjs/core';

interface CurrencyAmountFieldProps {
    label?: string;
    sublabel?: string;
    required?: boolean;
    currencies?: string[];
    selectedCurrency?: string;
    amount?: string;
    placeholder?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    'ZIG': 'ZiG',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'ZAR': 'R',
    'BWP': 'P',
    'Other': '¤',
};

export const CurrencyAmountField = ({ label, sublabel, required, currencies = [], selectedCurrency, amount, placeholder }: CurrencyAmountFieldProps) => {
    const { connectors: { connect, drag }, actions: { setProp } } = useNode();

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setProp((props: any) => props.selectedCurrency = e.target.value);
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
            setProp((props: any) => props.amount = value);
        }
    };

    const formatAmount = (value: string) => {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div ref={(ref: any) => connect(drag(ref))} className="mb-4">
            {(label || sublabel) && (
                <div className="mb-2">
                    {label && (
                        <label className="block text-sm font-medium text-gray-700">
                            {label}
                            {required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    )}
                    {sublabel && (
                        <span className="block text-xs text-gray-500 mt-0.5">{sublabel}</span>
                    )}
                </div>
            )}

            <div className="flex gap-2">
                {/* Currency selector */}
                <div className="relative w-32">
                    <select
                        className="w-full px-3 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
                        value={selectedCurrency || ''}
                        onChange={handleCurrencyChange}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <option value="">Currency</option>
                        {currencies.map((currency, index) => (
                            <option key={index} value={currency}>
                                {CURRENCY_SYMBOLS[currency] || currency} {currency}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                {/* Amount input */}
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 font-medium">
                            {selectedCurrency ? (CURRENCY_SYMBOLS[selectedCurrency] || selectedCurrency) : ''}
                        </span>
                    </div>
                    <input
                        type="text"
                        inputMode="decimal"
                        className={`w-full ${selectedCurrency ? 'pl-10' : 'pl-4'} pr-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500`}
                        placeholder={placeholder || '0.00'}
                        value={amount || ''}
                        onChange={handleAmountChange}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>

            {/* Display formatted amount */}
            {amount && selectedCurrency && (
                <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">
                        {CURRENCY_SYMBOLS[selectedCurrency] || selectedCurrency} {formatAmount(amount)}
                    </span>
                    <span className="text-gray-400 ml-1">({selectedCurrency})</span>
                </div>
            )}
        </div>
    );
};

export const CurrencyAmountFieldSettings = () => {
    const { actions: { setProp }, label, sublabel, required, currencies, placeholder } = useNode((node) => ({
        label: node.data.props.label,
        sublabel: node.data.props.sublabel,
        required: node.data.props.required,
        currencies: node.data.props.currencies,
        placeholder: node.data.props.placeholder,
    }));

    const handleAddCurrency = () => {
        setProp((props: any) => props.currencies = [...props.currencies, 'NEW']);
    };

    const handleCurrencyChange = (index: number, value: string) => {
        setProp((props: any) => props.currencies[index] = value);
    };

    const handleRemoveCurrency = (index: number) => {
        setProp((props: any) => props.currencies = props.currencies.filter((_: any, i: number) => i !== index));
    };

    return (
        <div className="space-y-3 p-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Label</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={label || ''}
                    onChange={(e) => setProp((props: any) => props.label = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Sublabel</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={sublabel || ''}
                    onChange={(e) => setProp((props: any) => props.sublabel = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700">Placeholder</label>
                <input
                    className="w-full px-2 py-1 text-sm border rounded"
                    value={placeholder || ''}
                    placeholder="e.g., 0.00"
                    onChange={(e) => setProp((props: any) => props.placeholder = e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Currencies</label>
                <div className="space-y-2">
                    {currencies.map((currency: string, index: number) => (
                        <div key={index} className="flex items-center gap-1">
                            <input
                                className="flex-1 px-2 py-1 text-sm border rounded"
                                value={currency}
                                onChange={(e) => handleCurrencyChange(index, e.target.value.toUpperCase())}
                            />
                            <button
                                onClick={() => handleRemoveCurrency(index)}
                                className="text-red-500 hover:text-red-700"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={handleAddCurrency}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Currency
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
                <input
                    type="checkbox"
                    checked={required || false}
                    onChange={(e) => setProp((props: any) => props.required = e.target.checked)}
                />
                <label className="text-sm text-gray-700">Required</label>
            </div>
        </div>
    );
};

CurrencyAmountField.craft = {
    displayName: 'Currency & Amount',
    props: {
        label: 'Amount',
        sublabel: '',
        required: false,
        currencies: ['ZIG', 'USD', 'Other'],
        selectedCurrency: '',
        amount: '',
        placeholder: '0.00',
    },
    related: {
        settings: CurrencyAmountFieldSettings,
    },
};
