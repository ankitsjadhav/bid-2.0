import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
    const session = request.cookies.get('session');
    const role = request.cookies.get('user_role');
    const onboarded = request.cookies.get('supplier_onboarded');
    const path = request.nextUrl.pathname;

    const isAuthRoute = path === '/login' || path === '/register' || path === '/';
    const isProtectedRoute = path.startsWith('/contractor') || path.startsWith('/supplier') || path === '/onboarding';

    // 1. Not logged in but trying to access protected route -> Login
    if (!session && isProtectedRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 2. Logged in but sitting on auth route -> Dashboard
    if (session && isAuthRoute) {
        if (role?.value === 'contractor') return NextResponse.redirect(new URL('/contractor/dashboard', request.url));
        if (role?.value === 'supplier') {
            if (onboarded?.value === 'true') {
                return NextResponse.redirect(new URL('/supplier/inbox', request.url));
            } else {
                return NextResponse.redirect(new URL('/onboarding', request.url));
            }
        }
        return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // 3. Logged in without a role -> Force Onboard
    if (session && !role?.value && path !== '/onboarding') {
        return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // 4. Supplier specific check: If they have a role, but haven't finished onboarding, trap them.
    if (session && role?.value === 'supplier' && onboarded?.value !== 'true' && path !== '/onboarding') {
        return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // 5. Logged in with a role and fully onboarded but trying to re-onboard -> Dashboard
    if (session && role?.value && path === '/onboarding') {
        if (role.value === 'contractor') return NextResponse.redirect(new URL('/contractor/dashboard', request.url));
        if (role.value === 'supplier' && onboarded?.value === 'true') {
            return NextResponse.redirect(new URL('/supplier/inbox', request.url));
        }
    }

    // 6. Strict Role Protection (Contractor trying to access Supplier, or vice versa)
    if (path.startsWith('/contractor') && role?.value !== 'contractor') {
        if (role?.value === 'supplier') {
            return NextResponse.redirect(new URL(onboarded?.value === 'true' ? '/supplier/inbox' : '/onboarding', request.url));
        }
        return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    if (path.startsWith('/supplier') && role?.value !== 'supplier') {
        if (role?.value === 'contractor') {
            return NextResponse.redirect(new URL('/contractor/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
