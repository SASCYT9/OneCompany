import { NextResponse } from 'next/server';
import { fetchTurn14Brands } from '@/lib/turn14';

export async function GET() {
  try {
    const brandsData = await fetchTurn14Brands();
    const items = brandsData.data || (Array.isArray(brandsData) ? brandsData : []);
    const brands = items.map((b: any) => ({
      id: b.id,
      name: b.attributes?.name || b.name
    })).sort((a: any, b: any) => a.name.localeCompare(b.name));
    
    return NextResponse.json({ data: brands });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
