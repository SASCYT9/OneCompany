"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { OpsMiniAppAction, OpsMiniAppDay, OpsMiniAppTask } from "@/lib/operations/miniApp";

type MiniAppPayload = {
  member: { name: string; canAssign: boolean; timeZone: string };
  day: OpsMiniAppDay;
  links: { tasks: string; triage: string };
};

type LoadState =
  | { kind: "loading" }
  | { kind: "outside" }
  | { kind: "expired" }
  | { kind: "forbidden" }
  | { kind: "error" }
  | { kind: "ready"; data: MiniAppPayload };

const INIT_STORAGE_KEY = "ops-app-init-data";

type TelegramBridgeWindow = Window & {
  TelegramWebviewProxy?: { postEvent(eventType: string, eventData: string): void };
  external?: { notify?: (message: string) => void };
};

/** Minimal Telegram Mini App bridge (no external SDK script needed). */
function postTelegramEvent(eventType: string, eventData: Record<string, unknown> = {}) {
  const target = window as TelegramBridgeWindow;
  try {
    if (target.TelegramWebviewProxy?.postEvent) {
      target.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
    } else if (typeof target.external?.notify === "function") {
      target.external.notify(JSON.stringify({ eventType, eventData }));
    } else if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify({ eventType, eventData }), "*");
    }
  } catch {
    // Outside Telegram: nothing to tell.
  }
}

function readInitData() {
  try {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const fromHash = hash.get("tgWebAppData");
    if (fromHash) {
      window.sessionStorage.setItem(INIT_STORAGE_KEY, fromHash);
      return fromHash;
    }
    return window.sessionStorage.getItem(INIT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function openExternal(url: string) {
  const target = window as TelegramBridgeWindow;
  if (target.TelegramWebviewProxy || window.parent !== window) {
    postTelegramEvent("web_app_open_link", { url });
  } else {
    window.open(url, "_blank", "noopener");
  }
}

function demoData(): MiniAppPayload {
  const now = Date.now();
  const hours = (value: number) => new Date(now + value * 3_600_000).toISOString();
  const task = (
    number: number,
    title: string,
    dueAt: string | null,
    extra: Partial<OpsMiniAppTask> = {}
  ): OpsMiniAppTask => ({
    id: `demo_task_${number}`,
    number,
    title,
    dueAt,
    priority: "NORMAL",
    nextAction: null,
    orderNumber: null,
    repeatLabel: null,
    assigneeNames: ["Саша"],
    adminUrl: "#",
    ...extra,
  });
  return {
    member: { name: "Саша", canAssign: true, timeZone: "Europe/Kyiv" },
    day: {
      overdue: [
        task(1016, "Уточнить ETA по Dinan Suspension Link Kit в USP Motorsports", hours(-30), {
          nextAction: "Написать в USP Motorsports и спросить трек-номер",
        }),
      ],
      today: [
        task(1029, "Отправить заказ OC-2026-00029: оплачен, ТТН нет", hours(3), {
          priority: "HIGH",
          orderNumber: "OC-2026-00029",
        }),
        task(1031, "Проверить прайс do88", hours(5), { repeatLabel: "Каждую неделю" }),
      ],
      upcoming: [task(1027, "Узнать сроки Akrapovič для BMW M3", hours(50))],
      noDue: [],
      unassigned: [
        task(1026, "Связаться с поставщиками по поршневым кольцам McLaren M840T", hours(-200), {
          assigneeNames: [],
        }),
      ],
      counts: { overdue: 1, today: 2, open: 4, unassigned: 1 },
    },
    links: { tasks: "#", triage: "#" },
  };
}

function dueLabel(task: OpsMiniAppTask, timeZone: string) {
  if (!task.dueAt) return "без срока";
  const due = new Date(task.dueAt);
  const now = new Date();
  const day = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(value);
  const time = new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(due);
  if (day(due) === day(now))
    return due < now ? `сегодня, срок был в ${time}` : `сегодня до ${time}`;
  const date = new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(due);
  return due < now ? `срок был ${date}` : `${date}, ${time}`;
}

function ActionButton({
  label,
  tone = "neutral",
  disabled,
  onClick,
}: {
  label: string;
  tone?: "primary" | "neutral" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  const tones = {
    primary: "border-blue-500 bg-blue-600 text-white active:bg-blue-700",
    neutral: "border-white/10 bg-white/[0.04] text-zinc-200 active:bg-white/10",
    danger: "border-red-500/30 bg-red-500/10 text-red-200 active:bg-red-500/20",
  } as const;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-10 border px-3 text-[13px] font-medium transition disabled:opacity-40 ${tones[tone]}`}
    >
      {label}
    </button>
  );
}

function TaskCard({
  task,
  timeZone,
  busy,
  variant,
  onAction,
}: {
  task: OpsMiniAppTask;
  timeZone: string;
  busy: boolean;
  variant: "urgent" | "later" | "unassigned";
  onAction: (task: OpsMiniAppTask, action: OpsMiniAppAction) => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const overdue = task.dueAt ? new Date(task.dueAt) < new Date() : false;
  return (
    <article className="border border-white/10 bg-[#141414] p-3" data-ops-app-task={task.number}>
      <button
        type="button"
        onClick={() => openExternal(task.adminUrl)}
        className="block w-full text-left"
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-xs tabular-nums text-zinc-500">#{task.number}</span>
          <span className="text-[15px] font-medium leading-snug text-zinc-50">{task.title}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-xs">
          <span className={overdue ? "text-red-300" : "text-zinc-400"}>
            {dueLabel(task, timeZone)}
          </span>
          {task.priority === "HIGH" || task.priority === "URGENT" ? (
            <span className="text-amber-300">важно</span>
          ) : null}
          {task.orderNumber ? <span className="text-zinc-400">🛒 {task.orderNumber}</span> : null}
          {task.repeatLabel ? <span className="text-zinc-400">🔁 {task.repeatLabel}</span> : null}
        </div>
        {task.nextAction ? (
          <p className="mt-1.5 pl-9 text-xs leading-relaxed text-zinc-400">➡️ {task.nextAction}</p>
        ) : null}
      </button>
      <div className="mt-3 flex flex-wrap gap-2 pl-9">
        {variant === "unassigned" ? (
          <>
            <ActionButton
              label="🙋 Беру"
              tone="primary"
              disabled={busy}
              onClick={() => onAction(task, "take")}
            />
            <ActionButton
              label={confirmCancel ? "Точно не нужна?" : "🗑 Не нужна"}
              tone="danger"
              disabled={busy}
              onClick={() => (confirmCancel ? onAction(task, "cancel") : setConfirmCancel(true))}
            />
          </>
        ) : (
          <>
            <ActionButton
              label="✅ Готово"
              tone="primary"
              disabled={busy}
              onClick={() => onAction(task, "done")}
            />
            {variant === "urgent" ? (
              <>
                <ActionButton
                  label="⏰ Завтра"
                  disabled={busy}
                  onClick={() => onAction(task, "snooze_tomorrow")}
                />
                <ActionButton
                  label="📅 +неделя"
                  disabled={busy}
                  onClick={() => onAction(task, "snooze_week")}
                />
              </>
            ) : null}
            <ActionButton
              label={confirmCancel ? "Точно не нужна?" : "🗑"}
              tone="danger"
              disabled={busy}
              onClick={() => (confirmCancel ? onAction(task, "cancel") : setConfirmCancel(true))}
            />
          </>
        )}
      </div>
    </article>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">{title}</h2>
        {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function OpsMiniApp() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [initData, setInitData] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (data: string) => {
    try {
      const response = await fetch("/api/operations/miniapp", {
        headers: { "x-telegram-init-data": data },
        cache: "no-store",
      });
      if (response.status === 401) return setState({ kind: "expired" });
      if (response.status === 403 || response.status === 404) {
        return setState({ kind: "forbidden" });
      }
      if (!response.ok) return setState({ kind: "error" });
      setState({ kind: "ready", data: (await response.json()) as MiniAppPayload });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    postTelegramEvent("web_app_set_header_color", { color: "#0A0A0A" });
    postTelegramEvent("web_app_set_background_color", { color: "#0A0A0A" });
    postTelegramEvent("web_app_expand");
    postTelegramEvent("web_app_ready");
    const params = new URLSearchParams(window.location.search);
    if (process.env.NODE_ENV !== "production" && params.get("demo") === "1") {
      setDemo(true);
      setState({ kind: "ready", data: demoData() });
      return;
    }
    const data = readInitData();
    setInitData(data);
    if (!data) {
      setState({ kind: "outside" });
      return;
    }
    void load(data);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3_500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runAction = useCallback(
    async (task: OpsMiniAppTask, action: OpsMiniAppAction) => {
      if (demo) {
        setToast(`#${task.number}: в демо-режиме ничего не меняю.`);
        return;
      }
      if (!initData) return;
      setBusyId(task.id);
      try {
        const response = await fetch("/api/operations/miniapp", {
          method: "POST",
          headers: { "content-type": "application/json", "x-telegram-init-data": initData },
          body: JSON.stringify({ taskId: task.id, action }),
        });
        if (response.status === 401) {
          setState({ kind: "expired" });
          return;
        }
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setToast(body.message ?? (response.ok ? "Готово." : "Не получилось — попробуйте ещё раз."));
        postTelegramEvent("web_app_trigger_haptic_feedback", {
          type: "notification",
          notification_type: response.ok ? "success" : "error",
        });
        await load(initData);
      } catch {
        setToast("Нет связи — попробуйте ещё раз.");
      } finally {
        setBusyId(null);
      }
    },
    [demo, initData, load]
  );

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    []
  );

  if (state.kind !== "ready") {
    const messages: Record<Exclude<LoadState["kind"], "ready">, [string, string]> = {
      loading: ["Загружаю «Мой день»…", ""],
      outside: [
        "Откройте из Telegram",
        "«Мой день» работает внутри бота команды: кнопка «📱 Мой день» под полем ввода.",
      ],
      expired: [
        "Сессия устарела",
        "Закройте окно и откройте «Мой день» снова из бота — так безопаснее.",
      ],
      forbidden: [
        "Нет доступа",
        "Ваш Telegram не привязан к админке. Попросите владельца включить вас в «Работа → Команда».",
      ],
      error: ["Не загрузилось", "Проверьте связь и откройте ещё раз."],
    };
    const [title, text] = messages[state.kind];
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#0A0A0A] px-6 text-center text-zinc-100 [color-scheme:dark]">
        <div className="max-w-sm space-y-2" data-ops-app-state={state.kind}>
          <h1 className="text-lg font-semibold">{title}</h1>
          {text ? <p className="text-sm leading-relaxed text-zinc-400">{text}</p> : null}
        </div>
      </main>
    );
  }

  const { member, day, links } = state.data;
  const urgent = [...day.overdue, ...day.today];
  const tiles: Array<[string, number, string]> = [
    ["Просрочено", day.counts.overdue, day.counts.overdue ? "text-red-300" : "text-zinc-50"],
    ["Сегодня", day.counts.today, "text-zinc-50"],
    ["Всего моих", day.counts.open, "text-zinc-50"],
    ...(member.canAssign
      ? ([
          [
            "Без исполнителя",
            day.counts.unassigned,
            day.counts.unassigned ? "text-amber-300" : "text-zinc-50",
          ],
        ] as Array<[string, number, string]>)
      : []),
  ];

  return (
    <main
      className="admin-context min-h-[100dvh] bg-[#0A0A0A] pb-10 text-zinc-100 [color-scheme:dark]"
      data-ops-app
    >
      <header className="border-b border-white/10 px-4 pb-4 pt-5">
        <p className="text-xs capitalize text-zinc-500">{today}</p>
        <h1 className="mt-1 text-xl font-semibold">Мой день · {member.name}</h1>
        {demo ? (
          <p className="mt-1 text-xs text-amber-300">Демо-режим: данные ненастоящие.</p>
        ) : null}
      </header>

      <div
        className={`grid gap-px border-b border-white/10 bg-white/10 ${
          tiles.length === 4 ? "grid-cols-2 min-[480px]:grid-cols-4" : "grid-cols-3"
        }`}
      >
        {tiles.map(([label, value, tone]) => (
          <div key={label} className="bg-[#0A0A0A] px-3 py-3">
            <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
            <div className="mt-0.5 text-[11px] leading-tight text-zinc-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-6 px-3 pt-5">
        <Section title="Горит" hint={urgent.length ? "просрочено и срок сегодня" : undefined}>
          {urgent.length ? (
            urgent.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                timeZone={member.timeZone}
                busy={busyId === task.id}
                variant="urgent"
                onAction={runAction}
              />
            ))
          ) : (
            <p className="border border-white/10 bg-[#141414] px-3 py-4 text-sm text-zinc-400">
              👌 Ничего не горит. Можно заняться тем, что дальше.
            </p>
          )}
        </Section>

        {member.canAssign && day.unassigned.length ? (
          <Section title="Без исполнителя" hint={`${day.counts.unassigned}`}>
            {day.unassigned.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                timeZone={member.timeZone}
                busy={busyId === task.id}
                variant="unassigned"
                onAction={runAction}
              />
            ))}
          </Section>
        ) : null}

        {day.upcoming.length ? (
          <Section title="Дальше">
            {day.upcoming.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                timeZone={member.timeZone}
                busy={busyId === task.id}
                variant="later"
                onAction={runAction}
              />
            ))}
          </Section>
        ) : null}

        {day.noDue.length ? (
          <Section title="Без срока">
            {day.noDue.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                timeZone={member.timeZone}
                busy={busyId === task.id}
                variant="later"
                onAction={runAction}
              />
            ))}
          </Section>
        ) : null}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={() => openExternal(links.tasks)}
            className="h-11 border border-white/10 bg-white/[0.04] text-sm text-zinc-200"
          >
            📋 Все задачи
          </button>
          <button
            type="button"
            onClick={() => openExternal(links.triage)}
            className="h-11 border border-white/10 bg-white/[0.04] text-sm text-zinc-200"
          >
            🗂 Разобрать зависшие
          </button>
        </div>
        <p className="px-1 text-xs leading-relaxed text-zinc-500">
          Нажмите на задачу, чтобы открыть её в админке. Ответ на сообщение бота тоже работает:
          «готово», «перенеси на пятницу», «передай Игорю».
        </p>
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed inset-x-3 bottom-4 border border-white/10 bg-[#1f1f1f] px-4 py-3 text-sm text-zinc-100 shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}
