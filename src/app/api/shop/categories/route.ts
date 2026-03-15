import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const categories = await prisma.shopCategory.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { titleEn: 'asc' }],
      select: {
        id: true,
        slug: true,
        titleUa: true,
        titleEn: true,
        descriptionUa: true,
        descriptionEn: true,
        sortOrder: true,
        parent: {
          select: {
            id: true,
            slug: true,
            titleUa: true,
            titleEn: true,
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    return NextResponse.json(
      categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        title: {
          ua: category.titleUa,
          en: category.titleEn,
        },
        description: {
          ua: category.descriptionUa ?? '',
          en: category.descriptionEn ?? '',
        },
        sortOrder: category.sortOrder,
        parent: category.parent
          ? {
              id: category.parent.id,
              slug: category.parent.slug,
              title: {
                ua: category.parent.titleUa,
                en: category.parent.titleEn,
              },
            }
          : null,
        productsCount: category._count.products,
        childrenCount: category._count.children,
      }))
    );
  } catch (error) {
    console.error('Public shop categories list', error);
    return NextResponse.json({ error: 'Failed to list categories' }, { status: 500 });
  }
}
