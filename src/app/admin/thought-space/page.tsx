'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, Activity, ShieldCheck, Cpu } from 'lucide-react';

export default function ThoughtSpacePage() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchThoughts = async () => {
    try {
      const res = await fetch('/api/admin/thought-space');
      const data = await res.json();
      if (data.content) {
        setContent(data.content);
      }
    } catch (err) {
      console.error('Failed to fetch thoughts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThoughts();
    const interval = setInterval(fetchThoughts, 10000); // Оновлення кожні 10 сек
    return () => clearInterval(interval);
  }, []);

  // Парсинг Markdown (дуже базовий для преміального вигляду)
  const parseThoughts = (text: string) => {
    const sections = text.split('---');
    return sections.map((section, idx) => {
      if (!section.trim()) return null;

      const lines = section.trim().split('\n');
      const title = lines.find(l => l.startsWith('##'))?.replace('##', '').trim();
      const thoughts = lines.filter(l => l.startsWith('**')).map(l => {
        const [author, text] = l.split(':**');
        return { author: author.replace('**', '').trim(), text: text?.trim() };
      });

      return (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          {title && (
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-semibold">{title}</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          )}

          <div className="space-y-6">
            {thoughts.map((t, i) => (
              <div key={i} className="relative group">
                <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-indigo-500/20 group-hover:bg-indigo-500/50 transition-colors" />
                <div className="pl-4">
                  <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2 block">
                    {t.author}
                  </span>
                  <p className="text-zinc-300 leading-relaxed text-sm font-light">
                    {t.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      );
    });
  };

  return (
    <div className="min-h-full p-8 md:p-12 lg:p-16 max-w-5xl mx-auto">
      <header className="mb-16">
        <div className="flex items-center gap-3 mb-4 text-indigo-400">
          <Brain className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Hybrid Intelligence</span>
        </div>
        <h1 className="text-5xl font-light tracking-tight text-white mb-6">
          Thought <span className="text-indigo-500">Space</span>
        </h1>
        <p className="text-zinc-500 max-w-2xl text-lg font-light leading-relaxed">
          Живий потік роздумів AI, підключеного до бібліотеки Antigravity (1400+ скілів).
          Тут ви можете спостерігати за процесом прийняття рішень та стратегічним плануванням.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <StatusCard icon={<Sparkles className="text-amber-400" />} label="Knowledge Base" value="Antigravity 10.1" />
        <StatusCard icon={<Activity className="text-emerald-400" />} label="Agent State" value="Thinking..." />
        <StatusCard icon={<Cpu className="text-indigo-400" />} label="Integrated Skills" value="1,400+ Expert Sets" />
      </div>

      <div className="relative">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : (
          <div className="space-y-2">
            {parseThoughts(content)}
          </div>
        )}
      </div>

      <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-600">
        <span>OneCompany · AI Integration Portal</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Secure Engine</span>
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Feed</span>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">{label}</span>
      </div>
      <div className="text-xl font-medium text-white tracking-tight">{value}</div>
    </div>
  );
}
