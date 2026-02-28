// Next.js Middleware - Server-side route protection
// Runs BEFORE the page renders, so users see the correct page immediately
// instead of brief flashes of login page or loading screens.
//
// This fixes:
// 1. New tab opening → no longer shows login page briefly
// 2. Browser close & reopen → cookie persists even if Edge clears localStorage

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'wms_auth_token';

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login'];

// Static/system paths that middleware should skip entirely
const SKIP_PATHS = ['/_next', '/favicon.ico', '/api', '/public'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip static files and system paths
    if (SKIP_PATHS.some(path => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route);

    // If user is NOT authenticated and trying to access a protected route → redirect to login
    if (!token && !isPublicRoute) {
        const loginUrl = new URL('/login', request.url);
        // Preserve the intended destination so we can redirect back after login
        if (pathname !== '/') {
            loginUrl.searchParams.set('redirect', pathname);
        }
        return NextResponse.redirect(loginUrl);
    }

    // If user IS authenticated and on login page → redirect to dashboard
    if (token && isPublicRoute) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // If user IS authenticated and on root page → redirect to dashboard
    if (token && pathname === '/') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
    matcher: [
        // Match all paths except static files
        '/((?!_next/static|_next/image|favicon.ico|public/).*)',
    ],
};
