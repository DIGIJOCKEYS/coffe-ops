import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/login(.*)',
  '/sso-callback(.*)',
  '/api/clerk-check',
  // Clerk proxy route handler — must be public so Clerk JS can load
  // before authentication is available. No user data is exposed here.
  '/api/clerk-proxy(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  // __clerk is excluded from the matcher — rewrites handle it before middleware.
  // All other routes (including /api/*) go through auth check.
  matcher: [
    '/((?!_next|__clerk|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
