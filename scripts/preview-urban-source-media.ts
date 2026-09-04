/** Makes local contact sheets for human/agent review; no storefront or DB writes. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const dir = 'tmp/urban-source-media';
const selections: Array<[string, string, string?]> = [
  ['wx4-reviewed', 'urban-wx-4-set-of-4-transporter', 'WX-4_FRONT_CUTOUT'],
  ['uc7-polished-reviewed', 'urban-uc-7-set-of-4', 'UC7_SILVER_FACE'],
  ['uc4-g-gloss-reviewed', 'urban-uc-4-set-for-mercedes-benz-g-wagon-g63'],
  ['urb-ven-25353091-v1', 'urban-defender2020-bob-bonnetvent'],
  ['urb-ven-25353092-v1', 'urban-defender2020-bob-sidevent'],
  ['urb-ven-26009350-v1', 'urban-best-of-british-bonnet-vent-set-for-range-rover-sport-l461'],
  ['urb-ven-26009351-v1', 'urban-best-of-british-side-vent-set-for-range-rover-sport-l461-1'],
  ['eqc-splitter-reviewed', 'urban-carbon-fibre-aero-kit-for-mercedes-eqc', 'EQC_FRONT_SPLITTER'],
  ['g-splitter-reviewed', 'g-wagon-soft-kit-front-lip-1'],
  ['urb-spo-25358185-v1', 'urban-carbon-fibre-aero-kit-for-mercedes-eqc', 'EQC_LOWER_SPOILER'],
  ['urb-spo-25358186-v1', 'urban-carbon-fibre-aero-kit-for-mercedes-eqc', 'EQC_UPPER_SPOILER'],
  ['urb-dif-25358184-v1', 'urban-carbon-fibre-aero-kit-for-mercedes-eqc', 'EQC_REAR_DIFFUSER'],
  ['urb-arc-25353072-v1', 'sport-svr-arch-fender-flare-kit'],
  ['urb-flo-25353083-v1', 'urban-range-rover-sport-carpet-floor-mat-set'],
  ['urb-int-25353077-v1', 'carbon-fibre-seat-backs-l494-svr-2015-2017'],
  ['urb-int-25353081-v1', 'carbon-fibre-seat-backs-l494-svr-2018'],
  ['urb-fro-25358164-v1', 'nero-urus-front-splitter'],
  ['urb-fro-25358169-v1', 'nero-lamborghini-urus-tuning-forks'],
  ['urb-fro-25358170-v1', 'nero-lamborghini-urus-tuning-forks-2'],
  ['urb-roo-25358189-v1', 'g-wagon-urban-light-bar'],
  ['urb-spo-25358190-v1', 'g-wagon-urban-rear-spoiler'],
  ['defender-110-candidate', 'new-defender-110-urban-widetrack-arch-kit'],
  ['rr-bonnet-vent-candidate', 'rrsport-l494-carbon-bonnet-vent-overlay'],
  ['rr-side-vent-candidate', 'range-rover-sport-l494-carbon-side-vent-overlays'],
  ['rr-2018-side-vent-candidate', 'svr-sport-carbon-side-vent-overlay'],
  ['rr-boot-trim-candidate', 'range-rover-sport-l494-carbon-boot-trim'],
  ['g-mirror-candidate', 'g-wagon-urban-wing-mirror-caps'],
  ['g-indicator-candidate', 'g-wagon-g63-carbon-indicator-surround-pair'],
  ['g-skid-candidate', 'g-wagon-g63-front-skid-pan-carbon-trim', 'FRONT_SKID'],
  ['g-grille-candidate', 'g-wagon-g63-bumper-grille-carbon-trim-pair'],
  ['g-pillar-candidate', 'copy-of-g-wagon-urban-over-rider-package'],
  ['urb-hoo-25353103-v1', 'gp:urb-hoo-25353103-v1'],
  ['gp-roof-rails', 'gp:urb-acc-25358162-v1'],
  ['gp-towbar', 'gp:urb-acc-25358163-v1'],
  ['urb-fro-25358192-v1', 'copy-of-g-wagon-urban-light-bar'],
  ['urb-fro-25358197-v1', 'g-wagon-g63-front-skid-pan-carbon-trim', 'FRONT_SKID'],
  ['urb-gri-25353076-v1', 'carbon-fibre-urban-autograph-grille-rr-sport'],
  ['urb-flo-25353114-v1', 'defender-2020-90-110-urbanmats'],
  ['urb-mir-25353101-v1', 'new-defender-carbon-fibre-mirror-caps'],
  ['urb-roo-25358161-v1', 'vw-transporter-t6-light-bar'],
  ['urb-sil-25358157-v1', 'vw-golf-r-mk-8-urban-carbon-fibre-lower-sill-kit'],
  ['urb-spl-25358156-v1', 'vw-golf-r-mk8-urban-carbonfibre-frontsplitter'],
  ['urb-spo-25358158-v1', 'vw-golf-r-mk8-urban-carbonfibre-upperspoiler'],
];
for (let index = 1; index <= 16; index++) {
  selections.push([`rsq8-${index}`, 'audi-rsq8-carbon-fibre-aero-kit', `RSQ8_FULL_KIT_${index}.png`]);
}

async function main() {
  const house = JSON.parse(await readFile(`${dir}/house.json`, 'utf8'));
  const gp = JSON.parse(await readFile(`${dir}/gp.json`, 'utf8'));
  const rows = selections.map(([slug, handle, match]) => {
    const isGp = handle.startsWith('gp:');
    const source = (isGp ? gp : house).find((p: { handle: string }) => p.handle === handle.replace(/^gp:/, ''));
    if (!source) throw new Error(`Missing source ${handle}`);
    const images = source.images.map((image: { src: string } | string) => typeof image === 'string' ? image.replace(/^\/\//, 'https://') : image.src)
      .filter((url: string) => !match || url.includes(match)).slice(0, 3);
    if (!images.length) throw new Error(`Missing media ${handle}/${match}`);
    return { slug, source: `https://${isGp ? 'gp-portal.eu' : 'houseofurban.co.uk'}/products/${source.handle}`, images };
  });
  await writeFile(`${dir}/candidates.json`, JSON.stringify(rows, null, 2));
  await mkdir(`${dir}/images`, { recursive: true });
  for (let page = 0; page * 12 < rows.length; page++) {
    const cells = [];
    for (const [index, row] of rows.slice(page * 12, page * 12 + 12).entries()) {
      const response = await fetch(row.images[0], { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${row.images[0]}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(`${dir}/images/${row.slug}.jpg`, bytes);
      const input = await sharp(bytes).resize(330, 240, { fit: 'contain', background: '#fff' }).png().toBuffer();
      const label = Buffer.from(`<svg width="330" height="35"><rect width="330" height="35" fill="white"/><text x="8" y="22" font-size="14">${row.slug}</text></svg>`);
      cells.push({ input, left: (index % 3) * 330, top: Math.floor(index / 3) * 275 });
      cells.push({ input: label, left: (index % 3) * 330, top: Math.floor(index / 3) * 275 + 240 });
    }
    await sharp({ create: { width: 990, height: 1100, channels: 3, background: '#ddd' } })
      .composite(cells).jpeg().toFile(`${dir}/sheet-${page + 1}.jpg`);
  }
  console.log(`Prepared ${rows.length} candidates and contact sheets in ${dir}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
