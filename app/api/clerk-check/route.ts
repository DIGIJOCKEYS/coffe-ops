import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'NOT SET';
  const proxy = process.env.NEXT_PUBLIC_CLERK_PROXY_URL || 'NOT SET';
  
  // Decode domain from publishable key
  let domain = 'unknown';
  try {
    const b64 = key.replace('pk_live_', '').replace('pk_test_', '');
    domain = Buffer.from(b64, 'base64').toString('utf8');
  } catch {}

  return NextResponse.json({
    keyPrefix: key.substring(0, 20) + '...',
    decodedDomain: domain,
    proxyUrl: proxy,
    nodeEnv: process.env.NODE_ENV,
  });
}
