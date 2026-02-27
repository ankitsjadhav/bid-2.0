'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatTitle } from '@/lib/utils/format';

export default function SupplierRFQDetail() {
    const router = useRouter();
    const { id } = useParams();

    const [rfq, setRfq] = useState<any>(null);
    const [hasBid, setHasBid] = useState(false);
    const [myBidId, setMyBidId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [pricing, setPricing] = useState('');
    const [leadTime, setLeadTime] = useState('');
    const [deliveryWindow, setDeliveryWindow] = useState('');
    const [notes, setNotes] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        const fetchRFQAndBidStatus = async () => {
            if (!auth.currentUser || !id) return;

            try {
                const rfqDoc = await getDoc(doc(db, 'rfqs', id as string));
                if (rfqDoc.exists()) {
                    const rfqData = rfqDoc.data();
                    // Ensure supplier is authorized
                    if (!rfqData.matchingSupplierIds?.includes(auth.currentUser.uid)) {
                        router.push('/supplier/inbox');
                        return;
                    }
                    setRfq({ id: rfqDoc.id, ...rfqData });
                }

                const bidQuery = query(
                    collection(db, 'bids'),
                    where('rfqId', '==', id),
                    where('supplierId', '==', auth.currentUser.uid)
                );
                const bidDocs = await getDocs(bidQuery);
                if (!bidDocs.empty) {
                    setHasBid(true);
                    setMyBidId(bidDocs.docs[0].id);
                }
            } catch (err) {
                toast.error("Error fetching RFQ details");
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchRFQAndBidStatus();
        });

        return () => unsubscribe();
    }, [id, router]);

    const handleSubmitBid = async () => {
        const errors: { [key: string]: string } = {};
        if (!pricing) errors.pricing = "Price is required.";
        if (!leadTime) errors.leadTime = "Lead time is required.";
        setFormErrors(errors);

        if (Object.keys(errors).length > 0) {
            toast.error("Please fill in all required pricing fields.");
            return;
        }

        if (!auth.currentUser || !id) return;
        setSubmitting(true);
        toast.loading("Submitting bid...");

        try {
            const newBidRef = await addDoc(collection(db, 'bids'), {
                rfqId: id,
                supplierId: auth.currentUser.uid,
                pricing: parseFloat(pricing),
                leadTime,
                delivery: deliveryWindow,
                notes,
                selected: false,
                createdAt: new Date().toISOString()
            });

            setHasBid(true);
            setMyBidId(newBidRef.id);
            toast.dismiss();
            toast.success("Bid submitted successfully!");
        } catch (err: any) {
            toast.dismiss();
            toast.error(err.message || "Failed to submit bid.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>;
    }

    if (!rfq) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">RFQ not found.</div>;
    }

    const isWinner = rfq.status === 'selected' && rfq.selectedBidId === myBidId;
    const isLoser = rfq.status === 'selected' && rfq.selectedBidId !== myBidId;

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col py-8 pb-16">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-400/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-violet-400/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

            <div className="max-w-4xl mx-auto px-4 w-full relative z-10">
                <Button variant="ghost" onClick={() => router.back()} className="mb-6" disabled={submitting}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Inbox
                </Button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="h-fit border-0 ring-1 ring-slate-200/50 shadow-xl shadow-slate-200/40 bg-white/80 backdrop-blur-md rounded-2xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-violet-400"></div>
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 pb-5 pt-7">
                            <CardTitle className="text-lg font-bold text-slate-800">RFQ Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 p-6">
                            <div>
                                <Label className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Category</Label>
                                <div className="font-semibold text-lg text-slate-900 mt-1">{formatTitle(rfq.structuredData?.category)}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-slate-500 text-xs uppercase">Delivery City</Label>
                                    <div className="font-medium">{formatTitle(rfq.structuredData?.delivery?.city || "")}</div>
                                </div>
                                <div>
                                    <Label className="text-slate-500 text-xs uppercase">Needed By</Label>
                                    <div className="font-medium">{rfq.structuredData?.neededBy}</div>
                                </div>
                            </div>

                            {rfq.structuredData?.items && rfq.structuredData.items.length > 0 && (
                                <div className="pt-4 border-t">
                                    <Label className="text-slate-500 text-xs uppercase mb-2 block">Requested Items</Label>
                                    <ul className="space-y-2 bg-slate-100 p-3 rounded-lg">
                                        {rfq.structuredData.items.map((item: any, idx: number) => (
                                            <li key={idx} className="flex justify-between text-sm">
                                                <span className="font-medium">{item.name}</span>
                                                <span>{item.quantity} {item.unit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {rfq.rawText && (
                                <div className="pt-4 border-t">
                                    <Label className="text-slate-500 text-xs uppercase mb-1 block">Original Request Notes</Label>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{rfq.rawText}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-0 ring-1 ring-slate-200/50 shadow-xl shadow-slate-200/40 bg-white/80 backdrop-blur-md rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400"></div>
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 pb-5 pt-7">
                            <CardTitle className="text-lg font-bold text-slate-800">Submit Your Bid</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 p-6 relative z-10">
                            {isWinner ? (
                                <div className="bg-amber-50 text-amber-700 p-6 rounded-lg text-center flex flex-col items-center justify-center space-y-2 border border-amber-200">
                                    <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                                    </div>
                                    <p className="font-semibold text-lg">🎉 Your bid was selected!</p>
                                    <p className="text-sm">The contractor chose your bid for this RFQ.</p>
                                </div>
                            ) : isLoser ? (
                                <div className="bg-slate-100 text-slate-700 p-6 rounded-lg text-center flex flex-col items-center justify-center space-y-2 border border-slate-200">
                                    <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center mb-2">
                                        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                    </div>
                                    <p className="font-semibold text-lg">RFQ Closed</p>
                                    <p className="text-sm">The contractor selected another supplier's bid.</p>
                                </div>
                            ) : hasBid ? (
                                <div className="bg-green-50 text-green-700 p-6 rounded-lg text-center flex flex-col items-center justify-center space-y-2 border border-green-200">
                                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <p className="font-semibold text-lg">Bid Submitted</p>
                                    <p className="text-sm">You have already submitted a bid for this RFQ.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="pricing" className={formErrors.pricing ? "text-red-500" : ""}>Total Price ($)</Label>
                                        <Input
                                            id="pricing"
                                            type="number"
                                            placeholder="e.g. 1500"
                                            value={pricing}
                                            onChange={(e) => {
                                                setPricing(e.target.value);
                                                if (formErrors.pricing) setFormErrors(prev => ({ ...prev, pricing: "" }));
                                            }}
                                            disabled={submitting}
                                            className={formErrors.pricing ? "border-red-500 focus-visible:ring-red-500" : ""}
                                        />
                                        {formErrors.pricing && <p className="text-sm text-red-500">{formErrors.pricing}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="leadTime" className={formErrors.leadTime ? "text-red-500" : ""}>Lead Time</Label>
                                            <Input
                                                id="leadTime"
                                                placeholder="e.g. 2 Days"
                                                value={leadTime}
                                                onChange={(e) => {
                                                    setLeadTime(e.target.value);
                                                    if (formErrors.leadTime) setFormErrors(prev => ({ ...prev, leadTime: "" }));
                                                }}
                                                disabled={submitting}
                                                className={formErrors.leadTime ? "border-red-500 focus-visible:ring-red-500" : ""}
                                            />
                                            {formErrors.leadTime && <p className="text-sm text-red-500">{formErrors.leadTime}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="deliveryWindow">Delivery Date</Label>
                                            <Input
                                                id="deliveryWindow"
                                                type="date"
                                                value={deliveryWindow}
                                                onChange={(e) => setDeliveryWindow(e.target.value)}
                                                disabled={submitting}
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="notes">Notes / Substitutions (Optional)</Label>
                                        <Textarea
                                            id="notes"
                                            placeholder="Any conditions or alternative materials..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            disabled={submitting}
                                        />
                                    </div>
                                </>
                            )}
                        </CardContent>
                        {!hasBid && !isWinner && !isLoser && (
                            <CardFooter>
                                <Button
                                    className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                                    onClick={handleSubmitBid}
                                    disabled={submitting}
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {submitting ? 'Submitting...' : 'Submit Bid'}
                                </Button>
                            </CardFooter>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
