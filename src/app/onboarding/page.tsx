'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingPage() {
    const [role, setRole] = useState<'contractor' | 'supplier' | null>(null);
    const [loading, setLoading] = useState(false);

    // Supplier specific fields
    const [category, setCategory] = useState<string>('');
    const [serviceArea, setServiceArea] = useState<string>('');

    const router = useRouter();

    const handleRoleSelection = async () => {
        if (!role || !auth.currentUser) return;

        // Validation for Supplier
        if (role === 'supplier') {
            if (!category || !serviceArea.trim()) {
                toast.error("Please fill out both Category and Service Area.");
                return;
            }
        }

        setLoading(true);
        try {
            const updatePayload: any = {
                role: role,
                updatedAt: new Date().toISOString()
            };

            // Inject supplier matching arrays as required by logic
            if (role === 'supplier') {
                updatePayload.categories = [category.trim().toLowerCase()];
                updatePayload.serviceArea = serviceArea.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            }

            await updateDoc(doc(db, 'users', auth.currentUser.uid), updatePayload);

            document.cookie = `user_role=${role}; path=/`;

            if (role === 'supplier') {
                document.cookie = `supplier_onboarded=true; path=/`;
                router.push('/supplier/inbox');
            } else {
                router.push('/contractor/dashboard');
            }
        } catch (error) {
            console.error('Error updating role:', error);
            toast.error("An error occurred while saving your profile.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white">
            {/* Left Side: Premium Gradient & Branding */}
            <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-slate-900 border-r border-slate-800">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900 via-slate-900 to-emerald-900 z-0"></div>
                <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-emerald-500/20 blur-[120px] mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[100px] mix-blend-screen"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                            <span className="text-xl font-bold text-white">B</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Bid 2.0</h1>
                    </div>
                </div>

                <div className="relative z-10 max-w-lg mb-12">
                    <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
                        Complete your <span className="text-emerald-400">Profile.</span>
                    </h2>
                    <p className="text-slate-300 text-lg leading-relaxed mb-8">
                        Tell us how you intend to use the platform so we can tailor the experience perfectly to your business needs.
                    </p>
                </div>
            </div>

            {/* Right Side: Onboarding Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-slate-50/50 overflow-y-auto">
                <div className="lg:hidden absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-50 to-emerald-50/50 -z-10 bg-fixed"></div>

                <Card className="w-full max-w-lg border-0 shadow-2xl shadow-slate-900/5 bg-white/80 backdrop-blur-xl relative overflow-hidden my-auto">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-indigo-500"></div>

                    <CardHeader className="space-y-3 pb-8 pt-10">
                        <div className="lg:hidden flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                                <span className="text-lg font-bold text-white">B</span>
                            </div>
                            <span className="text-xl font-bold tracking-tight text-slate-900">Bid 2.0</span>
                        </div>
                        <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">Choose your path</CardTitle>
                        <CardDescription className="text-slate-500 text-base">
                            Select how you want to use the platform.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 lg:px-10 pb-10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div
                                onClick={() => setRole('contractor')}
                                className={`p-6 border-2 rounded-2xl cursor-pointer transition-all duration-200 group relative ${role === 'contractor'
                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-600/10 scale-[1.02] z-10'
                                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                    }`}
                            >
                                {role === 'contractor' && (
                                    <div className="absolute top-3 right-3 text-indigo-600">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${role === 'contractor' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold mb-2 text-slate-900">Contractor</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">I want to create RFQs and get competitive bids.</p>
                            </div>

                            <div
                                onClick={() => setRole('supplier')}
                                className={`p-6 border-2 rounded-2xl cursor-pointer transition-all duration-200 group relative ${role === 'supplier'
                                    ? 'border-emerald-600 bg-emerald-50/50 shadow-md shadow-emerald-600/10 scale-[1.02] z-10'
                                    : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                                    }`}
                            >
                                {role === 'supplier' && (
                                    <div className="absolute top-3 right-3 text-emerald-600">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${role === 'supplier' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold mb-2 text-slate-900">Supplier</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">I want to receive matched RFQs and submit quotes.</p>
                            </div>
                        </div>

                        {role === 'supplier' && (
                            <div className="space-y-5 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
                                <h4 className="font-bold text-slate-900">Supplier Profile Setup</h4>

                                <div className="space-y-2.5">
                                    <Label htmlFor="category" className="text-sm font-medium text-slate-700">Primary Service Category<span className="text-red-500 ml-1">*</span></Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger id="category" className={`h-12 bg-white/50 rounded-xl transition-all ${!category ? 'border-red-300' : 'border-slate-200 focus:ring-emerald-500 focus:border-emerald-500'}`}>
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="Lumber">Lumber</SelectItem>
                                            <SelectItem value="Plumbing">Plumbing</SelectItem>
                                            <SelectItem value="Electrical">Electrical</SelectItem>
                                            <SelectItem value="Concrete">Concrete</SelectItem>
                                            <SelectItem value="HVAC">HVAC</SelectItem>
                                            <SelectItem value="Roofing">Roofing</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2.5">
                                    <Label htmlFor="serviceArea" className="text-sm font-medium text-slate-700">Service Area <span className="font-normal text-slate-400">(Cities/Zip)</span><span className="text-red-500 ml-1">*</span></Label>
                                    <Input
                                        id="serviceArea"
                                        placeholder="e.g. Austin, 78701, Dallas"
                                        value={serviceArea}
                                        onChange={(e) => setServiceArea(e.target.value)}
                                        className={`h-12 bg-white/50 rounded-xl transition-all ${!serviceArea.trim() ? 'border-red-300' : 'border-slate-200 focus-visible:ring-emerald-500 focus-visible:border-emerald-500'}`}
                                    />
                                    <p className="text-xs text-slate-500 ml-1">Separate multiple areas with commas.</p>
                                </div>
                            </div>
                        )}

                        <Button
                            className={`w-full text-base h-12 mt-8 rounded-xl font-medium shadow-md transition-all active:scale-[0.98] ${role === 'contractor'
                                ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-600/30 shadow-indigo-600/20 text-white'
                                : role === 'supplier'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/30 shadow-emerald-600/20 text-white'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                }`}
                            disabled={!role || loading || (role === 'supplier' && (!category || !serviceArea.trim()))}
                            onClick={handleRoleSelection}
                        >
                            {loading && (
                                <div className="mr-2">
                                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                </div>
                            )}
                            {loading ? 'Saving Profile...' : 'Complete Setup'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
