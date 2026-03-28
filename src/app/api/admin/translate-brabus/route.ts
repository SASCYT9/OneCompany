import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

export const maxDuration = 300; 

const ai = new GoogleGenAI({ apiKey: 'AIzaSyC88o517QFi9X-NauXwx8lBe5yhYMbu1go' });

const RATE_LIMIT_MS = 400; // Delay to respect Gemini limits

async function translateToLanguage(text: string, targetLanguage: 'English' | 'Ukrainian') {
  if (!text || text.trim() === '') return text;
  
  // Quick heuristic: If translating to English, and it already looks English (e.g. no German articles like "der/die/das/für/auf"), we might pass it but Brabus has "für".
  const prompt = `Translate the following Brabus automotive tuning product text strictly to professional ${targetLanguage}.
If the text is already completely in ${targetLanguage}, return it unchanged.
Maintain all HTML formatting exactly (e.g. <p>, <strong>). Do not translate brand names or technical specs (Brabus, Monoblock, Inconel, Carbon, AMG, W463A, mm).
Output ONLY the translation, without markdown syntax or conversational text.

Text:
${text}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: { temperature: 0.1 },
    });
    return response.text?.trim() || text;
  } catch (err) {
    console.error(`Gemini Error (${targetLanguage}):`, err);
    return text; // Fallback
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const skip = parseInt(url.searchParams.get('skip') || '0');

  try {
    const INPUT_JSON = path.join(process.cwd(), 'brabus-products.json');
    if (!fs.existsSync(INPUT_JSON)) {
      return NextResponse.json({ error: 'brabus-products.json not found' }, { status: 404 });
    }

    const productsRaw = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf-8'));
    const targetProducts = productsRaw.slice(skip, skip + limit);
    
    let successCount = 0;
    const results = [];

    for (const p of targetProducts) {
      try {
        const dbProduct = await prisma.shopProduct.findFirst({
          where: { sku: p.sku },
          select: { id: true, sku: true, titleEn: true, shortDescEn: true }
        });

        if (!dbProduct) {
          results.push({ sku: p.sku, status: 'not_in_db' });
          continue;
        }

        const germanTitle = dbProduct.titleEn;
        const germanDesc = dbProduct.shortDescEn || '';

        // Check if already localized in database (e.g. title has been updated identically)
        const dbProductUa = await prisma.shopProduct.findFirst({
            where: { id: dbProduct.id },
            select: { titleUa: true }
        });
        
        if (dbProductUa && dbProductUa.titleUa !== germanTitle) {
           results.push({ sku: p.sku, status: 'skipped', reason: 'already_localized' });
           continue;
        }

        const titleEn = await translateToLanguage(germanTitle, 'English');
        const descEn = germanDesc ? await translateToLanguage(germanDesc, 'English') : '';
        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

        const titleUa = await translateToLanguage(germanTitle, 'Ukrainian');
        const descUa = germanDesc ? await translateToLanguage(germanDesc, 'Ukrainian') : '';
        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

        if (titleEn !== germanTitle || titleUa !== germanTitle) {
            await prisma.shopProduct.update({
            where: { id: dbProduct.id },
            data: {
                titleEn: titleEn,
                titleUa: titleUa,
                shortDescEn: descEn,
                shortDescUa: descUa,
                bodyHtmlEn: descEn,
                bodyHtmlUa: descUa
            }
            });
            successCount++;
            results.push({ sku: p.sku, status: 'success', titleEn, titleUa });
        } else {
             results.push({ sku: p.sku, status: 'skipped', reason: 'identical' });
        }
      } catch (err: any) {
        console.error(`Error on ${p.sku}:`, err);
        results.push({ sku: p.sku, status: 'error', message: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: targetProducts.length,
      updated: successCount,
      results
    });
  } catch (error: any) {
    console.error('Translation Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
