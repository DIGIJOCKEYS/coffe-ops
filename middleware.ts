import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/login(.*)',
  '/sso-callback(.*)',
  '/api/clerk-check',
]);

export default clerkMiddleware(async (auth, request) => {
  // /__clerk is handled entirely by Next.js rewrites (next.config.js).
  // Clerk middleware must NOT intercept it — doing so causes a circular
  // dependency where Clerk tries to verify auth before it has loaded.
  if (request.nextUrl.pathname.startsWith('/__clerk')) {
    return;
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  // /__clerk is intentionally excluded from the matcher so the middleware
  // never runs for proxy requests. Next.js rewrites handle them directly.
  matcher: [
    '/((?!_next|__clerk|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
