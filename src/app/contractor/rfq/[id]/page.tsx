'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, TrendingUp, Clock, Info, Loader2, Send, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { analyzeBidsAction } from '@/lib/actions/analyzeBids';
import { formatTitle } from '@/lib/utils/format';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function ContractorRFQDetail() {
    const router = useRouter();
    const { id } = useParams();

    const [rfq, setRfq] = useState<any>(null);
    const [bids, setBids] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('priceAsc');
    const [isSelecting, setIsSelecting] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [aiSummary, setAiSummary] = useState<any>(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

    useEffect(() => {
        const fetchRFQAndBids = async () => {
            if (!auth.currentUser || !id) return;

            try {
                const rfqDoc = await getDoc(doc(db, 'rfqs', id as string));
                if (rfqDoc.exists()) {
                    const rfqData = rfqDoc.data();
                    if (rfqData.contractorId !== auth.currentUser.uid) {
                        router.push('/contractor/dashboard');
                        return;
                    }
                    setRfq({ id: rfqDoc.id, ...rfqData });
                }

                // If it's a draft, it won't have bids anyway, but safe to query
                if (rfqDoc.data()?.status !== 'draft') {
                    const bidQuery = query(
                        collection(db, 'bids'),
                        where('rfqId', '==', id)
                    );
                    const bidDocs = await getDocs(bidQuery);

                    let fetchedBids: any[] = [];
                    for (const bidDoc of bidDocs.docs) {
                        const bidData = bidDoc.data();
                        const supplierDoc = await getDoc(doc(db, 'users', bidData.supplierId));
                        fetchedBids.push({
                            id: bidDoc.id,
                            ...bidData,
                            supplierName: supplierDoc.data()?.name || supplierDoc.data()?.email || 'Unknown Supplier'
                        });
                    }

                    setBids(fetchedBids);
                }
            } catch (err) {
                toast.error('Error fetching RFQ and Bids');
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchRFQAndBids();
        });

        return () => unsubscribe();
    }, [id, router]);

    const computeMatchingSuppliers = async (category: string, city: string) => {
        const q = query(
            collection(db, 'users'),
            where('role', '==', 'supplier')
        );
        const snapshot = await getDocs(q);
        const matches: string[] = [];

        const normalizedCategory = category.trim().toLowerCase();
        const normalizedCity = city.trim().toLowerCase();

        snapshot.forEach(doc => {
            const data = doc.data();

            const hasCategoryMatch = data.categories?.some((cat: string) =>
                cat?.toLowerCase()?.trim() === normalizedCategory
            );

            let hasCityMatch = true;
            if (data.serviceArea && Array.isArray(data.serviceArea) && data.serviceArea.length > 0) {
                hasCityMatch = data.serviceArea.some((s: string) =>
                    s?.toLowerCase()?.trim() === normalizedCity
                );
            }

            if (hasCategoryMatch && hasCityMatch) {
                matches.push(doc.id);
            }
        });
        return matches;
    };

    const handleSendDraft = async () => {
        if (!auth.currentUser || !id || !rfq || isSending) return;

        // Validation for sending
        const category = rfq.structuredData?.category;
        const city = rfq.structuredData?.delivery?.city;

        if (!category || !city) {
            toast.error("Cannot send draft. Missing category or delivery city in structured data.");
            return;
        }

        setIsSending(true);
        toast.loading("Finding matching suppliers and sending...");

        try {
            const matchingSupplierIds = await computeMatchingSuppliers(category, city);

            if (matchingSupplierIds.length === 0) {
                toast.dismiss();
                toast.error("No matching suppliers found for this category and city.");
                setIsSending(false);
                return;
            }

            const rfqRef = doc(db, 'rfqs', id as string);
            await updateDoc(rfqRef, {
                status: 'sent',
                matchingSupplierIds
            });

            setRfq((prev: any) => ({ ...prev, status: 'sent', matchingSupplierIds }));
            toast.dismiss();
            toast.success("Successfully sent to matching suppliers!");
        } catch (err) {
            toast.dismiss();
            toast.error("Failed to send RFQ.");
        } finally {
            setIsSending(false);
        }
    };

    const handleGenerateSummary = async () => {
        setIsGeneratingSummary(true);
        try {
            const result = await analyzeBidsAction(rfq.structuredData, bids);
            if (result.success) {
                setAiSummary(result.data);
                toast.success("AI Recommendation complete!");
            } else {
                toast.error(result.error || "Failed to generate AI recommendation.");
            }
        } catch (err) {
            toast.error("An error occurred during AI analysis.");
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const handleSelectBid = async (bidId: string) => {
        if (!auth.currentUser || !id || isSelecting) return;
        setIsSelecting(true);
        toast.loading("Selecting bid...");
        try {
            const batch = writeBatch(db);

            const rfqRef = doc(db, 'rfqs', id as string);
            batch.update(rfqRef, {
                status: 'selected',
                selectedBidId: bidId
            });

            const bidRef = doc(db, 'bids', bidId);
            batch.update(bidRef, {
                selected: true
            });

            await batch.commit();

            setRfq((prev: any) => ({ ...prev, status: 'selected', selectedBidId: bidId }));
            setBids(prev => prev.map(b => b.id === bidId ? { ...b, selected: true } : b));
            toast.dismiss();
            toast.success("Winner selected successfully!");
        } catch (err) {
            toast.dismiss();
            toast.error('Error selecting bid');
        } finally {
            setIsSelecting(false);
        }
    };

    const sortedBids = [...bids].sort((a, b) => {
        if (sortBy === 'priceAsc') return a.pricing - b.pricing;
        if (sortBy === 'priceDesc') return b.pricing - a.pricing;
        if (sortBy === 'leadTimeAsc') return a.leadTime.localeCompare(b.leadTime);
        return 0;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!rfq) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">RFQ not found.</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-12">
            {/* Ambient Background Blur */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/5 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/5 blur-[120px]"></div>
            </div>

            <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm mb-8">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        disabled={isSelecting || isSending}
                        className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors -ml-2"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                    </Button>
                    <Badge
                        className={`px-3 py-1.5 rounded-lg font-medium text-sm shadow-none ${rfq.status === 'draft' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                            rfq.status === 'sent' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50' :
                                'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                            }`}
                    >
                        {rfq.status ? rfq.status.toUpperCase() : 'UNKNOWN'}
                    </Badge>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                        {rfq.structuredData?.category ? `${formatTitle(rfq.structuredData.category)} Request` : 'Project Request'}
                    </h2>
                    <p className="text-slate-500 mt-2 text-base flex items-center gap-2">
                        <span>Created on {new Date(rfq.createdAt).toLocaleDateString()}</span>
                        {rfq.structuredData?.delivery?.city && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span>Delivery to {formatTitle(rfq.structuredData.delivery.city)}</span>
                            </>
                        )}
                    </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                    <div className="xl:col-span-1 space-y-6">
                        <Card className="border-0 ring-1 ring-slate-200/50 shadow-xl shadow-slate-200/40 bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-400 to-slate-300"></div>
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 pb-5">
                                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Info className="w-5 h-5 text-slate-500" />
                                    Request Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5 p-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                                        <span className="text-xs font-semibold text-slate-500 block mb-1 uppercase tracking-wider">Category</span>
                                        <p className="font-medium text-slate-900 truncate">{formatTitle(rfq.structuredData?.category) || 'N/A'}</p>
                                    </div>
                                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                                        <span className="text-xs font-semibold text-slate-500 block mb-1 uppercase tracking-wider">Needed By</span>
                                        <p className="font-medium text-slate-900 truncate">{rfq.structuredData?.neededBy || 'N/A'}</p>
                                    </div>
                                    <div className="col-span-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                                        <span className="text-xs font-semibold text-slate-500 block mb-1 uppercase tracking-wider">Delivery City</span>
                                        <p className="font-medium text-slate-900">{formatTitle(rfq.structuredData?.delivery?.city) || 'N/A'}</p>
                                    </div>
                                </div>

                                {rfq.structuredData?.items && rfq.structuredData.items.length > 0 && (
                                    <div className="pt-5 border-t border-slate-100">
                                        <span className="text-xs font-semibold text-slate-500 block mb-3 uppercase tracking-wider">Requested Line Items</span>
                                        <ul className="space-y-2">
                                            {rfq.structuredData.items.map((item: any, idx: number) => (
                                                <li key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-xl border-slate-100 shadow-sm ring-1 ring-slate-100 text-sm hover:shadow-md transition-all">
                                                    <span className="font-medium text-slate-800">{item.name}</span>
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-medium shadow-none">
                                                        {item.quantity} {item.unit}
                                                    </Badge>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {rfq.status === 'draft' && (
                                    <div className="pt-6 border-t border-slate-100">
                                        <Button
                                            className="w-full h-12 gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all font-medium text-base border-0"
                                            onClick={handleSendDraft}
                                            disabled={isSending}
                                        >
                                            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                            {isSending ? 'Sending to network...' : 'Broadcast to Suppliers'}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {bids.length > 0 && rfq.status === 'sent' && (
                        <div className="xl:col-span-2">
                            {aiSummary ? (
                                <Card className="border-indigo-200/60 shadow-md shadow-indigo-100/50 bg-indigo-50/40 overflow-hidden relative group transition-all duration-500">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
                                    <CardHeader className="pb-3 border-b border-indigo-100/60 bg-white/50 backdrop-blur-sm relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center shadow-inner ring-1 ring-indigo-200/50">
                                                <Sparkles className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg font-bold text-slate-800">AI Recommendation</CardTitle>
                                                <p className="text-xs text-slate-500 font-medium">Analyzed based on your requirements and {bids.length} submitted quotes</p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6 relative z-10">
                                        <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                                            <div className="flex-1 space-y-6">
                                                <div>
                                                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-indigo-500/80 mb-2">Recommended Supplier</h4>
                                                    <div className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                                        {bids.find(b => b.id === aiSummary.recommendedBidId)?.supplierName || "Recommended Supplier"}
                                                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 ml-2 shadow-sm">Top Choice</Badge>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-indigo-500/80 mb-3">Reasoning</h4>
                                                    <ul className="space-y-2.5">
                                                        {aiSummary.reasoning.map((r: string, idx: number) => (
                                                            <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed font-medium">
                                                                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50 shrink-0"></div>
                                                                {r}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                {aiSummary.riskNote && (
                                                    <div className="bg-amber-50/80 text-amber-800 p-4 rounded-xl text-sm border border-amber-200/50 shadow-sm flex items-start gap-3">
                                                        <Info className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
                                                        <span className="leading-relaxed font-medium">{aiSummary.riskNote}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center md:items-end justify-start md:justify-end shrink-0 pt-4 md:pt-0 border-t border-slate-100 md:border-none">
                                                <Button
                                                    onClick={() => handleSelectBid(aiSummary.recommendedBidId)}
                                                    disabled={isSelecting}
                                                    className="w-full md:w-auto h-12 px-8 bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 text-white shadow-lg shadow-indigo-500/30 rounded-xl font-semibold transition-all active:scale-[0.98]"
                                                >
                                                    {isSelecting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                                                    Select This Bid
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="border-indigo-100/60 shadow-sm bg-gradient-to-br from-indigo-50/50 to-white overflow-hidden group hover:border-indigo-200 transition-colors duration-300">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                                    <CardContent className="p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                                        <div className="flex items-center gap-5 sm:w-2/3">
                                            <div className="w-14 h-14 shrink-0 rounded-2xl bg-white flex items-center justify-center ring-1 ring-indigo-100 shadow-sm group-hover:shadow-md transition-shadow">
                                                <Sparkles className="w-7 h-7 text-indigo-500 group-hover:text-indigo-600 transition-colors" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-1">Need help deciding?</h3>
                                                <p className="text-sm text-slate-500 leading-relaxed font-medium">Let our AI analyze your requirements against {bids.length} submitted quotes to instantly recommend the single most optimal bid.</p>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={handleGenerateSummary}
                                            disabled={isGeneratingSummary}
                                            className="w-full sm:w-auto shrink-0 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all font-semibold rounded-xl h-11 px-6 shadow-sm hover:shadow active:scale-[0.98]"
                                        >
                                            {isGeneratingSummary ? (
                                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing quotes...</>
                                            ) : (
                                                <><Sparkles className="w-4 h-4 mr-2" /> Generate AI Recommendation</>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    <div className="xl:col-span-2">
                        <Card className="h-full border-0 ring-1 ring-slate-200/50 shadow-xl shadow-slate-200/40 bg-white/90 backdrop-blur-xl rounded-2xl flex flex-col relative">
                            {/* We maintain rounded top corners for the gradient bar using a separate div with overflow hidden */}
                            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
                            </div>
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 bg-slate-50/30 px-6 pt-6 rounded-t-2xl">
                                <div>
                                    <CardTitle className="text-xl font-bold text-slate-900">Supplier Quotes</CardTitle>
                                    <p className="text-sm text-slate-500 mt-1">Review competitive bids ({bids.length} total) from our verified network.</p>
                                </div>

                                {bids.length > 0 && (
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center text-slate-500 sm:hidden">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                                        </div>
                                        <div className="flex items-center gap-2 flex-1 sm:flex-none">
                                            <span className="text-sm font-medium text-slate-600 hidden sm:inline">Sort by</span>
                                            <Select value={sortBy} onValueChange={setSortBy} disabled={isSelecting}>
                                                <SelectTrigger className="w-fit min-w-[190px] h-10 bg-white border-slate-200 rounded-xl font-medium focus:ring-indigo-500 transition-all text-slate-700">
                                                    <SelectValue placeholder="Sort Bids" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-200">
                                                    <SelectItem value="priceAsc">Price: Low to High</SelectItem>
                                                    <SelectItem value="priceDesc">Price: High to Low</SelectItem>
                                                    <SelectItem value="leadTimeAsc">Lead Time (A-Z)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </CardHeader>

                            <CardContent className="p-0 flex-1 flex flex-col">
                                {rfq.status === 'draft' ? (
                                    <div className="py-24 px-6 text-center flex-1 flex flex-col items-center justify-center bg-slate-50/50">
                                        <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center mb-6 ring-1 ring-slate-200 shadow-sm">
                                            <Info className="w-8 h-8 text-slate-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">Draft Mode Active</h3>
                                        <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
                                            This request hasn't been broadcasted yet. Click "Broadcast to Suppliers" to notify verified matches and start receiving quotes.
                                        </p>
                                    </div>
                                ) : bids.length === 0 ? (
                                    <div className="py-24 px-6 text-center flex-1 flex flex-col items-center justify-center bg-indigo-50/10">
                                        <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 border border-indigo-100 shadow-inner">
                                            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">Awaiting Supplier Responses</h3>
                                        <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
                                            We've notified the matching suppliers in your area. Check back shortly as they review your request and submit their best pricing.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto w-full">
                                        <Table className="w-full">
                                            <TableHeader className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
                                                <TableRow className="border-b border-slate-200 hover:bg-transparent">
                                                    <TableHead className="py-5 text-slate-500 font-semibold text-xs uppercase tracking-wider px-6">Supplier info</TableHead>
                                                    <TableHead className="py-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                                                        <div className="flex items-center gap-1.5">
                                                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Total Cost
                                                        </div>
                                                    </TableHead>
                                                    <TableHead className="py-5 text-slate-500 font-semibold text-xs uppercase tracking-wider hidden sm:table-cell">
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-indigo-500" /> Availability
                                                        </div>
                                                    </TableHead>
                                                    <TableHead className="py-5 text-slate-500 font-semibold text-xs uppercase tracking-wider hidden md:table-cell">Logistics & Notes</TableHead>
                                                    <TableHead className="py-5 text-right px-6"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedBids.map((bid) => (
                                                    <TableRow
                                                        key={bid.id}
                                                        className={`transition-colors border-b border-slate-100 ${bid.selected
                                                            ? "bg-emerald-50/60 hover:bg-emerald-50/80 border-emerald-100/50"
                                                            : rfq.status === 'selected'
                                                                ? "opacity-60 grayscale-[10%] hover:bg-slate-50/50"
                                                                : "hover:bg-slate-50"
                                                            }`}
                                                    >
                                                        <TableCell className="py-6 font-semibold text-slate-800 px-6 align-middle">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold ring-1 ${bid.selected ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-indigo-50 text-indigo-700 ring-indigo-100'}`}>
                                                                    {bid.supplierName.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <span className="block truncate max-w-[140px] leading-tight text-base">{bid.supplierName}</span>
                                                                    <span className="text-xs font-normal text-slate-400 sm:hidden block mt-1">{bid.leadTime}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-6 align-middle">
                                                            <span className="text-xl font-bold tracking-tight text-slate-900">${bid.pricing.toLocaleString()}</span>
                                                        </TableCell>
                                                        <TableCell className="py-6 align-middle font-medium text-slate-700 hidden sm:table-cell">
                                                            {bid.leadTime}
                                                        </TableCell>
                                                        <TableCell className="py-6 align-middle hidden md:table-cell max-w-[280px]">
                                                            <div className="flex flex-col gap-1.5">
                                                                {bid.delivery && (
                                                                    <span className="inline-flex w-fit items-center gap-1.5 font-medium text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm text-xs">
                                                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                                                                        {bid.delivery}
                                                                    </span>
                                                                )}

                                                                {bid.notes && (
                                                                    <Dialog>
                                                                        <DialogTrigger asChild>
                                                                            <div className="mt-2 cursor-pointer group w-fit">
                                                                                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 group-hover:text-indigo-600 transition-colors py-1">
                                                                                    <FileText className="w-4 h-4" />
                                                                                    View Note
                                                                                </div>
                                                                            </div>
                                                                        </DialogTrigger>
                                                                        <DialogContent className="sm:max-w-md rounded-2xl">
                                                                            <DialogHeader className="pb-4 border-b border-slate-100 mb-4">
                                                                                <DialogTitle className="flex items-center gap-2 text-slate-800">
                                                                                    <FileText className="w-5 h-5 text-indigo-500" />
                                                                                    Note from {bid.supplierName}
                                                                                </DialogTitle>
                                                                            </DialogHeader>
                                                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/60 max-h-[60vh] overflow-y-auto">
                                                                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                                                    {bid.notes}
                                                                                </p>
                                                                            </div>
                                                                        </DialogContent>
                                                                    </Dialog>
                                                                )}

                                                                {!bid.delivery && !bid.notes && (
                                                                    <span className="text-slate-400 italic text-xs">No extra details</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-6 text-right px-6 align-middle">
                                                            {rfq.status === 'selected' ? (
                                                                bid.selected ? (
                                                                    <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20 pointer-events-none gap-1.5 py-2 px-4 rounded-xl text-sm border-0">
                                                                        <CheckCircle2 className="w-4 h-4" /> Winner
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-slate-400 border-slate-200 bg-white pointer-events-none py-1.5 px-3 rounded-lg">
                                                                        Skipped
                                                                    </Badge>
                                                                )
                                                            ) : (
                                                                <Button
                                                                    onClick={() => handleSelectBid(bid.id)}
                                                                    disabled={isSelecting}
                                                                    className="w-full sm:w-auto bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all rounded-xl h-10 font-medium active:scale-95"
                                                                >
                                                                    {isSelecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                                                    Award Project
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
