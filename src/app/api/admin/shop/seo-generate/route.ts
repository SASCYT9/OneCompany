import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured in .env.local' }, { status: 500 });
    }

    const { productIds } = await req.json();

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'productIds must be a non-empty array' }, { status: 400 });
    }

    const products = await prisma.shopProduct.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        titleEn: true,
        titleUa: true,
        brand: true,
        categoryEn: true,
        scope: true,
        slug: true,
      }
    });

    if (products.length === 0) {
      return NextResponse.json({ error: 'No products found' }, { status: 404 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const results = [];

    // Process each product sequentially to avoid rate limits
    // In production with high tier you can do Promise.all
    for (const product of products) {
      const prompt = `
        You are a world-class automotive tuning SEO expert.
        Generate e-commerce SEO metadata (Title and Description) for this automotive part:
        
        Information:
        - Technical Product Name (EN): ${product.titleEn}
        - Technical Product Name (UA): ${product.titleUa}
        - Brand: ${product.brand || 'Unknown'}
        - Target scope: ${product.scope}
        
        Rules:
        1. EN Title max 60 chars. UA Title max 60 chars.
        2. EN Desc max 155 chars. UA Desc max 155 chars.
        3. Make it sell! Focus on performance, premium quality, and compatibility.
        4. Output exactly in JSON format:
        {
          "seoTitleEn": "string",
          "seoTitleUa": "string",
          "seoDescriptionEn": "string",
          "seoDescriptionUa": "string"
        }
      `;

      try {
        const aiResult = await model.generateContent(prompt);
        const textResponse = await aiResult.response.text();
        const jsonResponse = JSON.parse(textResponse);

        // Update database
        await prisma.shopProduct.update({
          where: { id: product.id },
          data: {
            seoTitleEn: jsonResponse.seoTitleEn,
            seoTitleUa: jsonResponse.seoTitleUa,
            seoDescriptionEn: jsonResponse.seoDescriptionEn,
            seoDescriptionUa: jsonResponse.seoDescriptionUa
          }
        });

        results.push({
          id: product.id,
          slug: product.slug,
          success: true,
          seoData: jsonResponse
        });
      } catch (err: any) {
        console.error(`AI SEO Generation failed for product ${product.id}`, err);
        results.push({
          id: product.id,
          success: false,
          error: err.message
        });
      }
    }

    return NextResponse.json({ processed: products.length, results });

  } catch (error: any) {
    console.error('Admin SEO generation error:', error);
    return NextResponse.json({ error: error.message || 'Internal logic error' }, { status: 500 });
  }
}
