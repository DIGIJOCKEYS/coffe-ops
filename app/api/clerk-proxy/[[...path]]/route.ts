/**
 * Clerk Frontend API Proxy
 *
 * Forwards all requests from /__clerk/* to https://frontend-api.clerk.dev/*
 * with the three required headers per Clerk proxy docs:
 *   https://clerk.com/docs/advanced-usage/using-proxies
 *
 * Key fix: Node.js fetch() automatically decompresses gzip/br responses.
 * We must NOT forward the Content-Encoding header back to the browser,
 * otherwise the browser tries to decompress already-decompressed data
 * and throws ERR_CONTENT_DECODING_FAILED.
 *
 * We also tell upstream not to compress by removing Accept-Encoding,
 * so the response body is raw and safe to stream back as-is.
 */

import { type NextRequest, NextResponse } from 'next/server';

const CLERK_FRONTEND_API = 'https://frontend-api.clerk.dev';
const PROXY_URL = 'https://nestation-ops.vercel.app/__clerk';

// Headers that must be stripped from the upstream response before
// forwarding to the browser to prevent decoding/encoding mismatches.
const STRIP_RESPONSE_HEADERS = new Set([
  'content-encoding',   // fetch() already decompressed — don't tell browser to decompress again
  'transfer-encoding',  // chunked encoding is handled by Vercel
  'content-length',     // length may change after decompression
  'connection',
  'keep-alive',
]);

// Headers that must be stripped from the incoming request before
// forwarding to upstream to prevent issues.
const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'accept-encoding', // tell upstream to send uncompressed — Node fetch decompresses anyway
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

async function proxyToClerk(
  request: NextRequest,
  pathSegments: string[] = []
): Promise<NextResponse> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('[clerk-proxy] CLERK_SECRET_KEY is not set');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  // Build upstream URL preserving path and query string
  const upstreamPath = pathSegments.join('/');
  const search = request.nextUrl.search;
  const upstreamUrl = `${CLERK_FRONTEND_API}/${upstreamPath}${search}`;

  // Build forwarded headers — copy incoming, strip problematic ones, add required Clerk headers
  const forwardedHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      forwardedHeaders.set(key, value);
    }
  }
  forwardedHeaders.set('Clerk-Proxy-Url', PROXY_URL);
  forwardedHeaders.set('Clerk-Secret-Key', secretKey);

  // X-Forwarded-For: use real client IP
  const clientIp =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';
  forwardedHeaders.set('X-Forwarded-For', clientIp);

  // Forward body for mutating methods
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
      redirect: 'manual', // pass redirects back to browser unchanged
    });
  } catch (error) {
    console.error('[clerk-proxy] Upstream fetch failed:', error);
    return new NextResponse('Proxy error', { status: 502 });
  }

  // Build response headers — strip headers that cause decoding issues
  const responseHeaders = new Headers();
  for (const [key, value] of upstreamResponse.headers.entries()) {
    if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
