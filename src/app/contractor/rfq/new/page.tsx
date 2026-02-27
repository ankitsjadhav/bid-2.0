'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { parseRfqAction } from '@/lib/actions/parseRfq';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Wand2, Save, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ParsedData = {
    category: string;
    items: { name: string; quantity: string | number; unit: string }[];
    delivery: { city: string; zip: string };
    neededBy: string;
    clarifyingQuestions: string[];
};

export default function NewRFQ() {
    const router = useRouter();
    const [rawText, setRawText] = useState('');
    const [loadingAI, setLoadingAI] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [parsedData, setParsedData] = useState<ParsedData | null>(null);

    const [manualCategory, setManualCategory] = useState('');
    const [manualCity, setManualCity] = useState('');
    const [manualDate, setManualDate] = useState('');
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

    const validateForm = (status: 'draft' | 'sent') => {
        const errors: { [key: string]: string } = {};
        if (!rawText.trim()) errors.rawText = "RFQ description is required.";

        if (!parsedData) {
            toast.error("You must structure requirements with AI before saving.");
            return false;
        }

        if (status === 'sent') {
            if (!parsedData.category && !manualCategory) errors.category = "Category is required to find suppliers.";
            if (!parsedData.delivery?.city && !manualCity) errors.city = "Delivery city is required to find suppliers.";
            if (!parsedData.neededBy && !manualDate) errors.date = "Needed-by date is required.";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleAIParse = async () => {
        if (!rawText.trim()) {
            setFormErrors(prev => ({ ...prev, rawText: "Please enter a description first." }));
            toast.error("Please enter a description first.");
            return;
        }

        setLoadingAI(true);
        setFormErrors({});
        toast.info("Structuring requirements with AI...");

        const result = await parseRfqAction(rawText);

        if (result.success && result.data) {
            setParsedData(result.data as ParsedData);
            toast.success("Successfully structured RFQ.");
        } else {
            toast.error(result.error || "Failed to parse RFQ. You can try again or fill fields manually.");
            setParsedData({
                category: '',
                items: [],
                delivery: { city: '', zip: '' },
                neededBy: '',
                clarifyingQuestions: []
            });
        }
        setLoadingAI(false);
    };

    const computeMatchingSuppliers = async (category: string, city: string) => {
        // Basic matching: Any supplier that has the requested category 
        // AND has the city in their service area
        const q = query(
            collection(db, 'users'),
            where('role', '==', 'supplier'),
            where('categories', 'array-contains', category)
        );

        const snapshot = await getDocs(q);
        const matches: string[] = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // Optional chaining in case serviceArea is missing
            if (data.serviceArea && Array.isArray(data.serviceArea)) {
                if (data.serviceArea.map((s: string) => s.toLowerCase()).includes(city.toLowerCase())) {
                    matches.push(doc.id);
                }
            } else {
                // If no strictly defined service area, match just on category for MVP
                matches.push(doc.id);
            }
        });

        return matches;
    };

    const handleSubmit = async (status: 'draft' | 'sent') => {
        const isValid = validateForm(status);
        if (!isValid) {
            toast.error("Please fill in all required fields.");
            return;
        }

        if (!auth.currentUser) return;
        setIsSaving(true);
        toast.loading(status === 'draft' ? "Saving draft..." : "Sending RFQ...");

        try {
            const finalCategory = parsedData?.category || manualCategory;
            const finalCity = parsedData?.delivery?.city || manualCity;
            const finalDate = parsedData?.neededBy || manualDate;
            const finalZip = parsedData?.delivery?.zip || "";

            let matchingSupplierIds: string[] = [];
            if (status === 'sent') {
                matchingSupplierIds = await computeMatchingSuppliers(finalCategory, finalCity);
                if (matchingSupplierIds.length === 0) {
                    toast.dismiss();
                    toast.error("No matching suppliers found for this category and city.");
                    setIsSaving(false);
                    return;
                }
            }

            const structData = {
                category: finalCategory,
                items: parsedData?.items || [],
                delivery: { city: finalCity, zip: finalZip },
                neededBy: finalDate,
                clarifyingQuestions: parsedData?.clarifyingQuestions || []
            };

            await addDoc(collection(db, 'rfqs'), {
                contractorId: auth.currentUser.uid,
                status,
                selectedBidId: null,
                rawText,
                structuredData: structData,
                matchingSupplierIds,
                createdAt: new Date().toISOString()
            });

            toast.dismiss();
            toast.success(status === 'draft' ? "Draft saved successfully!" : "RFQ sent to matching suppliers!");
            router.push('/contractor/dashboard');
        } catch (err: any) {
            toast.dismiss();
            toast.error(err.message || 'Error saving RFQ');
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-12">
            {/* Ambient Background Blur */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/5 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/5 blur-[120px]"></div>
            </div>

            <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm mb-8">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        disabled={isSaving || loadingAI}
                        className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors -ml-2"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                    </Button>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Create a Request</h2>
                    <p className="text-slate-500 mt-2 text-lg">Use our AI engine to structure your requirements instantly.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-5">
                        <Card className="border-0 ring-1 ring-slate-200/50 shadow-xl shadow-slate-200/40 bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden sticky top-28">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500"></div>
                            <CardHeader className="pb-4">
                                <CardTitle className="text-xl font-bold text-slate-900">What do you need?</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="space-y-2">
                                    <Textarea
                                        placeholder="E.g., I need 500 board feet of 2x4 framing lumber delivered to Seattle by next Tuesday."
                                        className={`min-h-[220px] text-base resize-none bg-white/50 border-slate-200 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all rounded-xl shadow-inner placeholder:text-slate-400 ${formErrors.rawText ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                        value={rawText}
                                        onChange={(e) => {
                                            setRawText(e.target.value);
                                            if (formErrors.rawText) setFormErrors(prev => ({ ...prev, rawText: "" }));
                                        }}
                                        disabled={loadingAI || isSaving}
                                    />
                                    {formErrors.rawText && <p className="text-sm font-medium text-red-500">{formErrors.rawText}</p>}
                                </div>

                                <Button
                                    onClick={handleAIParse}
                                    disabled={loadingAI || isSaving || !rawText.trim()}
                                    className="w-full h-12 text-base gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all rounded-xl"
                                >
                                    {loadingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                    {loadingAI ? 'Structuring magic...' : 'Structure with AI'}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-7">
                        {parsedData === null && (
                            <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50">
                                <Wand2 className="w-12 h-12 mb-4 text-slate-300" />
                                <h3 className="text-lg font-medium text-slate-600 mb-1">Awaiting input</h3>
                                <p className="max-w-sm">Describe your needs on the left, and our AI will automatically structure the perfect RFQ document here.</p>
                            </div>
                        )}

                        {parsedData !== null && (
                            <Card className="border-0 ring-1 ring-slate-200/50 shadow-xl shadow-slate-200/40 bg-white/90 backdrop-blur-xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
                                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl font-bold text-slate-900">Structured RFQ</CardTitle>
                                            <p className="text-sm text-slate-500 mt-0.5">Review and finalize the extracted details.</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6 lg:px-8">
                                    <div className="space-y-2.5">
                                        <Label className={`text-sm font-semibold ${formErrors.category ? "text-red-500" : "text-slate-700"}`}>Primary Category</Label>
                                        <Input
                                            value={parsedData.category || manualCategory}
                                            onChange={e => {
                                                if (parsedData.category) setParsedData({ ...parsedData, category: e.target.value });
                                                else setManualCategory(e.target.value);
                                                if (formErrors.category) setFormErrors(prev => ({ ...prev, category: "" }));
                                            }}
                                            placeholder="E.g., Lumber"
                                            className={`h-11 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-xl transition-all ${formErrors.category ? "border-red-500 ring-1 ring-red-500" : ""}`}
                                            disabled={isSaving}
                                        />
                                        {formErrors.category && <p className="text-sm text-red-500">{formErrors.category}</p>}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div className="space-y-2.5">
                                            <Label className={`text-sm font-semibold ${formErrors.city ? "text-red-500" : "text-slate-700"}`}>Delivery City</Label>
                                            <Input
                                                value={parsedData.delivery?.city || manualCity}
                                                onChange={e => {
                                                    if (parsedData.delivery?.city) setParsedData({ ...parsedData, delivery: { ...parsedData.delivery, city: e.target.value } });
                                                    else setManualCity(e.target.value);
                                                    if (formErrors.city) setFormErrors(prev => ({ ...prev, city: "" }));
                                                }}
                                                placeholder="Seattle"
                                                className={`h-11 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-xl transition-all ${formErrors.city ? "border-red-500 ring-1 ring-red-500" : ""}`}
                                                disabled={isSaving}
                                            />
                                            {formErrors.city && <p className="text-sm text-red-500">{formErrors.city}</p>}
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label className={`text-sm font-semibold ${formErrors.date ? "text-red-500" : "text-slate-700"}`}>Needed By</Label>
                                            <Input
                                                value={parsedData.neededBy || manualDate}
                                                onChange={e => {
                                                    if (parsedData.neededBy) setParsedData({ ...parsedData, neededBy: e.target.value });
                                                    else setManualDate(e.target.value);
                                                    if (formErrors.date) setFormErrors(prev => ({ ...prev, date: "" }));
                                                }}
                                                placeholder="Next Tuesday"
                                                className={`h-11 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-xl transition-all ${formErrors.date ? "border-red-500 ring-1 ring-red-500" : ""}`}
                                                disabled={isSaving}
                                            />
                                            {formErrors.date && <p className="text-sm text-red-500">{formErrors.date}</p>}
                                        </div>
                                    </div>

                                    {parsedData.items.length > 0 && (
                                        <div className="pt-6 border-t border-slate-100 space-y-3">
                                            <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                                Extracted Line Items
                                            </Label>
                                            <div className="bg-slate-50/80 border border-slate-100 rounded-xl overflow-hidden">
                                                {parsedData.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center p-3 border-b border-slate-100/60 last:border-0 hover:bg-white transition-colors">
                                                        <span className="font-medium text-slate-800">{item.name}</span>
                                                        <Badge variant="secondary" className="bg-white border border-slate-200 text-slate-600 shadow-sm">{item.quantity} {item.unit}</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {parsedData.clarifyingQuestions?.length > 0 && (
                                        <div className="pt-6 border-t border-slate-100 space-y-3">
                                            <Label className="text-sm font-semibold text-amber-600 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                AI Clarification Needed
                                            </Label>
                                            <div className="bg-amber-50 border border-amber-100/50 rounded-xl p-4">
                                                <ul className="text-sm text-amber-800 space-y-2">
                                                    {parsedData.clarifyingQuestions.map((q, idx) => (
                                                        <li key={idx} className="flex gap-2">
                                                            <span className="text-amber-400 mt-0.5">•</span>
                                                            <span className="leading-relaxed">{q}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                </CardContent>
                                <CardFooter className="bg-slate-50 border-t border-slate-100 p-6 lg:px-8 flex flex-col sm:flex-row gap-4">
                                    <Button
                                        variant="outline"
                                        className="w-full sm:flex-1 h-12 gap-2 border-slate-200 hover:bg-slate-100 rounded-xl font-medium text-slate-700 transition-all active:scale-[0.98]"
                                        disabled={isSaving}
                                        onClick={() => handleSubmit('draft')}
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Save className="w-5 h-5 text-slate-400" />}
                                        Save Draft
                                    </Button>
                                    <Button
                                        className="w-full sm:flex-[2] h-12 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all"
                                        disabled={isSaving}
                                        onClick={() => handleSubmit('sent')}
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                        Send to Suppliers Now
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
