'use client';

import { useState, useEffect } from 'react';
import { Search, Send, Trash2, X, RefreshCw, Mail, Phone, MessageCircle, ExternalLink } from 'lucide-react';

interface Message {
  id: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  contactMethod?: 'TELEGRAM' | 'WHATSAPP';
  messageText: string;
  createdAt: string;
  status: 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED';
  replies: { replyText: string; repliedAt: string }[];
  metadata?: {
    model?: string;
    vin?: string;
    budget?: string;
  };
}

interface Stats {
  total: number;
  new: number;
  read: number;
  replied: number;
}

export default function NewMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, new: 0, read: 0, replied: 0 });
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED'>('all');

  useEffect(() => {
    loadMessages();
    loadStats();
  }, []);

  const loadMessages = async () => {
    try {
      const response = await fetch('/api/messages');
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/messages?stats=true');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const updateStatus = async (messageId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', messageId, status: newStatus }),
      });
      if (response.ok) {
        loadMessages();
        loadStats();
        // Update local state immediately for better UX
        if (selectedMessage && selectedMessage.id === messageId) {
          setSelectedMessage({ ...selectedMessage, status: newStatus as any });
        }
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const sendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addReply',
          messageId: selectedMessage.id,
          replyText,
          recipientEmail: selectedMessage.userEmail,
          originalMessage: selectedMessage.messageText,
          userName: selectedMessage.userName,
        }),
      });
      if (response.ok) {
        setReplyText('');
        loadMessages();
        const updatedMessage = await response.json();
        setSelectedMessage(updatedMessage);
        // updateStatus is called implicitly by backend or we can force it here if needed, 
        // but the backend response should have the new status 'REPLIED'
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message? This action cannot be undone.')) return;
    try {
      const response = await fetch(`/api/messages?id=${messageId}`, { method: 'DELETE' });
      if (response.ok) {
        setSelectedMessage(null);
        loadMessages();
        loadStats();
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const cleanPhone = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const openWhatsApp = (phone: string) => {
    const cleaned = cleanPhone(phone);
    window.open(`https://wa.me/${cleaned}`, '_blank');
  };

  const openTelegram = (phone: string) => {
    const cleaned = cleanPhone(phone);
    // Try to open with + prefix for international format
    window.open(`https://t.me/+${cleaned}`, '_blank');
  };

  const filteredMessages = messages.filter(msg => {
    if (filter !== 'all' && msg.status !== filter) return false;
    if (searchQuery && !msg.messageText.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !msg.userName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-[100dvh] bg-zinc-950 text-white flex flex-col font-ua overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex-none z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Messages</h1>
          <button
            onClick={() => { loadMessages(); loadStats(); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex-none bg-zinc-900 border-b border-zinc-800 overflow-x-auto">
        <div className="flex p-2 gap-2 min-w-max">
          <div className="px-3 py-2 bg-zinc-950 rounded-lg border border-zinc-800 min-w-[100px]">
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Total</div>
            <div className="text-xl font-bold">{stats.total}</div>
          </div>
          <div className="px-3 py-2 bg-zinc-950 rounded-lg border border-zinc-800 min-w-[100px]">
            <div className="text-zinc-500 text-xs uppercase tracking-wider">New</div>
            <div className="text-xl font-bold text-blue-400">{stats.new}</div>
          </div>
          <div className="px-3 py-2 bg-zinc-950 rounded-lg border border-zinc-800 min-w-[100px]">
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Read</div>
            <div className="text-xl font-bold text-purple-400">{stats.read}</div>
          </div>
          <div className="px-3 py-2 bg-zinc-950 rounded-lg border border-zinc-800 min-w-[100px]">
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Replied</div>
            <div className="text-xl font-bold text-green-400">{stats.replied}</div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* List View */}
        <div className={`w-full lg:w-[400px] flex flex-col border-r border-zinc-800 bg-zinc-950 ${selectedMessage ? 'hidden lg:flex' : 'flex'}`}>
          {/* Search & Filter */}
          <div className="p-3 border-b border-zinc-800 flex-none space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-sm"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {(['all', 'NEW', 'READ', 'REPLIED'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap border ${
                    filter === status
                      ? 'bg-white text-black border-white'
                      : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto">
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
                <p>No messages found</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (msg.status === 'NEW') updateStatus(msg.id, 'READ');
                    }}
                    className={`p-4 cursor-pointer transition active:bg-zinc-900 ${
                      selectedMessage?.id === msg.id
                        ? 'bg-zinc-900 lg:bg-zinc-900'
                        : 'hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-sm text-white truncate pr-2">{msg.userName}</span>
                      <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 line-clamp-2 mb-2">{msg.messageText}</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                        msg.status === 'NEW' ? 'bg-blue-500/10 text-blue-400' :
                        msg.status === 'READ' ? 'bg-purple-500/10 text-purple-400' :
                        msg.status === 'REPLIED' ? 'bg-green-500/10 text-green-400' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {msg.status}
                      </span>
                      {msg.contactMethod && (
                        <span className="text-[10px] text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded">
                          {msg.contactMethod}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail View (Overlay on Mobile, Column on Desktop) */}
        <div className={`
          fixed inset-0 z-50 bg-zinc-950 flex flex-col
          lg:static lg:flex-1 lg:z-auto lg:bg-zinc-950
          ${selectedMessage ? 'flex' : 'hidden lg:flex'}
        `}>
          {selectedMessage ? (
            <>
              {/* Detail Header */}
              <div className="flex-none p-4 border-b border-zinc-800 bg-zinc-950 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSelectedMessage(null)}
                      className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-white active:bg-zinc-900 rounded-full"
                    >
                      <X className="w-6 h-6" />
                    </button>
                    <div>
                      <h2 className="text-lg font-bold text-white leading-tight">{selectedMessage.userName}</h2>
                      <div className="text-sm text-zinc-400">{selectedMessage.userEmail}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deleteMessage(selectedMessage.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  {selectedMessage.userPhone && (
                    <>
                      <button
                        onClick={() => openTelegram(selectedMessage.userPhone!)}
                        className="flex items-center gap-2 px-3 py-2 bg-[#229ED9]/10 text-[#229ED9] border border-[#229ED9]/20 rounded-lg text-sm font-medium hover:bg-[#229ED9]/20 transition"
                      >
                        <Send className="w-4 h-4" />
                        Telegram
                      </button>
                      <button
                        onClick={() => openWhatsApp(selectedMessage.userPhone!)}
                        className="flex items-center gap-2 px-3 py-2 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded-lg text-sm font-medium hover:bg-[#25D366]/20 transition"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </button>
                    </>
                  )}
                </div>

                {/* Status Toggles */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {(['READ', 'REPLIED', 'ARCHIVED'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => updateStatus(selectedMessage.id, status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap border ${
                        selectedMessage.status === status
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {/* Metadata */}
                {selectedMessage.metadata && (
                  <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                    {selectedMessage.metadata.model && (
                      <div><span className="text-zinc-500">Model:</span> <span className="text-zinc-300">{selectedMessage.metadata.model}</span></div>
                    )}
                    {selectedMessage.metadata.vin && (
                      <div><span className="text-zinc-500">VIN:</span> <span className="text-zinc-300">{selectedMessage.metadata.vin}</span></div>
                    )}
                    {selectedMessage.metadata.budget && (
                      <div className="col-span-2"><span className="text-zinc-500">Budget:</span> <span className="text-zinc-300">{selectedMessage.metadata.budget}</span></div>
                    )}
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 overflow-y-auto p-4 bg-zinc-950">
                <div className="bg-zinc-900/30 rounded-xl p-4 border border-zinc-800/50">
                  <p className="whitespace-pre-wrap text-zinc-200 text-sm leading-relaxed">
                    {selectedMessage.messageText}
                  </p>
                </div>

                {selectedMessage.replies && selectedMessage.replies.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      <div className="h-px bg-zinc-800 flex-1"></div>
                      Reply History
                      <div className="h-px bg-zinc-800 flex-1"></div>
                    </div>
                    {selectedMessage.replies.map((reply, index) => (
                      <div key={index} className="ml-4 pl-4 border-l-2 border-zinc-800">
                        <p className="text-sm text-zinc-400 whitespace-pre-wrap">{reply.replyText}</p>
                        <p className="text-[10px] text-zinc-600 mt-1">{new Date(reply.repliedAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply Input */}
              <div className="flex-none p-4 border-t border-zinc-800 bg-zinc-950">
                <div className="relative">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="w-full p-3 pr-12 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:border-zinc-600 resize-none text-sm min-h-[80px]"
                  />
                  <button
                    onClick={sendReply}
                    disabled={loading || !replyText.trim()}
                    className="absolute bottom-3 right-3 p-2 bg-white text-black rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 p-6 text-center">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-lg font-medium text-zinc-400">No message selected</p>
              <p className="text-sm max-w-xs mt-2">Select a message from the list to view details and reply.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
