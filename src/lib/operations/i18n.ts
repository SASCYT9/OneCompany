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
