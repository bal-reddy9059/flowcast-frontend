import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth gate for a few entry routes only.
 *
 * Next.js 16.2.x has a known `next dev` bug where a broad proxy matcher can
 * make valid App Router pages return 404. Protected app pages are still gated
 * client-side in `app/(main)/layout.tsx`.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('flowcast_token')?.value;

  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(token ? '/dashboard' : '/login', request.url),
    );
  }

  if (pathname === '/login' || pathname === '/register') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/register'],
};
