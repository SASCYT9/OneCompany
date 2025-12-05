'use client';

import { useState, useEffect } from 'react';
import { Search, Send, Trash2, X, RefreshCw, Mail, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  contactMethod?: 'TELEGRAM' | 'WHATSAPP';
  messageText: string;
  createdAt: string;
  status: 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED';
  replies: { replyText: string; createdAt: string }[];
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

  const updateStatus = async (messageId: string, newStatus: Message['status']) => {
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
          setSelectedMessage({ ...selectedMessage, status: newStatus });
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
      
      const data = await response.json();
      
      if (response.ok) {
        setReplyText('');
        loadMessages();
        setSelectedMessage(data);
        alert('Reply sent successfully!');
      } else {
        alert(`Failed to send reply: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('Failed to send reply. Check console for details.');
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
    window.open(`https://t.me/+${cleaned}`, '_blank');
  };

  const filteredMessages = messages.filter(msg => {
    if (filter !== 'all' && msg.status !== filter) return false;
    if (searchQuery && !msg.messageText.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !msg.userName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full bg-black text-white flex flex-col font-ua overflow-hidden">
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex-none z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium tracking-tight">Messages</h1>
          <button
            onClick={() => { loadMessages(); loadStats(); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-xs font-medium border border-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex-none bg-zinc-900/30 border-b border-white/5 overflow-x-auto">
        <div className="flex p-2 gap-2 min-w-max">
          <div className="px-4 py-2 bg-black rounded-xl border border-white/10 min-w-[100px]">
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-1">Total</div>
            <div className="text-xl font-light tracking-tight">{stats.total}</div>
          </div>
          <div className="px-4 py-2 bg-black rounded-xl border border-white/10 min-w-[100px]">
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-1">New</div>
            <div className="text-xl font-light tracking-tight text-blue-400">{stats.new}</div>
          </div>
          <div className="px-4 py-2 bg-black rounded-xl border border-white/10 min-w-[100px]">
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-1">Read</div>
            <div className="text-xl font-light tracking-tight text-purple-400">{stats.read}</div>
          </div>
          <div className="px-4 py-2 bg-black rounded-xl border border-white/10 min-w-[100px]">
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-1">Replied</div>
            <div className="text-xl font-light tracking-tight text-green-400">{stats.replied}</div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative bg-black">
        
        {/* List View */}
        <div className={`w-full lg:w-[400px] flex flex-col border-r border-white/10 bg-black ${selectedMessage ? 'hidden lg:flex' : 'flex'}`}>
          {/* Search & Filter */}
          <div className="p-3 border-b border-white/10 flex-none space-y-3 bg-black/50 backdrop-blur-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/50 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 text-sm placeholder:text-zinc-600 transition-colors"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {(['all', 'NEW', 'READ', 'REPLIED'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-medium transition whitespace-nowrap border ${
                    filter === status
                      ? 'bg-white text-black border-white'
                      : 'bg-transparent text-zinc-400 border-white/10 hover:border-white/30'
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
              <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                <p className="text-sm">No messages found</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (msg.status === 'NEW') updateStatus(msg.id, 'READ');
                    }}
                    className={`p-5 cursor-pointer transition-all duration-200 ${
                      selectedMessage?.id === msg.id
                        ? 'bg-zinc-900 border-l-2 border-white'
                        : 'hover:bg-zinc-900/30 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-base truncate pr-2 ${msg.status === 'NEW' ? 'font-bold text-white' : 'font-medium text-zinc-300'}`}>
                        {msg.userName}
                      </span>
                      <span className="text-xs text-zinc-500 whitespace-nowrap font-mono">
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-sm line-clamp-2 mb-3 ${msg.status === 'NEW' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {msg.messageText}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded text-xs font-medium uppercase tracking-wider ${
                        msg.status === 'NEW' ? 'bg-blue-500/10 text-blue-400' :
                        msg.status === 'READ' ? 'bg-purple-500/10 text-purple-400' :
                        msg.status === 'REPLIED' ? 'bg-green-500/10 text-green-400' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {msg.status}
                      </span>
                      {msg.contactMethod && (
                        <span className="text-xs text-zinc-500 border border-white/10 px-2 py-0.5 rounded bg-white/5">
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
          fixed inset-0 z-50 bg-black flex flex-col
          lg:static lg:flex-1 lg:z-auto lg:bg-black
          ${selectedMessage ? 'flex' : 'hidden lg:flex'}
        `}>
          {selectedMessage ? (
            <>
              {/* Detail Header */}
              <div className="flex-none p-6 border-b border-white/10 bg-black flex flex-col gap-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setSelectedMessage(null)}
                      className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-white active:bg-zinc-900 rounded-full transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                    <div>
                      <h2 className="text-xl font-semibold text-white leading-tight tracking-tight">{selectedMessage.userName}</h2>
                      <div className="text-sm text-zinc-500 font-light">{selectedMessage.userEmail}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deleteMessage(selectedMessage.id)}
                      className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-3">
                  {selectedMessage.userPhone && (
                    <>
                      <button
                        onClick={() => openTelegram(selectedMessage.userPhone!)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#229ED9]/10 text-[#229ED9] border border-[#229ED9]/20 rounded-xl text-sm font-medium hover:bg-[#229ED9]/20 transition-all active:scale-95"
                      >
                        <Send className="w-4 h-4" />
                        Telegram
                      </button>
                      <button
                        onClick={() => openWhatsApp(selectedMessage.userPhone!)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded-xl text-sm font-medium hover:bg-[#25D366]/20 transition-all active:scale-95"
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
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap border ${
                        selectedMessage.status === status
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent text-zinc-500 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {/* Metadata */}
                {selectedMessage.metadata && (
                  <div className="grid grid-cols-2 gap-4 text-sm bg-zinc-900/30 p-5 rounded-xl border border-white/5">
                    {selectedMessage.metadata.model && (
                      <div><span className="text-zinc-500 block mb-1">Model</span> <span className="text-zinc-200 font-medium">{selectedMessage.metadata.model}</span></div>
                    )}
                    {selectedMessage.metadata.vin && (
                      <div><span className="text-zinc-500 block mb-1">VIN</span> <span className="text-zinc-200 font-mono">{selectedMessage.metadata.vin}</span></div>
                    )}
                    {selectedMessage.metadata.budget && (
                      <div className="col-span-2 pt-3 border-t border-white/5"><span className="text-zinc-500 block mb-1">Budget</span> <span className="text-zinc-200 font-medium">{selectedMessage.metadata.budget}</span></div>
                    )}
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-black">
                <div className="bg-zinc-900/20 rounded-2xl p-6 border border-white/5">
                  <p className="whitespace-pre-wrap text-zinc-200 text-base leading-relaxed font-light">
                    {selectedMessage.messageText}
                  </p>
                </div>

                {selectedMessage.replies && selectedMessage.replies.length > 0 && (
                  <div className="mt-8 space-y-6">
                    <div className="flex items-center gap-4 text-xs font-medium text-zinc-600 uppercase tracking-widest">
                      <div className="h-px bg-zinc-900 flex-1"></div>
                      Reply History
                      <div className="h-px bg-zinc-900 flex-1"></div>
                    </div>
                    {selectedMessage.replies.map((reply, index) => (
                      <div key={index} className="ml-6 pl-6 border-l border-zinc-800 relative">
                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-zinc-800 border-2 border-black"></div>
                        <p className="text-base text-zinc-400 whitespace-pre-wrap leading-relaxed">{reply.replyText}</p>
                        <p className="text-xs text-zinc-600 mt-2 font-mono">{new Date(reply.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply Input */}
              <div className="flex-none p-6 border-t border-white/10 bg-black">
                <div className="relative group">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="w-full p-4 pr-16 bg-zinc-900/30 border border-white/10 rounded-2xl focus:outline-none focus:border-white/20 focus:bg-zinc-900/50 resize-none text-base min-h-[120px] transition-all placeholder:text-zinc-700"
                  />
                  <button
                    onClick={sendReply}
                    disabled={loading || !replyText.trim()}
                    className="absolute bottom-4 right-4 p-3 bg-white text-black rounded-xl hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
                  >
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 p-8 text-center">
              <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
                <Mail className="w-8 h-8 opacity-30" />
              </div>
              <p className="text-xl font-medium text-zinc-500 tracking-tight">No message selected</p>
              <p className="text-sm text-zinc-600 max-w-xs mt-3 font-light">Select a message from the list to view details and reply.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
