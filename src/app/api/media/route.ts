import { NextResponse } from 'next/server';
import { addMediaFromBuffer, listMedia, requireAdminSecret } from '@/lib/mediaStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await listMedia();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const auth = requireAdminSecret(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });

  try {
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
    const errorMessage = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
