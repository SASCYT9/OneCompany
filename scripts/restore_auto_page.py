import os

file_path = r"src/app/[locale]/auto/AutoPageClient.tsx"

if not os.path.exists("src"):
    os.chdir("..")

print(f"Writing to {os.path.abspath(file_path)}")

content = """// src/app/[locale]/auto/AutoPageClient.tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

import {
  allAutomotiveBrands,
  getBrandsByNames,
  LocalBrand,
  getBrandMetadata,
  getLocalizedCountry,
  getLocalizedSubcategory,
} from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { categoryData } from '@/lib/categoryData';
import type { CategoryData } from '@/lib/categoryData';

type LocalizedCopy = { en: string; ua: string; [key: string]: string };

type BrandStory = {
  headline: LocalizedCopy;
  description: LocalizedCopy;
  highlights?: LocalizedCopy[];
};

const TOP_AUTOMOTIVE_BRANDS = [
  'Akrapovic',
  'Brabus',
  'Mansory',
  'HRE wheels',
  'Urban Automotive',
  'Eventuri',
  'KW Suspension',
  'Novitec',
  'ABT',
];

const heroStats: { value: string | LocalizedCopy; label: LocalizedCopy; caption: LocalizedCopy }[] = [
  {
    value: '160+',
    label: { en: 'brands curated', ua: 'брендів у каталозі' },
    caption: { en: 'Official programs since 2007', ua: 'Офіційні програми з 2007 року' },
  },
  {
    value: { en: 'Network', ua: 'Мережа' },
    label: { en: 'partner garages', ua: 'партнерських майстерень' },
    caption: { en: 'Installation & setup', ua: 'Встановлення та налаштування' },
  },
  {
    value: { en: 'Kyiv', ua: 'Київ' },
    label: { en: 'Baseina St, 21B', ua: 'вул. Басейна, 21Б' },
    caption: { en: 'Headquarters', ua: 'Штаб-квартира' },
  },
];"""

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("File written successfully!")
