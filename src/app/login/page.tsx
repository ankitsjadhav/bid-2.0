'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let userCredential;
            if (isRegister) {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email: userCredential.user.email,
                    createdAt: new Date().toISOString(),
                    // role will be set in onboarding
                });
                toast.success("Account created successfully!");
            } else {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
                toast.success("Signed in successfully!");
            }

            const token = await userCredential.user.getIdToken();
            // Simple cookie set for middleware - in production use secure custom token or API route
            document.cookie = `session=${token}; path=/`;

            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            const userData = userDoc.data();
            const role = userData?.role;

            if (role) {
                document.cookie = `user_role=${role}; path=/`;

                // If supplier is missing required fields, force onboarding
                if (role === 'supplier') {
                    const isFullyOnboarded = userData?.categories?.length > 0 && userData?.serviceArea?.length > 0;
                    if (isFullyOnboarded) {
                        document.cookie = `supplier_onboarded=true; path=/`;
                        router.push('/supplier/inbox');
                    } else {
                        document.cookie = `supplier_onboarded=false; path=/`;
                        router.push('/onboarding');
                    }
                    return;
                }

                router.push('/contractor/dashboard');
            } else {
                router.push('/onboarding');
            }
        } catch (err: any) {
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                toast.error("Account not found or invalid credentials. Please check your email/password or Register for a new account.");
            } else {
                toast.error(err.message || "An error occurred during authentication.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);

            let userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email: userCredential.user.email,
                    name: userCredential.user.displayName,
                    createdAt: new Date().toISOString(),
                });
                userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
                toast.success("Account created successfully with Google!");
            } else {
                toast.success("Signed in successfully with Google!");
            }

            const token = await userCredential.user.getIdToken();
            document.cookie = `session=${token}; path=/`;

            const userData = userDoc.data();
            const role = userData?.role;

            if (role) {
                document.cookie = `user_role=${role}; path=/`;

                if (role === 'supplier') {
                    const isFullyOnboarded = userData?.categories?.length > 0 && userData?.serviceArea?.length > 0;
                    if (isFullyOnboarded) {
                        document.cookie = `supplier_onboarded=true; path=/`;
                        router.push('/supplier/inbox');
                    } else {
                        document.cookie = `supplier_onboarded=false; path=/`;
                        router.push('/onboarding');
                    }
                    return;
                }

                router.push('/contractor/dashboard');
            } else {
                router.push('/onboarding');
            }
        } catch (err: any) {
            if (err.code === 'auth/popup-closed-by-user') {
                toast.error("Sign-in cancelled.");
            } else {
                toast.error(err.message || "An error occurred during Google authentication.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white">
            {/* Left Side: Premium Gradient & Branding */}
            <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-slate-900">
                {/* Dynamic Background Gradients */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900 via-slate-900 to-violet-900 z-0"></div>
                <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-500/20 blur-[120px] mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-violet-600/20 blur-[100px] mix-blend-screen"></div>

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
                        The intelligent marketplace for <span className="text-indigo-400">Materials & Services.</span>
                    </h2>
                    <p className="text-slate-300 text-lg leading-relaxed mb-8">
                        Connect with top-tier suppliers instantly. Use AI to structure your requests, secure bids, and close deals faster than ever before.
                    </p>

                    <div className="flex items-center gap-4 text-sm text-slate-400">
                        <div className="flex -space-x-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className={`w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center`}>
                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 opacity-50"></div>
                                </div>
                            ))}
                        </div>
                        <p>Join <span className="text-white font-medium">10,000+</span> professionals</p>
                    </div>
                </div>
            </div>

            {/* Right Side: Auth Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative bg-slate-50/50">
                {/* Mobile ambient background */}
                <div className="lg:hidden absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-50 to-indigo-50/50 -z-10"></div>

                <Card className="w-full max-w-md border-0 shadow-2xl shadow-indigo-900/5 bg-white/80 backdrop-blur-xl relative overflow-hidden">
                    {/* Subtle card gradient highlight */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500"></div>

                    <CardHeader className="space-y-3 pb-8 pt-10">
                        <div className="lg:hidden flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                                <span className="text-lg font-bold text-white">B</span>
                            </div>
                            <span className="text-xl font-bold tracking-tight text-slate-900">Bid 2.0</span>
                        </div>
                        <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">
                            {isRegister ? 'Create an Account' : 'Welcome Back'}
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-base">
                            {isRegister ? 'Enter your details to get started with Bid 2.0' : 'Sign in to your account to continue'}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <form onSubmit={handleAuth} className="space-y-5">
                            <div className="space-y-2.5">
                                <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-12 bg-white/50 border-slate-200 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all rounded-xl shadow-sm"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                                    {!isRegister && (
                                        <Button variant="link" className="p-0 h-auto text-xs text-indigo-600 hover:text-indigo-700 font-medium" type="button">
                                            Forgot password?
                                        </Button>
                                    )}
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-12 bg-white/50 border-slate-200 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all rounded-xl shadow-sm"
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-indigo-600/30"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                        <span>Processing...</span>
                                    </div>
                                ) : (isRegister ? 'Create Account' : 'Sign In')}
                            </Button>
                        </form>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink-0 mx-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Or continue with
                            </span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        <Button
                            variant="outline"
                            type="button"
                            className="w-full h-12 bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-3"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Google
                        </Button>
                    </CardContent>

                    <CardFooter className="flex justify-center pb-8 pt-4 border-t border-slate-100 bg-slate-50/50 mt-4">
                        <Button
                            variant="ghost"
                            className="text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors rounded-lg font-medium"
                            onClick={() => setIsRegister(!isRegister)}
                        >
                            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
                        </Button>
                    </CardFooter>
                </Card>

            </div>
        </div>
    );
}
