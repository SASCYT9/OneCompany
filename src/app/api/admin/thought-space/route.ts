import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
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
