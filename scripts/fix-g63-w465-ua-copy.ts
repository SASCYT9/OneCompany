/**
 * Manual UA copy for the G63 W465 product. We imported it with
 * --skip-ua-translation (Gemini billing offline), and the generic UA fallback
 * generator overwrites empty UA fields with brand-neutral filler — which then
 * displays in place of the actual description on the PDP. Patch the UA fields
 * directly so the generator's `isUaBodyEmptyOrLatin` gate stops firing.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const titleUa = 'Вихлопна система Mercedes-Benz AMG G63 (W465)';
const shortDescUa =
  'Mercedes-AMG G63 W465 з системою iPE Catback отримує насичений, могутній вихлопний звук і миттєве перемикання між агресивним режимом і спокійним круїзом — однією кнопкою.';

const longDescUa = [
  'Mercedes-AMG G63 W465 з системою iPE Catback отримує насичений, могутній вихлопний звук і одночасно зберігає плавний, цивілізований круїз — за натиском однієї кнопки.',
  'Valvetronic-система iPE віддає повний контроль водієві: миттєвий перехід між агресивним драйвом і повсякденним комфортом. Кожен компонент розраховано саме під G63 W465 — ідеальний фітмент і оптимальний потік газів. iPE долає обмеження заводського вихлопу й помітно покращує характер звуку, відгук на газ і драйверські відчуття.',
  'Установка iPE на G63 W465 (cat-back або повна система) обовʼязково потребує перепрошивки ECU — інакше можливе постійне горіння Check Engine. iPE не несе відповідальності за помилки CEL.',
  'Невірне регулювання під час установки може пошкодити вихлоп або автомобіль. iPE не несе відповідальності за пошкодження, спричинені непрофесійною установкою — виконуйте монтаж в авторизованого дилера.',
  'Виробник, імпортер та дилер не відповідають за травми чи інші збитки внаслідок неправильної установки або експлуатації. Слідкуйте, щоб система не торкалася теплочутливих деталей.',
  'Гарантія iPE покриває заводські дефекти, підтверджені технічним відділом виробника, і виключає природний знос (прокладки, шумопоглинаюча вата). Гарантія анулюється у випадку аварії, модифікацій, неправильної установки або трекового використання.',
].join('\n\n');

const bodyHtmlUa = `<p><strong>${shortDescUa}</strong></p>
<p>Valvetronic-система iPE віддає повний контроль водієві: миттєвий перехід між агресивним драйвом і повсякденним комфортом. Кожен компонент розраховано саме під G63 W465 — ідеальний фітмент і оптимальний потік газів. iPE долає обмеження заводського вихлопу й помітно покращує характер звуку, відгук на газ і драйверські відчуття.</p>
<p>Установка iPE на G63 W465 (cat-back або повна система) <strong>обовʼязково потребує перепрошивки ECU</strong> — інакше можливе постійне горіння Check Engine. iPE не несе відповідальності за помилки CEL.<br><br>1. Невірне регулювання під час установки може пошкодити вихлоп або автомобіль. iPE не несе відповідальності за пошкодження, спричинені непрофесійною установкою — виконуйте монтаж в авторизованого дилера.<br><br>2. Виробник, імпортер та дилер не відповідають за травми чи інші збитки внаслідок неправильної установки або експлуатації. Слідкуйте, щоб система не торкалася теплочутливих деталей.<br><br>3. Гарантія iPE покриває заводські дефекти, підтверджені технічним відділом виробника, і виключає природний знос (прокладки, шумопоглинаюча вата). Гарантія анулюється у випадку аварії, модифікацій, неправильної установки або трекового використання.</p>`;

(async () => {
  const r = await prisma.shopProduct.update({
    where: { slug: 'ipe-mercedes-benz-amg-g63-w465-exhaust-system' },
    data: APPLY
      ? {
          titleUa,
          shortDescUa,
          longDescUa,
          bodyHtmlUa,
        }
      : {},
    select: { slug: true, titleUa: true },
  });
  if (APPLY) {
    console.log('Updated:', r.slug);
    console.log('  titleUa:', r.titleUa);
  } else {
    console.log('(dry-run) would write UA copy for', r.slug);
    console.log('  titleUa:', titleUa);
    console.log('  shortDescUa:', shortDescUa.slice(0, 150) + '...');
    console.log('  longDescUa length:', longDescUa.length);
    console.log('  bodyHtmlUa length:', bodyHtmlUa.length);
    console.log('\nPass --apply to write.');
  }
  await prisma.$disconnect();
})();
