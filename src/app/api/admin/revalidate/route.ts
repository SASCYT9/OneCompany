import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function GET() {
  // Clear the entire shop cache to ensure all database values immediately reflect in RSC layer
  revalidatePath('/', 'layout');
  
  return NextResponse.json({ success: true, message: 'Next.js App Router cache forcefully cleared.' });
}
