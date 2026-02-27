'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, PlusCircle, LogOut, Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';

export default function ContractorDashboard() {
    const [rfqs, setRfqs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchRFQs = async () => {
            if (!auth.currentUser) return;

            try {
                const q = query(
                    collection(db, 'rfqs'),
                    where('contractorId', '==', auth.currentUser.uid),
                    orderBy('createdAt', 'desc')
                );

                const querySnapshot = await getDocs(q);
                const fetchedRfqs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setRfqs(fetchedRfqs);
            } catch (error) {
                console.error('Error fetching RFQs:', error);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchRFQs();
            } else {
                router.push('/login');
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleLogout = async () => {
        await signOut(auth);
        document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'user_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        router.push('/login');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-slate-100 text-slate-800';
            case 'sent': return 'bg-blue-100 text-blue-800';
            case 'selected': return 'bg-green-100 text-green-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Ambient Background Blur */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/5 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/5 blur-[120px]"></div>
            </div>

            <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-slate-200/60 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
                            <span className="text-sm font-bold text-white">B</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">Contractor <span className="text-slate-400 font-medium">Dashboard</span></h1>
                    </div>
                    <div className="flex gap-3 items-center">
                        <Button
                            onClick={() => router.push('/contractor/rfq/new')}
                            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all rounded-xl hover:shadow-lg active:scale-95"
                        >
                            <PlusCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">New RFQ</span>
                        </Button>
                        <div className="h-6 w-px bg-slate-200 mx-1"></div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleLogout}
                            className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900">Your Opportunities</h2>
                    <p className="text-slate-500 mt-1">Manage all your material and service requests in one place.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-24">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-indigo-600 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                ) : rfqs.length === 0 ? (
                    <Card className="text-center py-20 border-0 shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-50"></div>
                        <CardContent className="flex flex-col items-center justify-center space-y-5">
                            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center border border-indigo-100/50 shadow-inner">
                                <FileText className="h-8 w-8 text-indigo-500" />
                            </div>
                            <div className="max-w-md">
                                <CardTitle className="mb-3 text-2xl font-bold text-slate-900">No active requests</CardTitle>
                                <CardDescription className="text-base text-slate-500 leading-relaxed">
                                    You haven't created any Requests for Quotes yet. Start sourcing materials instantly with our AI-powered structuring engine.
                                </CardDescription>
                            </div>
                            <Button
                                onClick={() => router.push('/contractor/rfq/new')}
                                className="mt-6 bg-indigo-600 text-white hover:bg-indigo-700 h-12 px-8 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                            >
                                <PlusCircle className="mr-2 h-5 w-5" /> Create your first RFQ
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-5">
                        {rfqs.map((rfq) => (
                            <Card
                                key={rfq.id}
                                className="group cursor-pointer border-0 ring-1 ring-slate-200/50 shadow-md shadow-slate-200/20 bg-white hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-1 transition-all duration-300 rounded-2xl overflow-hidden"
                                onClick={() => router.push(`/contractor/rfq/${rfq.id}`)}
                            >
                                <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${rfq.status === 'draft' ? 'bg-amber-400' : rfq.status === 'sent' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                                            <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                {rfq.structuredData?.category ? `${rfq.structuredData.category} Request` : 'Draft Request'}
                                            </h3>
                                        </div>
                                        <div className="text-sm text-slate-500 flex items-center gap-4 pl-5">
                                            <span className="flex items-center gap-1.5 opacity-80">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                {new Date(rfq.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            {rfq.structuredData?.delivery?.city && (
                                                <span className="flex items-center gap-1.5 font-medium text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs">
                                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    {rfq.structuredData.delivery.city}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Badge
                                        className={`px-3 py-1.5 rounded-lg font-medium text-sm shadow-none ${rfq.status === 'draft' ? 'bg-amber-50 text-amber-700 border border-amber-200/50 hover:bg-amber-100' :
                                                rfq.status === 'sent' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50 hover:bg-indigo-100' :
                                                    'bg-emerald-50 text-emerald-700 border border-emerald-200/50 hover:bg-emerald-100'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {rfq.status === 'selected' && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                            {rfq.status === 'sent' && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                                            {rfq.status === 'draft' && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                                            {rfq.status ? rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1) : 'Unknown'}
                                        </div>
                                    </Badge>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
