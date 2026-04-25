// Debug: parse ICM-400 page directly
const url = 'https://www.do88.se/sv/artiklar/porsche-911-turbo-992-intercooler-kit.html';
const res = await fetch(url);
const html = (await res.text())
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '');

const stripTags = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#229;/g, 'å').replace(/&#228;/g, 'ä').replace(/&#246;/g, 'ö')
    .replace(/&#176;/g, '°').replace(/&#8211;/g, '–').replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ').replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ').trim();

console.log('=== H2 ArtikelnamnFalt ===');
console.log(html.match(/<h2[^>]*ArtikelnamnFalt[^>]*>([^<]+)/i)?.[1]);

console.log('\n=== Produktbeskrivning location ===');
const pIdx = html.indexOf('Produktbeskrivning</summary>');
console.log('idx:', pIdx);
console.log('Next 800 chars:');
console.log(html.slice(pIdx, pIdx + 800).replace(/\s+/g, ' '));

console.log('\n=== After Produktbeskrivning, until Nyckelegenskaper ===');
const nIdx = html.indexOf('Nyckelegenskaper', pIdx);
console.log('Nyckelegenskaper at:', nIdx);
const block = html.slice(pIdx + 'Produktbeskrivning</summary>'.length, nIdx);
console.log('Block length:', block.length);
console.log('Stripped:');
console.log(stripTags(block.replace(/<br\s*\/?>/gi, '\n')).slice(0, 600));

console.log('\n=== Nyckelegenskaper block ===');
const after = html.slice(nIdx, nIdx + 4000);
const stop = ['Bakgrund', 'Cellpaket från', '</details>', '<summary'];
let endI = after.length;
for (const s of stop) { const i = after.indexOf(s, 20); if (i > 0 && i < endI) endI = i; }
const nblock = after.slice(0, endI);
const ntext = stripTags(nblock.replace(/<br\s*\/?>/gi, '\n'));
console.log('Stripped:');
console.log(ntext.slice(0, 1500));
