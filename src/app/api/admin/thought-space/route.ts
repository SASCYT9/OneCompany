import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { assertAdminRequest } from '@/lib/adminAuth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const thoughtPath = path.join(process.cwd(), '.agents', 'THOUGHT_SPACE.md');
    
    if (!fs.existsSync(thoughtPath)) {
      return NextResponse.json({ content: 'Thought space is currently empty.' });
    }

    const content = fs.readFileSync(thoughtPath, 'utf8');
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read thought space' }, { status: 500 });
  }
}
