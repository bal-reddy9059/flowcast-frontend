import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'flowcast_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=no_token', request.url));
  }

  // Set the cookie in the HTTP response so the middleware sees it immediately
  // on the /dashboard redirect, without any client-side JS needed.
  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set(COOKIE_NAME, token, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false, // must be readable by document.cookie so AuthContext can sync to localStorage
  });

  return response;
}
