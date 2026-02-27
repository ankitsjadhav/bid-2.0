import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('session');
    const role = request.cookies.get('user_role');
    const onboarded = request.cookies.get('supplier_onboarded');
    const path = request.nextUrl.pathname;

    const isAuthRoute = path === '/login' || path === '/register' || path === '/';
    const isProtectedRoute = path.startsWith('/contractor') || path.startsWith('/supplier') || path === '/onboarding';

    if (!session && isProtectedRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

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

    if (session && !role?.value && path !== '/onboarding') {
        return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    if (session && role?.value === 'supplier' && onboarded?.value !== 'true' && path !== '/onboarding') {
        return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    if (session && role?.value && path === '/onboarding') {
        if (role.value === 'contractor') return NextResponse.redirect(new URL('/contractor/dashboard', request.url));
        if (role.value === 'supplier' && onboarded?.value === 'true') {
            return NextResponse.redirect(new URL('/supplier/inbox', request.url));
        }
    }

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
