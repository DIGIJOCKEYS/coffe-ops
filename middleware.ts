import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/login(.*)',
  '/sso-callback(.*)',
  '/api/clerk-check',
  // Clerk proxy path must be public — it loads before auth is available
  '/__clerk(.*)',
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  // Let /__clerk pass through without any auth check
  if (request.nextUrl.pathname.startsWith('/__clerk')) {
    return NextResponse.next();
  }
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/__clerk(.*)',
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
