import React, { useState } from 'react';
import Modal from './Modal';
import Input from './Input';
// Assuming we might need a Select or Textarea, but Input usually covers text.
// If not, we'll use standard HTML textarea for execution speed unless a Textarea component exists.
// Checking file definitions: Input, Button, Card, Modal. No Textarea. I'll use raw generic textarea with tailwind classes matching Input.
import Button from './Button';
import { useToast } from './ToastProvider';

interface ComposeNotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ComposeNotificationModal({ isOpen, onClose }: ComposeNotificationModalProps) {
    const { addToast } = useToast();
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [sendViaOutlook, setSendViaOutlook] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const handleSend = () => {
        // Validate
        if (!recipient || !subject || !content) {
            addToast({
                type: 'error',
                title: 'Missing Fields',
                message: 'Please fill in all required fields.',
            });
            return;
        }

        setIsSending(true);

        // Simulate API call
        setTimeout(() => {
            setIsSending(false);
            addToast({
                type: 'success',
                title: 'Notification Sent',
                message: `Message sent to ${recipient}${sendViaOutlook ? ' (and via Outlook)' : ''}.`,
            });
            onClose();
            // Reset form
            setRecipient('');
            setSubject('');
            setContent('');
            setSendViaOutlook(false);
        }, 1500);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Compose Notification" size="lg">
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                        <input
                            type="text"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                            placeholder="Select user or type name..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                            placeholder="Enter subject..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={5}
                            className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 resize-none font-sans"
                            placeholder="Type your message here..."
                        />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center h-5">
                            <input
                                id="outlook"
                                type="checkbox"
                                checked={sendViaOutlook}
                                onChange={(e) => setSendViaOutlook(e.target.checked)}
                                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                        </div>
                        <div className="ml-2 text-sm">
                            <label htmlFor="outlook" className="font-medium text-gray-900">Send via Outlook</label>
                            <p className="text-gray-500 text-xs">A copy will be sent to the user's email address.</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isSending}
                        className={`px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-2 ${isSending ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {isSending && (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {isSending ? 'Sending...' : 'Send Notification'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
