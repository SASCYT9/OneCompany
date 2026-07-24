import { readFileSync } from "node:fs";
import path from "node:path";

import { OpsKnowledgeStatus } from "@prisma/client";
import { config as loadEnv } from "dotenv";

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  loadEnv({ path: ".env.ops-lab.local", override: true });
}
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

type SeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category:
    | "prices-and-brands"
    | "delivery"
    | "order-processing"
    | "suppliers"
    | "general-processes";
  tags: string[];
  contentMarkdown: string;
  publish: boolean;
  source: string;
};

const oldWorkspaceRoot =
  process.env.ONECOMPANY_LEGACY_KNOWLEDGE_ROOT?.trim() || "D:\\OneCompanyMaxton";

function optionalLegacyMarkdown(relativePath: string) {
  try {
    return readFileSync(path.join(oldWorkspaceRoot, relativePath), "utf8").trim();
  } catch {
    return "";
  }
}

const verifiedPricingRules = optionalLegacyMarkdown("data\\source_docs\\verified-pricing-rules.md");
const completeOperationsUserGuide = readFileSync(
  path.resolve("docs/operations/telegram-manager-user-guide-ru.md"),
  "utf8"
).trim();

const articles: SeedArticle[] = [
  {
    slug: "start-one-company",
    title: "Что такое One Company",
    excerpt:
      "Короткое введение: чем занимается компания, где находятся рабочие данные и как устроена админка.",
    category: "general-processes",
    tags: ["start-here", "step-1", "onboarding", "one-company"],
    publish: true,
    source: "Current One Company admin architecture",
    contentMarkdown: `# Что такое One Company

One Company занимается премиальными автомобильными и мото-компонентами: подбором, продажей, расчётом, заказом и доставкой деталей разных брендов.

## Где мы работаем

| Раздел | Для чего нужен |
| --- | --- |
| Админка сайта | Главное и каноническое место для товаров, заказов, цен, задач и БАЗЫ |
| Telegram Manager | Быстро принять сообщение, голосовое, фото или документ и превратить их в задачу |
| Задачи | Понять, кто что делает, к какому сроку и что мешает завершить работу |
| БАЗА | Инструкции для команды: цены, бренды, доставка, оформление и общие процессы |

## Главное правило

Сайт является главным источником данных. Telegram помогает принять информацию и прислать уведомление, но задача, её исполнитель, статус и история хранятся в админке.

## Что нельзя делать автоматически

- Покупать товары или завершать checkout.
- Проводить оплату или вводить платёжные данные.
- Отправлять сообщения клиентам или поставщикам без отдельного согласования.
- Придумывать цену, доставку, скидку, VAT или наличие товара.

## Если вы только начали

1. Прочитайте статью **Как проходит рабочий день менеджера**.
2. Откройте **Как работают задачи и Telegram Manager**.
3. Зайдите в раздел «Задачи» и проверьте вкладки «Мои» и «Сегодня».`,
  },
  {
    slug: "daily-manager-workflow",
    title: "Как проходит рабочий день менеджера",
    excerpt:
      "Простой ежедневный порядок: проверить задачи, обработать новые запросы, зафиксировать результат и blocker.",
    category: "general-processes",
    tags: ["start-here", "step-2", "onboarding", "daily-workflow"],
    publish: true,
    source: "Current Ops workflow and legacy operator handoff",
    contentMarkdown: `# Как проходит рабочий день менеджера

## В начале дня

1. Откройте «Обзор» и посмотрите просроченные задачи.
2. Перейдите в «Задачи» → «Мои».
3. Проверьте задачи на сегодня и задачи, которые ожидают человека или внешнюю информацию.
4. У каждой активной задачи должно быть понятное следующее действие.

## Когда приходит новый запрос

- Если запрос пришёл в Telegram, откройте ссылку из сообщения бота.
- Проверьте название задачи, исполнителя, срок и приложенный контекст.
- Если данных недостаточно, не угадывайте: оставьте комментарий и переведите задачу в ожидание.
- Если запрос относится к существующему заказу, свяжите его с заказом, не создавая второй commerce-order.

## Во время работы

- Важные результаты пишите в комментарии задачи.
- Фото, документы и голосовые должны оставаться прикреплёнными к задаче.
- Изменяйте статус только тогда, когда состояние работы действительно изменилось.
- «Готово» означает, что результат проверен и критерий выполнения соблюдён.

## В конце дня

- Убедитесь, что нет активных задач без следующего действия или blocker.
- Обновите сроки, если они объективно изменились.
- Не удаляйте неактуальные задачи: отмените их с понятным комментарием, чтобы история сохранилась.`,
  },
  {
    slug: "one-company-operations-complete-guide",
    title: "Полное руководство: Telegram Manager и задачи",
    excerpt:
      "Пошаговая инструкция для команды: бот, пересылка диалогов, голосовые, Входящие, задачи, вложения, БАЗА и уведомления.",
    category: "general-processes",
    tags: ["start-here", "step-3", "onboarding", "telegram", "tasks", "complete-guide"],
    publish: true,
    source: "Current One Company Operations user workflow",
    contentMarkdown: completeOperationsUserGuide,
  },
  {
    slug: "tasks-and-telegram-manager",
    title: "Как работают задачи и Telegram Manager",
    excerpt:
      "Кто назначил задачу, кто её выполняет, что прикрепляется и как правильно работать с ботом.",
    category: "order-processing",
    tags: ["start-here", "step-3", "onboarding", "telegram", "tasks"],
    publish: true,
    source: "Current Ops task and Telegram intake contracts",
    contentMarkdown: completeOperationsUserGuide,
  },
  {
    slug: "pricing-workflow-safety",
    title: "Как безопасно работать с ценами",
    excerpt:
      "Общий порядок расчёта без выдуманных скидок, доставки и повторного добавления shipping.",
    category: "prices-and-brands",
    tags: ["pricing", "onboarding", "safety", "verified-rules"],
    publish: true,
    source: "Внутренний архив и проверенные правила цен",
    contentMarkdown: `# Как безопасно работать с ценами

## Перед расчётом

1. Точно определите бренд, товар, автомобиль и рынок клиента.
2. Откройте актуальное правило цены в админке.
3. Проверьте, относится ли правило к рознице, партнёру или внутренней закупке.
4. Проверьте валюту, VAT/tax и маршрут доставки.

## Обязательные правила

- AI помогает разобрать запрос, но не является источником арифметики цены.
- Если правило бренда не подтверждено, расчёт не выдаётся как готовый клиенту.
- Если checkout уже показывает total с доставкой, shipping нельзя добавлять второй раз.
- Если комплект состоит из отдельных деталей, shipping может считаться отдельно — только когда это явно указано в правиле.
- Наличие, скидка, вес и срок доставки всегда требуют источника.

## Когда остановиться

Переведите задачу в ожидание и напишите blocker, если неизвестны:

- нужный вариант товара или совместимость;
- цена для нашего аккаунта;
- VAT/tax status;
- стоимость или маршрут доставки;
- применимая скидка;
- валюта или актуальный курс.

> Конкретные формулы по брендам должны находиться в проверенных правилах цен. Материалы из внутреннего архива хранятся отдельно как черновик для проверки владельцем.`,
  },
  {
    slug: "top-level-pricing-source-review",
    title: "Архивные правила брендов на проверку",
    excerpt:
      "Импортированный справочник формул и заметок по брендам. Это черновик: каждое правило нужно сверить перед публикацией.",
    category: "prices-and-brands",
    tags: ["source-import", "needs-review", "brands", "pricing"],
    publish: false,
    source: "Внутренний архив и нормализованные правила цен",
    contentMarkdown: `# Архивные правила брендов на проверку

> ВАЖНО: это импорт старого рабочего справочника, а не автоматически разрешённые формулы. Ставки, скидки, VAT и логистика могут измениться. Перед публикацией каждого правила владелец должен сверить источник, дату и контрольный расчёт.

## Что найдено во внутреннем архиве

Обвесы, диски, охлаждение, выхлопы, ходовая, турбины, общие поставщики, расчёты доставки и автомобильные термины. Среди брендов: Zaero, ABT, MANHART, RW Carbon, ADRO, Urban, Vorsteiner, CT Carbon, Project Kahn, Maxton, 3D Design, Brabus, Topcars, Vossen, Do88, Wagner, CSF, Eventuri, Capristo, Akrapovic, Armytrix, IPE, KW, Burger Motorsport, Forzza и другие.

## Нормализованный экспорт старой базы

${verifiedPricingRules || "Нормализованный экспорт не найден. Укажите ONECOMPANY_LEGACY_KNOWLEDGE_ROOT и повторите импорт."}
`,
  },
  {
    slug: "logistics-source-review",
    title: "Логистика: исходные ориентиры на проверку",
    excerpt:
      "Маршруты, объёмный вес и ориентиры доставки из старого справочника. Не использовать без проверки актуальности.",
    category: "delivery",
    tags: ["source-import", "needs-review", "logistics"],
    publish: false,
    source: "Внутренний архив, раздел логистики",
    contentMarkdown: `# Логистика: исходные ориентиры на проверку

> Все суммы ниже являются историческими ориентирами из внутреннего архива. Перед расчётом нужно подтвердить актуальный тариф и маршрут.

## Найденные маршруты

| Маршрут / способ | Историческая заметка |
| --- | --- |
| Medyka → Украина | Расчёт по объёму; в старом документе указан ориентир за куб |
| Logsped | Комиссия, кубатура и фиксированная составляющая |
| Великобритания → Польша | Отдельные правила для малых/тяжёлых и лёгких/объёмных деталей |
| Словакия → Украина | Ориентир по кубатуре |
| США → Украина | Ориентир по килограмму или таблица по типу кузовной детали |
| Китай → Киев | Тариф по весу зависит от общей массы отправления |

## Что уточнить перед расчётом

- страна и склад отправления;
- финальный пункт назначения;
- фактический или объёмный вес;
- количество коробок и размеры;
- входит ли местная доставка до склада;
- VAT/tax-free и валюта оплаты;
- страховка, пошлина и срок доставки.

## Правило безопасности

Не храните полный частный адрес в статье, комментарии или обычном поле задачи. Для checkout используется защищённый destination reference.`,
  },
  {
    slug: "automotive-terms-for-managers",
    title: "Автомобильные термины для менеджера",
    excerpt: "Короткий словарь по охлаждению, выхлопу и моторным деталям из внутренних материалов.",
    category: "general-processes",
    tags: ["onboarding", "glossary", "products"],
    publish: true,
    source: "Внутренний архив, автомобильные термины",
    contentMarkdown: `# Автомобильные термины для менеджера

| Термин | Простое объяснение |
| --- | --- |
| Радиатор | Охлаждает двигатель |
| Теплообменник | Работает с контуром охлаждения интеркулера |
| Downpipe / даунпайп | Участок выхлопа от турбины к остальной системе |
| Catback | Часть выхлопной системы после катализатора |
| Turboback | Выхлопной тракт от турбины назад; состав зависит от автомобиля |
| Catless / без катализатора | Деталь без каталитического нейтрализатора |
| Sport cat | Спортивный катализатор; влияет на поток, звук и требования по выбросам |
| Sleeves / гильзы | Гильзы цилиндров двигателя |
| Pistons / поршни | Детали цилиндро-поршневой группы |
| Connecting rods / шатуны | Соединяют поршни с коленчатым валом |

## Важно

Термины помогают понять запрос, но не подтверждают совместимость. Для подбора всегда нужны автомобиль, год, кузов, двигатель и точный SKU или официальный fitment.`,
  },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const { prisma } = await import("../src/lib/prisma");
  const { buildKnowledgeSearchText } = await import("../src/lib/operations/knowledge");

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const author = await prisma.adminUser.findFirst({
    where: {
      isActive: true,
      ...(email ? { email } : {}),
    },
    select: { id: true, email: true, name: true },
  });

  if (!author) {
    throw new Error(`Active admin${email ? ` ${email}` : ""} was not found`);
  }

  const existing = await prisma.opsKnowledgeArticle.findMany({
    where: { slug: { in: articles.map((article) => article.slug) } },
    select: { slug: true },
  });
  const existingSlugs = new Set(existing.map((article) => article.slug));
  const pending = articles.filter((article) => !existingSlugs.has(article.slug));

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        author: author.email,
        total: articles.length,
        create: pending.map((article) => ({
          slug: article.slug,
          status: article.publish ? "PUBLISHED" : "DRAFT",
          source: article.source,
        })),
        skippedExisting: articles
          .filter((article) => existingSlugs.has(article.slug))
          .map((article) => article.slug),
      },
      null,
      2
    )
  );

  if (!apply) {
    await prisma.$disconnect();
    return;
  }

  for (const article of pending) {
    const status = article.publish ? OpsKnowledgeStatus.PUBLISHED : OpsKnowledgeStatus.DRAFT;
    const searchText = buildKnowledgeSearchText({
      title: article.title,
      excerpt: article.excerpt,
      contentMarkdown: article.contentMarkdown,
      category: article.category,
      brandKey: null,
      tags: article.tags,
    });

    await prisma.$transaction(async (tx) => {
      const created = await tx.opsKnowledgeArticle.create({
        data: {
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt,
          contentMarkdown: article.contentMarkdown,
          locale: "ru",
          category: article.category,
          tags: article.tags,
          searchText,
          status,
          authorId: author.id,
          publishedById: article.publish ? author.id : null,
          publishedRevision: article.publish ? 1 : null,
          publishedAt: article.publish ? new Date() : null,
          revisions: {
            create: {
              revision: 1,
              status,
              title: article.title,
              excerpt: article.excerpt,
              contentMarkdown: article.contentMarkdown,
              locale: "ru",
              category: article.category,
              tags: article.tags,
              changeNote: `Initial source import: ${article.source}`,
              changedById: author.id,
            },
          },
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: author.id,
          actorEmail: author.email,
          actorName: author.name,
          scope: "operations",
          action: "knowledge.source_import",
          entityType: "ops.knowledge",
          entityId: created.id,
          metadata: {
            slug: article.slug,
            source: article.source,
            status,
          },
        },
      });
    });
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
