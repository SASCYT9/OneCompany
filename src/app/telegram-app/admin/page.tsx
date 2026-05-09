"use client";

import { useEffect, useState, useCallback } from "react";
import Script from "next/script";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

// Types
interface Message {
  id: string;
  userName: string;
  userEmail: string | null;
  messageText: string;
  status: "NEW" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
  category: "AUTO" | "MOTO" | "GENERAL" | "PARTNERSHIP";
  createdAt: string;
  metadata?: {
    telegramId?: string;
    username?: string;
    phone?: string;
    companyName?: string;
    website?: string;
    partnershipType?: string;
  };
  replies?: Reply[];
}

interface Reply {
  id: string;
  content: string;
  sentAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TelegramWebApp = any;

type FilterStatus = "ALL" | "NEW" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
type FilterCategory = "ALL" | "AUTO" | "MOTO" | "GENERAL" | "PARTNERSHIP";
type ViewMode = "list" | "detail" | "reply";

const statusColors: Record<string, string> = {
  NEW: "bg-blue-500",
  IN_PROGRESS: "bg-yellow-500",
  COMPLETED: "bg-green-500",
  ARCHIVED: "bg-gray-500",
};

const statusLabels: Record<string, string> = {
  NEW: "🆕 Новий",
  IN_PROGRESS: "⏳ В обробці",
  COMPLETED: "✅ Завершено",
  ARCHIVED: "📁 Архів",
};

const categoryEmoji: Record<string, string> = {
  AUTO: "🚗",
  MOTO: "🏍️",
  GENERAL: "📦",
  PARTNERSHIP: "🤝",
};

export default function TelegramAdminPage() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  // Initialize Telegram WebApp
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const windowWithTg = window as any;
    if (typeof window !== "undefined" && windowWithTg.Telegram?.WebApp) {
      const webApp = windowWithTg.Telegram.WebApp;
      setTg(webApp);
      webApp.ready?.();
      webApp.expand?.();

      // Check URL params for initial filter
      const params = new URLSearchParams(window.location.search);
      const filterParam = params.get("filter");
      if (filterParam === "new") {
        setFilterStatus("NEW");
      }
    }
  }, []);

  // Verify admin status
  useEffect(() => {
    async function verifyAdmin() {
      if (!tg?.initData) {
        // Allow access in dev mode without Telegram
        if (process.env.NODE_ENV === "development") {
          setIsAdmin(true);
          setLoading(false);
          return;
        }
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/telegram/verify-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData }),
        });

        const data = await res.json();
        setIsAdmin(data.isAdmin);

        if (!data.isAdmin) {
          setError("Доступ заборонено. Ви не є адміністратором.");
        }
      } catch (err) {
        console.error("Admin verification failed:", err);
        // Allow in dev mode
        if (process.env.NODE_ENV === "development") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          setError("Помилка перевірки доступу");
        }
      } finally {
        setLoading(false);
      }
    }

    if (tg) {
      verifyAdmin();
    } else if (typeof window !== "undefined") {
      // Wait a bit for Telegram to load
      const timer = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(window as any).Telegram?.WebApp) {
          if (process.env.NODE_ENV === "development") {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
            setError("Telegram Web App not detected");
          }
          setLoading(false);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [tg]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!isAdmin) return;

    setRefreshing(true);
    try {
      const res = await fetch("/api/messages", {
        headers: {
          Authorization: `Bearer ${tg?.initData || "dev"}`,
          "X-Telegram-Init-Data": tg?.initData || "dev",
        },
      });

      if (!res.ok) throw new Error("Failed to fetch messages");

      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Fetch messages error:", err);
      tg?.showAlert?.("Помилка завантаження повідомлень");
    } finally {
      setRefreshing(false);
    }
  }, [isAdmin, tg]);

  useEffect(() => {
    if (isAdmin) {
      fetchMessages();
    }
  }, [isAdmin, fetchMessages]);

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    if (filterStatus !== "ALL" && msg.status !== filterStatus) return false;
    if (filterCategory !== "ALL" && msg.category !== filterCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        msg.userName.toLowerCase().includes(query) ||
        msg.messageText.toLowerCase().includes(query) ||
        msg.userEmail?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Update message status
  const updateStatus = async (messageId: string, newStatus: Message["status"]) => {
    try {
      tg?.HapticFeedback?.impactOccurred("medium");

      const res = await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tg?.initData || "dev"}`,
          "X-Telegram-Init-Data": tg?.initData || "dev",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status: newStatus } : msg))
      );

      if (selectedMessage?.id === messageId) {
        setSelectedMessage((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      tg?.HapticFeedback?.notificationOccurred("success");
    } catch (err) {
      console.error("Update status error:", err);
      tg?.HapticFeedback?.notificationOccurred("error");
      tg?.showAlert?.("Помилка оновлення статусу");
    }
  };

  // Send reply
  const sendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;

    setSending(true);
    try {
      tg?.HapticFeedback?.impactOccurred("medium");

      const res = await fetch(`/api/messages/${selectedMessage.id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tg?.initData || "dev"}`,
          "X-Telegram-Init-Data": tg?.initData || "dev",
        },
        body: JSON.stringify({
          content: replyText,
          sendToTelegram: true,
        }),
      });

      if (!res.ok) throw new Error("Failed to send reply");

      tg?.HapticFeedback?.notificationOccurred("success");
      tg?.showAlert?.("Відповідь надіслано!");

      setReplyText("");
      setViewMode("detail");

      // Refresh message to get updated replies
      await fetchMessages();
    } catch (err) {
      console.error("Send reply error:", err);
      tg?.HapticFeedback?.notificationOccurred("error");
      tg?.showAlert?.("Помилка надсилання відповіді");
    } finally {
      setSending(false);
    }
  };

  // Handle back button
  useEffect(() => {
    if (!tg) return;

    const handleBack = () => {
      tg.HapticFeedback?.impactOccurred("light");
      if (viewMode === "reply") {
        setViewMode("detail");
      } else if (viewMode === "detail") {
        setViewMode("list");
        setSelectedMessage(null);
      }
    };

    if (viewMode !== "list") {
      tg.BackButton?.show();
      tg.BackButton?.onClick(handleBack);
    } else {
      tg.BackButton?.hide();
    }

    return () => {
      tg.BackButton?.hide();
    };
  }, [tg, viewMode]);

  // Theme-aware colors
  // const isDark = tg?.colorScheme === 'dark' || true;
  const bgColor = tg?.themeParams?.bg_color || "#000000";
  const textColor = tg?.themeParams?.text_color || "#ffffff";
  const secondaryBg = tg?.themeParams?.secondary_bg_color || "#1a1a1a";
  const hintColor = tg?.themeParams?.hint_color || "#888888";
  const buttonColor = tg?.themeParams?.button_color || "#3b82f6";

  // Loading state
  if (loading) {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: bgColor }}
        >
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p style={{ color: textColor }}>Завантаження...</p>
          </div>
        </div>
      </>
    );
  }

  // Access denied
  if (!isAdmin) {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{ backgroundColor: bgColor }}
        >
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-xl font-bold mb-2" style={{ color: textColor }}>
              Доступ заборонено
            </h1>
            <p style={{ color: hintColor }}>{error || "Ви не маєте прав адміністратора"}</p>
          </div>
        </div>
      </>
    );
  }

  // Message detail view
  if (viewMode === "detail" && selectedMessage) {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <div className="min-h-screen pb-24" style={{ backgroundColor: bgColor }}>
          <div className="p-4">
            <div className="mb-4">
              <span
                className={`inline-block px-3 py-1 rounded-full text-white text-sm ${statusColors[selectedMessage.status]}`}
              >
                {statusLabels[selectedMessage.status]}
              </span>
              <span className="ml-2 text-lg">{categoryEmoji[selectedMessage.category]}</span>
            </div>

            <h1 className="text-xl font-bold mb-4" style={{ color: textColor }}>
              {selectedMessage.userName}
            </h1>

            <div className="space-y-3 mb-6" style={{ color: textColor }}>
              {selectedMessage.userEmail && (
                <p className="flex items-center gap-2">
                  <span>📧</span>
                  <a href={`mailto:${selectedMessage.userEmail}`} style={{ color: buttonColor }}>
                    {selectedMessage.userEmail}
                  </a>
                </p>
              )}
              {selectedMessage.metadata?.phone && (
                <p className="flex items-center gap-2">
                  <span>📱</span>
                  <a href={`tel:${selectedMessage.metadata.phone}`} style={{ color: buttonColor }}>
                    {selectedMessage.metadata.phone}
                  </a>
                </p>
              )}
              {selectedMessage.metadata?.username && (
                <p className="flex items-center gap-2">
                  <span>💬</span>
                  <a
                    href={`https://t.me/${selectedMessage.metadata.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: buttonColor }}
                  >
                    @{selectedMessage.metadata.username}
                  </a>
                </p>
              )}
              <p className="flex items-center gap-2" style={{ color: hintColor }}>
                <span>📅</span>
                {new Date(selectedMessage.createdAt).toLocaleString("uk-UA")}
              </p>
            </div>

            <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: secondaryBg }}>
              <p style={{ color: textColor, whiteSpace: "pre-wrap" }}>
                {selectedMessage.messageText}
              </p>
            </div>

            {/* Status buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(["NEW", "IN_PROGRESS", "COMPLETED", "ARCHIVED"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => updateStatus(selectedMessage.id, status)}
                  className={`px-4 py-2 rounded-lg text-white text-sm transition-transform active:scale-95 ${
                    selectedMessage.status === status ? "ring-2 ring-white/50" : ""
                  } ${statusColors[status]}`}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>

            {/* Replies */}
            {selectedMessage.replies && selectedMessage.replies.length > 0 && (
              <div className="mb-6">
                <h2 className="font-bold mb-3" style={{ color: textColor }}>
                  📨 Відповіді ({selectedMessage.replies.length})
                </h2>
                <div className="space-y-3">
                  {selectedMessage.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: secondaryBg }}
                    >
                      <p style={{ color: textColor }}>{reply.content}</p>
                      <p className="text-xs mt-2" style={{ color: hintColor }}>
                        {new Date(reply.sentAt).toLocaleString("uk-UA")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reply button */}
            <button
              onClick={() => setViewMode("reply")}
              className="w-full py-3 rounded-lg text-white font-medium"
              style={{ backgroundColor: buttonColor }}
            >
              ✉️ Відповісти
            </button>
          </div>
        </div>
      </>
    );
  }

  // Reply view
  if (viewMode === "reply" && selectedMessage) {
    return (
      <>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <div className="min-h-screen pb-24" style={{ backgroundColor: bgColor }}>
          <div className="p-4">
            <h1 className="text-xl font-bold mb-4" style={{ color: textColor }}>
              ✉️ Відповідь для {selectedMessage.userName}
            </h1>

            <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: secondaryBg }}>
              <p className="text-sm" style={{ color: hintColor }}>
                Оригінальне повідомлення:
              </p>
              <p className="mt-1" style={{ color: textColor }}>
                {selectedMessage.messageText.slice(0, 100)}
                {selectedMessage.messageText.length > 100 ? "..." : ""}
              </p>
            </div>

            {/* Quick templates */}
            <div className="mb-4">
              <p className="text-sm mb-2" style={{ color: hintColor }}>
                Швидкі шаблони:
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    label: "✅ Отримано",
                    text: "Дякуємо за ваше звернення! Ми отримали ваш запит і зв'яжемося з вами найближчим часом.",
                  },
                  {
                    label: "⏳ Обробляємо",
                    text: "Ваш запит обробляється. Наш менеджер зв'яжеться з вами протягом робочого дня.",
                  },
                  {
                    label: "✅ Завершено",
                    text: "Ваш запит оброблено. Дякуємо, що обрали OneCompany!",
                  },
                ].map((template) => (
                  <button
                    key={template.label}
                    onClick={() => setReplyText(template.text)}
                    className="px-3 py-1 rounded-full text-sm"
                    style={{ backgroundColor: secondaryBg, color: textColor }}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Введіть текст відповіді..."
              className="w-full p-3 rounded-lg border-2 resize-none"
              style={{
                backgroundColor: secondaryBg,
                color: textColor,
                borderColor: buttonColor,
                minHeight: "150px",
              }}
            />

            <button
              onClick={sendReply}
              disabled={!replyText.trim() || sending}
              className="w-full mt-4 py-3 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: buttonColor }}
            >
              {sending ? "⏳ Надсилання..." : "📤 Надіслати відповідь"}
            </button>
          </div>
        </div>
      </>
    );
  }

  // List view (default)
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div className="min-h-screen pb-20" style={{ backgroundColor: bgColor }}>
        {/* Header */}
        <div
          className="sticky top-0 z-10 p-4 border-b border-white/10"
          style={{ backgroundColor: bgColor }}
        >
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold" style={{ color: textColor }}>
              🔐 Адмін панель
            </h1>
            <button
              onClick={fetchMessages}
              disabled={refreshing}
              className="p-2 rounded-lg"
              style={{ backgroundColor: secondaryBg }}
            >
              <span className={refreshing ? "animate-spin inline-block" : ""}>🔄</span>
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Пошук..."
            className="w-full p-3 rounded-lg mb-3"
            style={{ backgroundColor: secondaryBg, color: textColor }}
          />

          {/* Status filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {(["ALL", "NEW", "IN_PROGRESS", "COMPLETED", "ARCHIVED"] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setFilterStatus(status);
                  tg?.HapticFeedback?.selectionChanged();
                }}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all ${
                  filterStatus === status ? "text-white" : ""
                }`}
                style={{
                  backgroundColor: filterStatus === status ? buttonColor : secondaryBg,
                  color: filterStatus === status ? "#fff" : textColor,
                }}
              >
                {status === "ALL" ? "📋 Всі" : statusLabels[status]}
              </button>
            ))}
          </div>

          {/* Category filters */}
          <div className="flex gap-2 mt-2 overflow-x-auto pb-2 -mx-4 px-4">
            {(["ALL", "AUTO", "MOTO", "GENERAL", "PARTNERSHIP"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setFilterCategory(cat);
                  tg?.HapticFeedback?.selectionChanged();
                }}
                className={`px-3 py-1 rounded-full text-sm transition-all whitespace-nowrap`}
                style={{
                  backgroundColor: filterCategory === cat ? buttonColor : secondaryBg,
                  color: filterCategory === cat ? "#fff" : textColor,
                }}
              >
                {cat === "ALL"
                  ? "Всі"
                  : `${categoryEmoji[cat]} ${cat === "PARTNERSHIP" ? "Партнери" : cat}`}
              </button>
            ))}
          </div>
        </div>

        {/* Messages list */}
        <div className="px-4 pt-4 pb-32">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <p style={{ color: hintColor }}>Немає повідомлень</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  className="mb-3 relative group"
                >
                  {/* Swipe Actions Background */}
                  <div className="absolute inset-0 rounded-xl overflow-hidden flex">
                    <div className="w-1/2 bg-yellow-500 flex items-center justify-start pl-4">
                      <span className="text-white font-bold text-sm">⏳ В роботу</span>
                    </div>
                    <div className="w-1/2 bg-gray-500 flex items-center justify-end pr-4">
                      <span className="text-white font-bold text-sm">📁 Архів</span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(e, { offset, velocity }) => {
                      const swipe = offset.x;
                      if (swipe > 100) {
                        updateStatus(message.id, "IN_PROGRESS");
                      } else if (swipe < -100) {
                        updateStatus(message.id, "ARCHIVED");
                      }
                    }}
                    onClick={() => {
                      setSelectedMessage(message);
                      setViewMode("detail");
                      tg?.HapticFeedback?.impactOccurred("light");
                    }}
                    className="relative z-10 p-4 rounded-xl cursor-pointer active:scale-[0.98] transition-transform shadow-xs"
                    style={{ backgroundColor: secondaryBg }}
                    whileDrag={{ scale: 1.02, cursor: "grabbing" }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${statusColors[message.status]}`} />
                        <span className="font-medium" style={{ color: textColor }}>
                          {message.userName}
                        </span>
                        <span>{categoryEmoji[message.category]}</span>
                      </div>
                      <span className="text-xs" style={{ color: hintColor }}>
                        {new Date(message.createdAt).toLocaleDateString("uk-UA")}
                      </span>
                    </div>

                    <p className="text-sm line-clamp-2" style={{ color: hintColor }}>
                      {message.messageText}
                    </p>

                    {message.replies && message.replies.length > 0 && (
                      <span
                        className="inline-block mt-2 text-xs px-2 py-1 rounded-full"
                        style={{ backgroundColor: bgColor, color: buttonColor }}
                      >
                        💬 {message.replies.length} відповідей
                      </span>
                    )}

                    {/* Swipe Hint (visible on long press or hover) */}
                    <div
                      className="absolute bottom-1 right-1/2 translate-x-1/2 opacity-0 group-active:opacity-50 transition-opacity text-[10px]"
                      style={{ color: hintColor }}
                    >
                      ← Архів | В роботу →
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Stats bar */}
        <div
          className="fixed bottom-0 left-0 right-0 border-t border-white/10 backdrop-blur-md"
          style={{
            backgroundColor: `${bgColor}E6`, // 90% opacity
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingTop: "1rem",
            paddingLeft: "1rem",
            paddingRight: "1rem",
            height: "calc(80px + env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex justify-around text-center h-full items-start">
            <div
              onClick={() => setFilterStatus("ALL")}
              className="active:scale-90 transition-transform"
            >
              <div className="font-bold text-lg" style={{ color: textColor }}>
                {messages.length}
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: hintColor }}>
                Всього
              </div>
            </div>
            <div
              onClick={() => setFilterStatus("NEW")}
              className="active:scale-90 transition-transform"
            >
              <div className="font-bold text-lg text-blue-500">
                {messages.filter((m) => m.status === "NEW").length}
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: hintColor }}>
                Нових
              </div>
            </div>
            <div
              onClick={() => setFilterStatus("IN_PROGRESS")}
              className="active:scale-90 transition-transform"
            >
              <div className="font-bold text-lg text-yellow-500">
                {messages.filter((m) => m.status === "IN_PROGRESS").length}
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: hintColor }}>
                В роботі
              </div>
            </div>
            <div
              onClick={() => setFilterStatus("COMPLETED")}
              className="active:scale-90 transition-transform"
            >
              <div className="font-bold text-lg text-green-500">
                {messages.filter((m) => m.status === "COMPLETED").length}
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: hintColor }}>
                Готово
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
