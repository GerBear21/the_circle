import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';

export default function HotelBookingPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial date for display
    const today = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const [formData, setFormData] = useState({
        hotelUnit: 'Zambezi River Lodge',
        guestNames: '',
        telBookingMade: false,
        arrivalDate: '',
        departureDate: '',
        numberOfNights: '',
        numberOfRooms: '',
        accommodationType: 'accommodation_only',
        allocationType: 'marketing_domestic',
        percentageDiscount: '',
        specialArrangements: 'N/A',
        reason: 'To attend the group preventative maintenance program for the group.',
    });

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    // Calculate nights automatically
    useEffect(() => {
        if (formData.arrivalDate && formData.departureDate) {
            const start = new Date(formData.arrivalDate);
            const end = new Date(formData.departureDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setFormData(prev => ({ ...prev, numberOfNights: diffDays.toString() }));
        }
    }, [formData.arrivalDate, formData.departureDate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: `Hotel Booking: ${formData.guestNames}`,
                    description: formData.reason,
                    priority: 'normal',
                    category: 'hotel',
                    requestType: 'hotel_booking',
                    metadata: {
                        hotelUnit: formData.hotelUnit,
                        guestNames: formData.guestNames,
                        telBookingMade: formData.telBookingMade,
                        arrivalDate: formData.arrivalDate,
                        departureDate: formData.departureDate,
                        numberOfNights: formData.numberOfNights,
                        numberOfRooms: formData.numberOfRooms,
                        accommodationType: formData.accommodationType,
                        allocationType: formData.allocationType,
                        percentageDiscount: formData.percentageDiscount,
                        specialArrangements: formData.specialArrangements,
                        reason: formData.reason,
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create hotel booking request');
            }

            router.push('/requests/my-requests');
        } catch (err: any) {
            setError(err.message || 'Failed to create hotel booking request');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading') {
        return (
            <AppLayout title="Hotel Booking" showBack onBack={() => router.back()}>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
            </AppLayout>
        );
    }

    if (!session) return null;

    return (
        <AppLayout title="Hotel Booking" showBack onBack={() => router.back()} hideNav>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 max-w-5xl mx-auto pb-32">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-text-primary font-heading uppercase tracking-wide">
                        Complimentary Hotel Guest Booking Form
                    </h1>
                </div>

                {error && (
                    <Card className="mb-4 bg-danger-50 border-danger-200">
                        <p className="text-danger-600 text-sm">{error}</p>
                    </Card>
                )}

                <div className="space-y-6">
                    {/* Header Section */}
                    <Card className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Hotel Unit</label>
                                <select
                                    className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                                    value={formData.hotelUnit}
                                    onChange={(e) => setFormData({ ...formData, hotelUnit: e.target.value })}
                                >
                                    <option value="Zambezi River Lodge">Zambezi River Lodge</option>
                                    <option value="Victoria Falls Hotel">Victoria Falls Hotel</option>
                                    <option value="Elephant Hills Resort">Elephant Hills Resort</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Date</label>
                                <div className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">
                                    {today}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Guest Section */}
                    <Card className="p-6">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Guest Name(s)</label>
                                <textarea
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none min-h-[80px]"
                                    placeholder="Enter full names of all guests"
                                    value={formData.guestNames}
                                    onChange={(e) => setFormData({ ...formData, guestNames: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <span className="text-sm font-semibold text-gray-700 uppercase">Tel / Telex / Booking Already Made?</span>
                                <div className="flex gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="bookingMade"
                                            checked={formData.telBookingMade === true}
                                            onChange={() => setFormData({ ...formData, telBookingMade: true })}
                                            className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                        />
                                        <span className="font-medium text-gray-900">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="bookingMade"
                                            checked={formData.telBookingMade === false}
                                            onChange={() => setFormData({ ...formData, telBookingMade: false })}
                                            className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                        />
                                        <span className="font-medium text-gray-900">No</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Stay Section */}
                    <Card className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                type="date"
                                label="Arrival Date"
                                value={formData.arrivalDate}
                                onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })}
                                required
                            />
                            <Input
                                type="number"
                                label="No. Of Nights"
                                value={formData.numberOfNights}
                                onChange={(e) => setFormData({ ...formData, numberOfNights: e.target.value })}
                                placeholder="Auto-calculated"
                                readOnly
                                className="bg-gray-50"
                            />
                            <Input
                                type="date"
                                label="Departure Date"
                                value={formData.departureDate}
                                onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                                required
                            />
                            <Input
                                type="number"
                                label="No. Of Rooms"
                                value={formData.numberOfRooms}
                                onChange={(e) => setFormData({ ...formData, numberOfRooms: e.target.value })}
                                required
                                min="1"
                            />
                        </div>
                    </Card>

                    {/* Accommodation Type */}
                    <Card className="p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase border-b pb-2">Accommodation Type</h3>
                        <div className="space-y-4">
                            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                                <input
                                    type="radio"
                                    name="accommodationType"
                                    value="accommodation_only"
                                    checked={formData.accommodationType === 'accommodation_only'}
                                    onChange={(e) => setFormData({ ...formData, accommodationType: e.target.value })}
                                    className="mt-1 w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                />
                                <div>
                                    <span className="font-bold text-gray-900 block">ACCOMMODATION ONLY</span>
                                    <span className="text-sm text-gray-500">(Bed only)</span>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                                <input
                                    type="radio"
                                    name="accommodationType"
                                    value="accommodation_and_breakfast"
                                    checked={formData.accommodationType === 'accommodation_and_breakfast'}
                                    onChange={(e) => setFormData({ ...formData, accommodationType: e.target.value })}
                                    className="mt-1 w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                />
                                <div>
                                    <span className="font-bold text-gray-900 block">ACCOMMODATION</span>
                                    <span className="text-sm text-gray-500">(Bed and breakfast free. All other food & beverages to be paid for on departure)</span>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                                <input
                                    type="radio"
                                    name="accommodationType"
                                    value="accommodation_and_meals"
                                    checked={formData.accommodationType === 'accommodation_and_meals'}
                                    onChange={(e) => setFormData({ ...formData, accommodationType: e.target.value })}
                                    className="mt-1 w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                />
                                <div>
                                    <span className="font-bold text-gray-900 block">ACCOMMODATION AND MEALS</span>
                                    <span className="text-sm text-gray-500">(Beverages to be paid for on departure)</span>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                                <input
                                    type="radio"
                                    name="accommodationType"
                                    value="accommodation_meals_drink"
                                    checked={formData.accommodationType === 'accommodation_meals_drink'}
                                    onChange={(e) => setFormData({ ...formData, accommodationType: e.target.value })}
                                    className="mt-1 w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                />
                                <div>
                                    <span className="font-bold text-gray-900 block">ACCOMMODATION AND MEALS PLUS ONE SOFT DRINK PER MEAL</span>
                                </div>
                            </label>
                        </div>
                    </Card>

                    {/* Allocation */}
                    <Card className="p-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase">Allocation of Comp Booking</label>
                        <select
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all appearance-none"
                            value={formData.allocationType}
                            onChange={(e) => setFormData({ ...formData, allocationType: e.target.value })}
                        >
                            <option value="marketing_domestic">Marketing – Domestic</option>
                            <option value="marketing_international">Marketing – International</option>
                            <option value="administration">Administration</option>
                            <option value="promotions">Promotions</option>
                            <option value="personnel">Personnel</option>
                        </select>
                    </Card>

                    {/* Details */}
                    <Card className="p-6 space-y-6">
                        <div>
                            <Input
                                label="Percentage Discount (On accommodation only)"
                                placeholder="%"
                                type="number"
                                min="0"
                                max="100"
                                value={formData.percentageDiscount}
                                onChange={(e) => setFormData({ ...formData, percentageDiscount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Special Arrangements</label>
                            <textarea
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none min-h-[60px]"
                                value={formData.specialArrangements}
                                onChange={(e) => setFormData({ ...formData, specialArrangements: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Reason for complimentary</label>
                            <textarea
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none min-h-[80px]"
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            />
                        </div>
                    </Card>

                    {/* Approval Workflow Visualization */}
                    <Card className="p-6 bg-gray-50/50 border-dashed">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-6 text-center">Approval Workflow</h3>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-4xl mx-auto relative px-4">
                            {/* Connecting Line (Desktop) */}
                            <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-0.5 bg-gray-200 -z-0" />

                            {/* Step 1 */}
                            <div className="flex flex-col items-center z-10 w-full md:w-auto">
                                <div className="w-14 h-14 rounded-full bg-white border-2 border-primary-100 text-primary-600 flex items-center justify-center font-bold mb-3 shadow-sm">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <span className="font-semibold text-gray-900 text-center">H.O.D</span>
                                <span className="text-xs text-gray-500 text-center mt-1">Department Approval</span>
                            </div>

                            {/* Arrow 1 */}
                            <div className="text-gray-300 md:-mx-4 transform rotate-90 md:rotate-0 z-10 bg-gray-50/50 p-1">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </div>

                            {/* Step 2 */}
                            <div className="flex flex-col items-center z-10 w-full md:w-auto">
                                <div className="w-14 h-14 rounded-full bg-white border-2 border-primary-100 text-primary-600 flex items-center justify-center font-bold mb-3 shadow-sm">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span className="font-semibold text-gray-900 text-center">Finance Director</span>
                                <span className="text-xs text-gray-500 text-center mt-1">Financial Review</span>
                            </div>

                            {/* Arrow 2 */}
                            <div className="text-gray-300 md:-mx-4 transform rotate-90 md:rotate-0 z-10 bg-gray-50/50 p-1">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </div>

                            {/* Step 3 */}
                            <div className="flex flex-col items-center z-10 w-full md:w-auto">
                                <div className="w-14 h-14 rounded-full bg-white border-2 border-primary-100 text-primary-600 flex items-center justify-center font-bold mb-3 shadow-sm">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span className="font-semibold text-gray-900 text-center">Chief Executive</span>
                                <span className="text-xs text-gray-500 text-center mt-1">Final Authorization</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Footer Action Bar */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64 z-10 shadow-lg">
                    <div className="flex gap-3 max-w-5xl mx-auto">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={() => router.back()}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1 shadow-primary-500/25 shadow-lg"
                            isLoading={loading}
                        >
                            Submit Request
                        </Button>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
