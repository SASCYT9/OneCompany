import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const products = await prisma.shopProduct.findMany({
      where: {
        slug: { contains: 'urus-se' }
      }
    });

    const gallery = [
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/urusSE/webp/urban-automotive-urus-se-widetrack-1-2560.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/urusSE/webp/urban-automotive-urus-se-widetrack-2-2560.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/urusSE/webp/urban-automotive-urus-se-widetrack-3-2560.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/urusSE/webp/urban-automotive-urus-se-widetrack-4-2560.webp'
    ];

    const results = [];

    // Update ShopCollection Urus SE
    const updatedCol = await prisma.shopCollection.update({
      where: { handle: 'lamborghini-urus-se' },
      data: {
        heroImage: gallery[0] // 2560px hero image
      }
    });
    
    results.push(`Updated Collection Hero: ${updatedCol.handle}`);

    return NextResponse.json({ success: true, fixed: results });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
