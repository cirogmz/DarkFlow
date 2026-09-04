import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('df_session');
  const path = request.nextUrl.pathname;

  // Define public paths accessible without employee session
  const isPublicPath = 
    path === '/login' || 
    path.startsWith('/m/') || 
    path.startsWith('/order-tracking/') ||
    path.startsWith('/api/public/');

  // If trying to access protected dashboard and no session cookie, redirect to login
  if (!isPublicPath && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If authenticated and trying to access login, redirect to home/dashboard
  if (isPublicPath && session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/',
    '/login',
    '/pos/:path*',
    '/kitchen/:path*',
    '/inventory/:path*',
    '/cash/:path*',
    '/drivers/:path*',
    // Exclude API routes and static assets
    '/((?!api|_next/static|_next/image|favicon.ico|Logo.png|vercel.svg).*)',
  ],
};
