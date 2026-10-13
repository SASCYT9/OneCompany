export const opsRu = {
  navigation: {
    overview: "Обзор",
    inbox: "Входящие",
    projects: "Проекты",
    tasks: "Задачи",
    knowledge: "БАЗА",
    more: "Ещё",
  },
  common: {
    search: "Поиск",
    create: "Создать",
    edit: "Редактировать",
    save: "Сохранить",
    cancel: "Отмена",
    retry: "Повторить",
    open: "Открыть",
    loading: "Загрузка…",
    noData: "Пока ничего нет",
    all: "Все",
    today: "Сегодня",
    mine: "Мои",
  },
  tasks: {
    title: "Задачи команды",
    subtitle: "Фокус на сегодня",
    create: "Создать задачу",
    views: {
      list: "Список",
      board: "Доска",
      calendar: "Календарь",
    },
    filters: {
      all: "Все",
      today: "Сегодня",
      overdue: "Просрочено",
      waiting: "Ожидание",
    },
    empty: "Задач по выбранному фильтру нет",
    loadError: "Не удалось загрузить задачи",
    transitionError: "Статус не изменён. Обновите задачу и попробуйте ещё раз.",
  },
  knowledge: {
    title: "БАЗА",
    subtitle: "Рабочие инструкции для команды",
    create: "Новая статья",
    draft: "Черновик",
    published: "Опубликовано",
    empty: "Статей по этому запросу пока нет",
    categories: {
      pricing: "Цены и бренды",
      delivery: "Доставка",
      orders: "Оформление заказов",
      suppliers: "Поставщики",
      processes: "Общие процессы",
      notes: "Заметки команды",
    },
  },
  inbox: {
    title: "Входящие",
    subtitle: "Сообщения Telegram, которые ждут проверки",
    apply: "Создать всё",
    edit: "Исправить",
    chooseProject: "Выбрать проект",
    assign: "Назначить",
    ignore: "Игнорировать",
    empty: "Новых входящих нет",
  },
  projects: {
    title: "Проекты",
    subtitle: "Работа, которая объединяет задачи и заказы",
    create: "Новый проект",
    empty: "Активных проектов пока нет",
  },
} as const;

export const OPS_STATUS_LABELS = {
  INBOX: "Входящие",
  PLANNED: "Запланировано",
  IN_PROGRESS: "В работе",
  AGENT_RUNNING: "Выполняет агент",
  WAITING_HUMAN: "Ждём сотрудника",
  WAITING_EXTERNAL: "Ждём информацию",
  NEEDS_APPROVAL: "Нужно согласовать",
  REVIEW: "На проверке",
  BLOCKED: "Заблокировано",
  DONE: "Готово",
  CANCELLED: "Отменено",
} as const;

export const OPS_PRIORITY_LABELS = {
  LOW: "Низкий",
  NORMAL: "Обычный",
  HIGH: "Высокий",
  URGENT: "Срочный",
} as const;

export type OpsLocaleKey = keyof typeof opsRu;

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** «сегодня, 16:18», «вчера, 09:05», «29 сент., 16:18», «29 сент. 2025 г.». */
export function formatOpsWhen(value: string | Date, now = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(
    date
  );
  if (sameLocalDay(date, now)) return `сегодня, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameLocalDay(date, yesterday)) return `вчера, ${time}`;
  if (date.getFullYear() === now.getFullYear()) {
    const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
    return `${day}, ${time}`;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
