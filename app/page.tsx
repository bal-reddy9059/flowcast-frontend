import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Server component — runs on the server before any HTML is sent.
// Middleware handles this redirect for subsequent navigations;
// this handles the very first cold load when no middleware cache exists.
export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('flowcast_token')?.value;
  redirect(token ? '/dashboard' : '/login');
}
