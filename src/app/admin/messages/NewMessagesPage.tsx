'use client';

import { useState, useEffect } from 'react';
import { Search, Send, Trash2, X, RefreshCw, Mail, Phone, MessageCircle } from 'lucide-react';

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
        updateStatus(selectedMessage.id, 'REPLIED');
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

  const filteredMessages = messages.filter(msg => {
    if (filter !== 'all' && msg.status !== filter) return false;
    if (searchQuery && !msg.messageText.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !msg.userName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-screen bg-zinc-900 text-white flex flex-col font-ua">
      {/* Header */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg lg:text-2xl font-semibold">Messages Dashboard</h1>
          <button
            onClick={() => { loadMessages(); loadStats(); }}
            className="flex items-center gap-2 px-3 py-1.5 lg:px-4 lg:py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden lg:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats - Scrollable on mobile */}
      <div className="flex gap-4 p-4 lg:p-6 bg-zinc-900 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible">
        <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 min-w-[140px]">
          <div className="text-zinc-400 text-xs lg:text-sm mb-1">Total</div>
          <div className="text-2xl lg:text-3xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 min-w-[140px]">
          <div className="text-zinc-400 text-xs lg:text-sm mb-1">New</div>
          <div className="text-2xl lg:text-3xl font-bold text-blue-400">{stats.new}</div>
        </div>
        <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 min-w-[140px]">
          <div className="text-zinc-400 text-xs lg:text-sm mb-1">Read</div>
          <div className="text-2xl lg:text-3xl font-bold text-purple-400">{stats.read}</div>
        </div>
        <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 min-w-[140px]">
          <div className="text-zinc-400 text-xs lg:text-sm mb-1">Replied</div>
          <div className="text-2xl lg:text-3xl font-bold text-green-400">{stats.replied}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid lg:grid-cols-[400px_1fr] gap-6 p-4 lg:p-6 overflow-hidden relative">
        {/* Messages List */}
        <div className={`bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col ${selectedMessage ? 'hidden lg:flex' : 'flex'} h-full`}>
          <div className="p-4 border-b border-zinc-800">
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
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {(['all', 'NEW', 'READ', 'REPLIED'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1 rounded text-xs font-medium transition whitespace-nowrap ${
                    filter === status
                      ? 'bg-white text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredMessages.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">No messages found</div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => {
                    setSelectedMessage(msg);
                    if (msg.status === 'NEW') updateStatus(msg.id, 'READ');
                  }}
                  className={`p-4 rounded-lg cursor-pointer transition ${
                    selectedMessage?.id === msg.id
                      ? 'bg-zinc-800 border-2 border-white'
                      : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold truncate pr-2">{msg.userName}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                      msg.status === 'NEW' ? 'bg-blue-500/20 text-blue-400' :
                      msg.status === 'READ' ? 'bg-purple-500/20 text-purple-400' :
                      msg.status === 'REPLIED' ? 'bg-green-500/20 text-green-400' :
                      'bg-zinc-700 text-zinc-400'
                    }`}>
                      {msg.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-2">{msg.messageText}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                    {msg.userPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {msg.userPhone}
                      </span>
                    )}
                    <span className="ml-auto">{new Date(msg.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Detail - Mobile Overlay / Desktop Column */}
        <div className={`bg-zinc-950 lg:rounded-xl lg:border border-zinc-800 flex flex-col fixed inset-0 z-50 lg:static lg:z-auto ${selectedMessage ? 'flex' : 'hidden lg:flex'}`}>
          {selectedMessage ? (
            <>
              <div className="p-4 lg:p-6 border-b border-zinc-800 bg-zinc-950">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedMessage(null)}
                        className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-white"
                      >
                        <X className="w-6 h-6" />
                      </button>
                      <div>
                        <h2 className="text-xl lg:text-2xl font-semibold">{selectedMessage.userName}</h2>
                        <div className="text-sm text-zinc-400 mt-1">{selectedMessage.userEmail}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteMessage(selectedMessage.id)}
                        className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSelectedMessage(null)}
                        className="hidden lg:block p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(['READ', 'REPLIED', 'ARCHIVED'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => updateStatus(selectedMessage.id, status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          selectedMessage.status === status
                            ? 'bg-white text-black'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1 text-sm text-zinc-400">
                    {selectedMessage.userPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {selectedMessage.userPhone}
                      </div>
                    )}
                    {selectedMessage.contactMethod && (
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Preferred: {selectedMessage.contactMethod}
                      </div>
                    )}
                  </div>

                  {selectedMessage.metadata && (
                    <div className="flex flex-wrap gap-3 text-sm bg-zinc-900 p-3 rounded-lg">
                      {selectedMessage.metadata.model && (
                        <span className="text-zinc-400">Model: <span className="text-white">{selectedMessage.metadata.model}</span></span>
                      )}
                      {selectedMessage.metadata.vin && (
                        <span className="text-zinc-400">VIN: <span className="text-white">{selectedMessage.metadata.vin}</span></span>
                      )}
                      {selectedMessage.metadata.budget && (
                        <span className="text-zinc-400">Budget: <span className="text-white">{selectedMessage.metadata.budget}</span></span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-zinc-950">
                <div className="prose prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-zinc-300 leading-relaxed text-base lg:text-lg">
                    {selectedMessage.messageText}
                  </p>
                </div>

                {selectedMessage.replies && selectedMessage.replies.length > 0 && (
                  <div className="mt-8 space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Reply History</h3>
                    {selectedMessage.replies.map((reply, index) => (
                      <div key={index} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap">{reply.replyText}</p>
                        <p className="text-xs text-zinc-500 mt-2">{new Date(reply.repliedAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 lg:p-6 border-t border-zinc-800 bg-zinc-950">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${selectedMessage.userName}...`}
                  className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 resize-none text-sm"
                  rows={3}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={sendReply}
                    disabled={loading || !replyText.trim()}
                    className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Send className="w-4 h-4" />
                    {loading ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a message</p>
                <p className="text-sm">Choose a message from the list to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
