'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Inbox, LogOut, Loader2, MapPin, Tag } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { formatTitle } from '@/lib/utils/format';

export default function SupplierInbox() {
    const [rfqs, setRfqs] = useState<any[]>([]);
    const [profile, setProfile] = useState<{ categories: string[], serviceArea: string[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchMatchedRFQs = async () => {
            if (!auth.currentUser) return;

            try {
                // Fetch profile data for visibility
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (userDoc.exists()) {
                    setProfile({
                        categories: userDoc.data().categories || [],
                        serviceArea: userDoc.data().serviceArea || []
                    });
                }

                const q = query(
                    collection(db, 'rfqs'),
                    where('status', 'in', ['sent', 'selected']),
                    where('matchingSupplierIds', 'array-contains', auth.currentUser.uid),
                    orderBy('createdAt', 'desc')
                );

                const querySnapshot = await getDocs(q);
                let fetchedRfqs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Fetch all bids by this supplier to match selectedBidIds
                const bidsQuery = query(
                    collection(db, 'bids'),
                    where('supplierId', '==', auth.currentUser.uid)
                );
                const bidsSnap = await getDocs(bidsQuery);
                const myBidsByRfqId: Record<string, string> = {};
                bidsSnap.docs.forEach(doc => {
                    myBidsByRfqId[doc.data().rfqId] = doc.id;
                });

                fetchedRfqs = fetchedRfqs.map((rfq: any) => ({
                    ...rfq,
                    myBidId: myBidsByRfqId[rfq.id] || null
                }));

                setRfqs(fetchedRfqs);
            } catch (error) {
                console.error('Error fetching matched RFQs:', error);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchMatchedRFQs();
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

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-400/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-violet-400/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

            <header className="bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <h1 className="text-xl font-bold tracking-tight">Supplier Inbox</h1>
                    <Button variant="ghost" size="icon" onClick={handleLogout}>
                        <LogOut className="w-4 h-4" />
                    </Button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {profile && (
                    <Card className="mb-8 border-0 ring-1 ring-slate-200/50 shadow-xl shadow-slate-200/40 bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden">
                        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-gradient-to-br from-indigo-50/50 to-white">
                            <div>
                                <h2 className="font-semibold text-slate-800 mb-2">Your Matching Profile</h2>
                                <p className="text-sm text-slate-500 max-w-2xl">
                                    You will only receive requests that match your selected categories and service areas.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 min-w-[200px]">
                                <div className="flex items-center gap-2 text-sm">
                                    <Tag className="w-4 h-4 text-indigo-500" />
                                    <span className="font-medium text-slate-700">Categories:</span>
                                    <span className="text-slate-600">{profile.categories.join(', ') || 'None set'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <MapPin className="w-4 h-4 text-indigo-500" />
                                    <span className="font-medium text-slate-700">Service Area:</span>
                                    <span className="text-slate-600">{profile.serviceArea.join(', ') || 'None set'}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    </div>
                ) : rfqs.length === 0 ? (
                    <Card className="text-center py-16">
                        <CardContent className="flex flex-col items-center justify-center space-y-4">
                            <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center">
                                <Inbox className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div>
                                <CardTitle className="mb-2">No Matching RFQs</CardTitle>
                                <CardDescription>
                                    There are currently no open requests that match your service categories.
                                </CardDescription>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {rfqs.map((rfq) => (
                            <Card
                                key={rfq.id}
                                className="hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden"
                                onClick={() => router.push(`/supplier/rfq/${rfq.id}`)}
                            >
                                <div className={`absolute top-0 left-0 w-full h-1 ${rfq.status === 'sent' && !rfq.myBidId ? 'bg-indigo-500' :
                                    rfq.status === 'sent' && rfq.myBidId ? 'bg-emerald-500' :
                                        rfq.selectedBidId && rfq.selectedBidId === rfq.myBidId ? 'bg-amber-500' :
                                            'bg-slate-300'
                                    }`}></div>
                                <div className="p-6 pt-7">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold text-lg text-slate-900">
                                                {rfq.structuredData?.category ? `${formatTitle(rfq.structuredData.category)} Request` : 'Project Request'}
                                            </h3>
                                            <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                                                <span className="flex items-center gap-1">📍 {formatTitle(rfq.structuredData?.delivery?.city || "")}</span>
                                                <span className="flex items-center gap-1">⏳ {rfq.structuredData?.neededBy}</span>
                                            </div>
                                        </div>
                                        {rfq.status === 'sent' && !rfq.myBidId ? (
                                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                                                New Opportunity
                                            </Badge>
                                        ) : rfq.status === 'sent' && rfq.myBidId ? (
                                            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200">
                                                Bid Sent
                                            </Badge>
                                        ) : rfq.selectedBidId && rfq.selectedBidId === rfq.myBidId ? (
                                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                                                🎉 Won Bid
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                                                Closed
                                            </Badge>
                                        )}
                                    </div>

                                    {rfq.structuredData?.items && rfq.structuredData.items.length > 0 && (
                                        <div className="mt-4 flex gap-2 flex-wrap">
                                            {rfq.structuredData.items.slice(0, 3).map((item: any, idx: number) => (
                                                <span key={idx} className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs select-none">
                                                    {item.quantity} {item.unit} {item.name}
                                                </span>
                                            ))}
                                            {rfq.structuredData.items.length > 3 && (
                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs select-none">
                                                    +{rfq.structuredData.items.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
