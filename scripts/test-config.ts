import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const jsonPath = path.resolve('reference/urban-shopify-theme/templates/collection.land-rover-defender-110.json');
try {
  let text = fs.readFileSync(jsonPath, 'utf8');
  text = text.replace(/^\uFEFF/, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const template = JSON.parse(text);
  
  const hero = template.sections?.hero;
  if (!hero || hero.type !== 'section-urban-cinematic-hero') {
    throw new Error(`Missing section "hero" of type "section-urban-cinematic-hero"`);
  }
  const overview = template.sections?.overview;
  if (!overview || overview.type !== 'section-urban-model-overview') {
    throw new Error(`Missing section "overview" of type "section-urban-model-overview"`);
  }
  const gallery = template.sections?.gallery;
  if (!gallery || gallery.type !== 'section-urban-gallery-carousel') {
    throw new Error(`Missing section "gallery" of type "section-urban-gallery-carousel"`);
  }
  const banner = template.sections?.banner;
  if (!banner || banner.type !== 'section-urban-banner-stack') {
    throw new Error(`Missing section "banner" of type "section-urban-banner-stack"`);
  }
  const blueprint = template.sections?.blueprint_kit;
  if (!blueprint || blueprint.type !== 'section-urban-blueprint-kit') {
    throw new Error(`Missing section "blueprint_kit" of type "section-urban-blueprint-kit"`);
  }
  const main = template.sections?.main;
  if (!main || main.type !== 'main-collection-product-grid') {
    throw new Error(`Missing section "main" of type "main-collection-product-grid"`);
  }
  
  console.log('SUCCESS');
} catch (e) {
  console.log('FAIL:', e.message);
}
