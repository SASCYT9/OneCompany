'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Filter, 
  Archive, 
  CheckCircle, 
  Clock, 
  Mail,
  User,
  Calendar,
  Search,
  X,
  Send,
  BarChart3,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface TelegramMessage {
  id: string;
  chatId: number;
  userId: number;
  userName: string;
  userUsername?: string;
  messageText: string;
  timestamp: string;
  type: 'incoming' | 'command' | 'contact_form';
  category?: 'auto' | 'moto' | 'general';
  status: 'new' | 'read' | 'replied' | 'archived';
  replies?: {
    text: string;
    timestamp: string;
    sentBy: string;
  }[];
}

interface Stats {
  total: number;
  new: number;
  read: number;
  replied: number;
  archived: number;
  auto: number;
  moto: number;
  general: number;
  today: number;
}

export default function MessagesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<TelegramMessage | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const auth = sessionStorage.getItem('messagesAuth') === 'true';
    const savedPassword = sessionStorage.getItem('messagesPassword');
    if (auth && savedPassword) {
      setPassword(savedPassword);
      setIsAuthenticated(true);
      loadMessages(savedPassword);
      loadStats(savedPassword);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    sessionStorage.setItem('messagesAuth', 'true');
    sessionStorage.setItem('messagesPassword', password);
    setIsAuthenticated(true);
    loadMessages(password);
    loadStats(password);
  };

  const loadMessages = async (pwd: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/messages', {
        headers: { 'Authorization': `Bearer ${pwd}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
    setLoading(false);
  };

  const loadStats = async (pwd: string) => {
    try {
      const response = await fetch('/api/messages?stats=true', {
        headers: { 'Authorization': `Bearer ${pwd}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const updateStatus = async (messageId: string, status: string) => {
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${password}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateStatus',
          messageId,
          status,
        }),
      });
      if (response.ok) {
        loadMessages(password);
        loadStats(password);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const sendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${password}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'addReply',
          messageId: selectedMessage.id,
          reply: replyText,
        }),
      });
      if (response.ok) {
        setReplyText('');
        loadMessages(password);
        updateStatus(selectedMessage.id, 'replied');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Видалити це повідомлення?')) return;

    try {
      const response = await fetch(`/api/messages?id=${messageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${password}` },
      });
      if (response.ok) {
        setSelectedMessage(null);
        loadMessages(password);
        loadStats(password);
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filterStatus !== 'all' && msg.status !== filterStatus) return false;
    if (filterCategory !== 'all' && msg.category !== filterCategory) return false;
    if (searchQuery && !msg.messageText.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !msg.userName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-10">
            <MessageSquare className="w-16 h-16 mx-auto mb-6 text-zinc-900 dark:text-white" />
            <h1 className="text-4xl font-light text-zinc-900 dark:text-white mb-4">
              Messages Dashboard
            </h1>
            <p className="text-zinc-600 dark:text-white/60">
              Введіть пароль для доступу
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
              required
            />
            <button
              type="submit"
              className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black font-light uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-white/90 transition-all"
            >
              Увійти
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <MessageSquare className="w-8 h-8 text-zinc-900 dark:text-white" />
            <div>
              <h1 className="text-2xl font-light text-zinc-900 dark:text-white">
                Messages Dashboard
              </h1>
              <p className="text-sm text-zinc-500 dark:text-white/50">
                Telegram & Contact Form
              </p>
            </div>
          </div>
          <button
            onClick={() => loadMessages(password)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors"
            title="Оновити"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Stats */}
      {stats && (
        <div className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-white/10 px-6 py-6">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <StatCard label="Всього" value={stats.total} />
            <StatCard label="Нові" value={stats.new} color="blue" />
            <StatCard label="Прочитані" value={stats.read} />
            <StatCard label="Відповіді" value={stats.replied} color="green" />
            <StatCard label="Архів" value={stats.archived} />
            <StatCard label="Авто" value={stats.auto} color="purple" />
            <StatCard label="Мото" value={stats.moto} color="orange" />
            <StatCard label="Сьогодні" value={stats.today} color="blue" />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
              />
            </div>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
          >
            <option value="all">Всі статуси</option>
            <option value="new">Нові</option>
            <option value="read">Прочитані</option>
            <option value="replied">Відповіді</option>
            <option value="archived">Архів</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
          >
            <option value="all">Всі категорії</option>
            <option value="auto">Авто</option>
            <option value="moto">Мото</option>
            <option value="general">Загальні</option>
          </select>
        </div>
      </div>

      {/* Messages List & Details */}
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-1 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 dark:text-white/50">
              Повідомлень не знайдено
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <motion.div
                key={msg.id}
                onClick={() => {
                  setSelectedMessage(msg);
                  if (msg.status === 'new') {
                    updateStatus(msg.id, 'read');
                  }
                }}
                className={`p-4 bg-white dark:bg-zinc-950 border cursor-pointer transition-all ${
                  selectedMessage?.id === msg.id
                    ? 'border-zinc-900 dark:border-white shadow-lg'
                    : 'border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/30'
                }`}
                whileHover={{ x: 4 }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-zinc-500" />
                    <span className="font-medium text-zinc-900 dark:text-white text-sm">
                      {msg.userName}
                    </span>
                  </div>
                  <StatusBadge status={msg.status} />
                </div>
                <p className="text-sm text-zinc-600 dark:text-white/60 line-clamp-2 mb-2">
                  {msg.messageText}
                </p>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{new Date(msg.timestamp).toLocaleDateString('uk-UA')}</span>
                  {msg.category && (
                    <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-900 uppercase">
                      {msg.category}
                    </span>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Message Details */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10">
          {selectedMessage ? (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-6 border-b border-zinc-200 dark:border-white/10">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-light text-zinc-900 dark:text-white mb-2">
                      {selectedMessage.userName}
                    </h2>
                    {selectedMessage.userUsername && (
                      <p className="text-sm text-zinc-500">@{selectedMessage.userUsername}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMessage(selectedMessage.id)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <StatusButton
                    status="read"
                    onClick={() => updateStatus(selectedMessage.id, 'read')}
                    active={selectedMessage.status === 'read'}
                  />
                  <StatusButton
                    status="replied"
                    onClick={() => updateStatus(selectedMessage.id, 'replied')}
                    active={selectedMessage.status === 'replied'}
                  />
                  <StatusButton
                    status="archived"
                    onClick={() => updateStatus(selectedMessage.id, 'archived')}
                    active={selectedMessage.status === 'archived'}
                  />
                </div>

                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedMessage.timestamp).toLocaleString('uk-UA')}
                  </div>
                  <div className="px-2 py-1 bg-zinc-100 dark:bg-zinc-900 text-xs uppercase">
                    {selectedMessage.type}
                  </div>
                </div>
              </div>

              {/* Message */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-zinc-900 dark:text-white">
                    {selectedMessage.messageText}
                  </p>
                </div>

                {/* Replies */}
                {selectedMessage.replies && selectedMessage.replies.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm uppercase tracking-widest text-zinc-500 mb-4">
                      Відповіді ({selectedMessage.replies.length})
                    </h3>
                    {selectedMessage.replies.map((reply, idx) => (
                      <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-zinc-900 dark:border-white">
                        <p className="text-sm text-zinc-900 dark:text-white mb-2">
                          {reply.text}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span>{reply.sentBy}</span>
                          <span>•</span>
                          <span>{new Date(reply.timestamp).toLocaleString('uk-UA')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply Box */}
              <div className="p-6 border-t border-zinc-200 dark:border-white/10">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Написати відповідь..."
                    className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim()}
                    className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    <span>Відправити</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 dark:text-white/50">
              Оберіть повідомлення для перегляду
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorClass = color === 'blue' ? 'text-blue-600' :
                     color === 'green' ? 'text-green-600' :
                     color === 'purple' ? 'text-purple-600' :
                     color === 'orange' ? 'text-orange-600' :
                     'text-zinc-900 dark:text-white';

  return (
    <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30">
      <div className={`text-2xl font-light ${colorClass} mb-1`}>{value}</div>
      <div className="text-xs uppercase tracking-widest text-zinc-500 dark:text-white/50">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    new: { label: 'Нове', color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600' },
    read: { label: 'Прочитано', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600' },
    replied: { label: 'Відповідь', color: 'bg-green-100 dark:bg-green-900/20 text-green-600' },
    archived: { label: 'Архів', color: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500' },
  };

  const { label, color } = config[status as keyof typeof config] || config.new;

  return (
    <span className={`px-2 py-1 text-xs uppercase tracking-wider ${color}`}>
      {label}
    </span>
  );
}

function StatusButton({ status, onClick, active }: { status: string; onClick: () => void; active: boolean }) {
  const config = {
    read: { label: 'Прочитано', icon: CheckCircle },
    replied: { label: 'Відповідь', icon: Send },
    archived: { label: 'Архів', icon: Archive },
  };

  const { label, icon: Icon } = config[status as keyof typeof config];

  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
        active
          ? 'bg-zinc-900 dark:bg-white text-white dark:text-black'
          : 'bg-zinc-100 dark:bg-zinc-900/50 text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-zinc-900'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
