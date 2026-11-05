/**
 * Clerk Frontend API Proxy
 *
 * Forwards /__clerk/* → https://frontend-api.clerk.dev/*
 *
 * Key challenges solved:
 * 1. Content-Encoding: Node fetch() auto-decompresses, so we strip this header
 *    to prevent ERR_CONTENT_DECODING_FAILED in browsers.
 * 2. Set-Cookie domain rewriting: Clerk sends cookies with
 *    Domain=frontend-api.clerk.dev which browsers reject for our domain.
 *    We rewrite all Set-Cookie headers to remove the Domain attribute so
 *    browsers store them under nestation-ops.vercel.app instead.
 */

import { type NextRequest, NextResponse } from 'next/server';

const CLERK_FRONTEND_API = 'https://frontend-api.clerk.dev';
const PROXY_URL = 'https://nestation-ops.vercel.app/__clerk';

const STRIP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'transfer-encoding',
  'content-length',
  'connection',
  'keep-alive',
]);

const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'accept-encoding',
]);

export async function GET(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyToClerk(request, params.path);
}
export async function POST(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyToClerk(request, params.path);
}
export async function PUT(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyToClerk(request, params.path);
}
export async function PATCH(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyToClerk(request, params.path);
}
export async function DELETE(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyToClerk(request, params.path);
}
export async function OPTIONS(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyToClerk(request, params.path);
}

/**
 * Rewrite Set-Cookie headers from Clerk:
 * - Remove Domain= attribute (so browser uses current domain)
 * - Keep Secure, HttpOnly, SameSite, Path, Expires as-is
 */
function rewriteSetCookie(cookieValue: string): string {
  return cookieValue
    .split(';')
    .map(part => part.trim())
    .filter(part => !part.toLowerCase().startsWith('domain='))
    .join('; ');
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

  const upstreamPath = pathSegments.join('/');
  const search = request.nextUrl.search;
  const upstreamUrl = `${CLERK_FRONTEND_API}/${upstreamPath}${search}`;

  const forwardedHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      forwardedHeaders.set(key, value);
    }
  }
  forwardedHeaders.set('Clerk-Proxy-Url', PROXY_URL);
  forwardedHeaders.set('Clerk-Secret-Key', secretKey);

  const clientIp =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';
  forwardedHeaders.set('X-Forwarded-For', clientIp);

  const method = request.method.toUpperCase();
  let body: ArrayBuffer | null = null;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    body = await request.arrayBuffer();
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: forwardedHeaders,
      body: body ?? undefined,
      redirect: 'manual',
    });
  } catch (error) {
    console.error('[clerk-proxy] Upstream fetch failed:', error);
    return new NextResponse('Proxy error', { status: 502 });
  }

  // Build response headers
  const responseHeaders = new Headers();
  for (const [key, value] of upstreamResponse.headers.entries()) {
    if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) continue;

    if (key.toLowerCase() === 'set-cookie') {
      // Rewrite cookie to remove Domain=frontend-api.clerk.dev
      // so browser stores it under nestation-ops.vercel.app
      responseHeaders.append(key, rewriteSetCookie(value));
    } else {
      responseHeaders.set(key, value);
    }
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
