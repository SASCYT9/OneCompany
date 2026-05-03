import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { addMediaFromBuffer, listMedia } from '@/lib/mediaStore';
import { assertAdminRequest } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await listMedia();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    const arrayBuf = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const item = await addMediaFromBuffer(buf, file.name, file.type || 'application/octet-stream');
    return NextResponse.json({ item }, { status: 201 });
  } catch (e: unknown) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const errorMessage = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
