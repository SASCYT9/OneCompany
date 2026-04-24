import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Airtable writes are disabled. Use read-only Airtable sync into the local database.' },
    { status: 410 }
  );
}
