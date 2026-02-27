import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');
    const roleCookie = request.cookies.get('user_role');
    const path = request.nextUrl.pathname;

    if (path === '/login' || path === '/' || path.startsWith('/_next') || path.startsWith('/api') || path.includes('.')) {
        return NextResponse.next();
    }

    if (!sessionCookie) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (roleCookie) {
        const role = roleCookie.value;

        if (path.startsWith('/contractor') && role !== 'contractor') {
            return NextResponse.redirect(new URL('/supplier/inbox', request.url));
        }

        if (path.startsWith('/supplier') && role !== 'supplier') {
            return NextResponse.redirect(new URL('/contractor/dashboard', request.url));
        }


    } else {
        if (path !== '/onboarding') {
            return NextResponse.redirect(new URL('/onboarding', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
