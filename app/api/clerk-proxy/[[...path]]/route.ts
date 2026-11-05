/**
 * Clerk Frontend API Proxy
 *
 * Forwards all requests from /__clerk/* to https://frontend-api.clerk.dev/*
 * with the three required headers as per Clerk proxy documentation:
 *   https://clerk.com/docs/advanced-usage/using-proxies
 *
 * Required headers added to upstream:
 *   - Clerk-Proxy-Url   : full URL of this proxy
 *   - Clerk-Secret-Key  : Clerk secret key (server-side only, never exposed)
 *   - X-Forwarded-For   : original client IP
 *
 * This route handler is reachable via /__clerk/* due to the rewrite in
 * next.config.js: /__clerk/:path* → /api/clerk-proxy/:path*
 */

import { type NextRequest, NextResponse } from 'next/server';

const CLERK_FRONTEND_API = 'https://frontend-api.clerk.dev';
const PROXY_URL = 'https://nestation-ops.vercel.app/__clerk';

export async function GET(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  return proxyToClerk(request, params.path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  return proxyToClerk(request, params.path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  return proxyToClerk(request, params.path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  return proxyToClerk(request, params.path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  return proxyToClerk(request, params.path);
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  return proxyToClerk(request, params.path);
}

async function proxyToClerk(
  request: NextRequest,
  pathSegments: string[] = []
): Promise<NextResponse> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('[clerk-proxy] CLERK_SECRET_KEY is not set');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  // Build upstream URL — preserve path and query string
  const upstreamPath = pathSegments.join('/');
  const search = request.nextUrl.search;
  const upstreamUrl = `${CLERK_FRONTEND_API}/${upstreamPath}${search}`;

  // Forward all incoming headers, then add the three required Clerk headers
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set('Clerk-Proxy-Url', PROXY_URL);
  forwardedHeaders.set('Clerk-Secret-Key', secretKey);

  // X-Forwarded-For: append real client IP
  const clientIp =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';
  forwardedHeaders.set('X-Forwarded-For', clientIp);

  // Remove host header so upstream sees correct host
  forwardedHeaders.delete('host');

  // Forward body for POST/PUT/PATCH
  let body: BodyInit | null = null;
  const method = request.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    body = await request.arrayBuffer();
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: forwardedHeaders,
      body: body ?? undefined,
      // Do not follow redirects — pass them back to the browser
      redirect: 'manual',
    });

    // Stream response back
    const responseHeaders = new Headers(upstreamResponse.headers);
    // Remove transfer-encoding to avoid issues with Vercel edge
    responseHeaders.delete('transfer-encoding');

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[clerk-proxy] Upstream fetch failed:', error);
    return new NextResponse('Proxy error', { status: 502 });
  }
}
