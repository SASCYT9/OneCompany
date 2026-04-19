import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { assertAdminRequest } from '@/lib/adminAuth';

export async function GET() {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);
  // Clear the entire shop cache to ensure all database values immediately reflect in RSC layer
  revalidatePath('/', 'layout');
  
  return NextResponse.json({ success: true, message: 'Next.js App Router cache forcefully cleared.' });
}
