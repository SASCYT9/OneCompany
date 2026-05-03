'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useId, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Images,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Palette,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import MessagesPanel from '@/components/admin/MessagesPanel';
import { defaultSiteContent } from '@/config/defaultSiteContent';
import type { SiteContent, BrandEntry, ProductCategory, ContactPageContent, ContactChannel, ContactSuccessStory } from '@/types/site-content';
import type { VideoConfig } from '@/lib/videoConfig';
import { defaultSiteMedia } from '@/config/defaultSiteMedia';
import type { SiteMedia, StoreId } from '@/types/site-media';

const defaultVideoConfig: VideoConfig = { heroVideo: 'hero-smoke.mp4', videos: [] };

const PANELS = [
  { id: 'content', label: 'Hero & Text', description: 'Hero badge, highlight stats, and CTA copy', icon: Wand2 },
  { id: 'media', label: 'Hero Video', description: 'Upload and switch homepage background video', icon: Video },
  { id: 'imagery', label: 'Visual Assets', description: 'Hero posters, showcases, and galleries', icon: Palette },
  { id: 'contact', label: 'Contact UX', description: 'Budgets, messengers, and success stories', icon: Check },
  { id: 'brands', label: 'Logos & Categories', description: 'Edit marquee brands, carousels, and product categories', icon: Images },
  { id: 'messages', label: 'Messages Inbox', description: 'Monitor and reply to incoming leads', icon: MessageSquare },
] as const;

const STORE_LABELS: Record<StoreId, { title: string; subtitle: string }> = {
  kw: {
    title: 'KW Suspension storefront',
    subtitle: 'Hero poster, showcase carousel, and catalog stack',
  },
  fi: {
    title: 'Fi Exhaust storefront',
    subtitle: 'Titanium systems, catalog cards, and media gallery',
  },
  eventuri: {
    title: 'Eventuri storefront',
    subtitle: 'Intake lab hero, showcase cards, and gallery',
  },
};

const STORE_ORDER: StoreId[] = ['kw', 'fi', 'eventuri'];

type PanelKey = (typeof PANELS)[number]['id'];
type SaveState = 'idle' | 'saving' | 'success' | 'error';

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPanel = (searchParams.get('panel') as PanelKey) ?? 'content';

  const [activePanel, setActivePanel] = useState<PanelKey>(initialPanel);
  const [authStatus, setAuthStatus] = useState<'checking' | 'unauthenticated' | 'authenticated'>('checking');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [videoConfig, setVideoConfig] = useState<VideoConfig>(defaultVideoConfig);
  const [selectedVideo, setSelectedVideo] = useState('hero-smoke.mp4');
  const [uploading, setUploading] = useState(false);
  const [videoStatus, setVideoStatus] = useState<SaveState>('idle');

  const [content, setContent] = useState<SiteContent>(defaultSiteContent);
  const [contentStatus, setContentStatus] = useState<SaveState>('idle');
  const [contentDirty, setContentDirty] = useState(false);
  const [mediaConfig, setMediaConfig] = useState<SiteMedia>(defaultSiteMedia);
  const [mediaStatus, setMediaStatus] = useState<SaveState>('idle');
  const [mediaDirty, setMediaDirty] = useState(false);

  useEffect(() => {
    const panel = searchParams.get('panel');
    if (panel && PANELS.some((item) => item.id === panel)) {
      setActivePanel(panel as PanelKey);
    }
  }, [searchParams]);

  const mutateContent = useCallback((updater: (prev: SiteContent) => SiteContent) => {
    setContent((prev) => updater(prev));
    setContentDirty(true);
  }, []);

  const mutateMedia = useCallback((updater: (prev: SiteMedia) => SiteMedia) => {
    setMediaConfig((prev) => updater(prev));
    setMediaDirty(true);
  }, []);

  const fetchVideoConfig = useCallback(async () => {
    const response = await fetch('/api/admin/video-config', { cache: 'no-store' });
    if (response.status === 401) {
      setAuthStatus('unauthenticated');
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      throw new Error('Failed to load video config');
    }
    const data = (await response.json()) as VideoConfig;
    setVideoConfig(data);
    setSelectedVideo(data.heroVideo);
  }, []);

  const fetchContent = useCallback(async () => {
    const response = await fetch('/api/admin/content', { cache: 'no-store' });
    if (response.status === 401) {
      setAuthStatus('unauthenticated');
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      throw new Error('Failed to load content');
    }
    const data = (await response.json()) as SiteContent;
    setContent(data);
    setContentDirty(false);
  }, []);

  const fetchMediaConfig = useCallback(async () => {
    const response = await fetch('/api/admin/site-media', { cache: 'no-store' });
    if (response.status === 401) {
      setAuthStatus('unauthenticated');
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      throw new Error('Failed to load site media');
    }
    const data = (await response.json()) as SiteMedia;
    setMediaConfig(data);
    setMediaDirty(false);
  }, []);

  const verifySession = useCallback(async () => {
    setAuthStatus('checking');
    try {
      const response = await fetch('/api/admin/auth', { cache: 'no-store' });
      if (response.ok) {
        setAuthStatus('authenticated');
        await Promise.all([fetchVideoConfig(), fetchContent(), fetchMediaConfig()]);
        setBootstrapped(true);
        return;
      }
    } catch (error) {
      console.error('Session verification failed', error);
    }
    setAuthStatus('unauthenticated');
    setBootstrapped(false);
  }, [fetchContent, fetchMediaConfig, fetchVideoConfig]);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginLoading(true);
    setAuthError('');
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (response.ok) {
        setPassword('');
        await verifySession();
      } else {
        setAuthStatus('unauthenticated');
        setAuthError(payload.error || 'Invalid password');
      }
    } catch {
      setAuthError('Failed to authenticate. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setAuthStatus('unauthenticated');
    setBootstrapped(false);
    setPassword('');
  };

  const handlePanelChange = (panel: PanelKey) => {
    setActivePanel(panel);
    const params = new URLSearchParams(searchParams.toString());
    params.set('panel', panel);
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };

  const handleVideoUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('video', file);
    try {
      const response = await fetch('/api/admin/upload-video', {
        method: 'POST',
        body: formData,
      });
      if (response.status === 401) {
        setAuthStatus('unauthenticated');
        return;
      }
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      const data = await response.json();
      setVideoConfig((prev) => ({
        heroVideo: prev.heroVideo,
        videos: Array.from(new Set([...prev.videos, data.filename])),
      }));
    } catch (error) {
      console.error('Video upload failed', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveHeroVideo = async () => {
    if (!selectedVideo) return;
    setVideoStatus('saving');
    try {
      const response = await fetch('/api/admin/video-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroVideo: selectedVideo }),
      });
      if (response.status === 401) {
        setAuthStatus('unauthenticated');
        setVideoStatus('error');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to save video');
      }
      const data = (await response.json()) as VideoConfig;
      setVideoConfig(data);
      setSelectedVideo(data.heroVideo);
      setVideoStatus('success');
    } catch (error) {
      console.error(error);
      setVideoStatus('error');
    } finally {
      setTimeout(() => setVideoStatus('idle'), 2500);
    }
  };

  const handleSaveContent = async () => {
    setContentStatus('saving');
    try {
      const response = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
      if (response.status === 401) {
        setAuthStatus('unauthenticated');
        setContentStatus('error');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to save content');
      }
      const data = (await response.json()) as SiteContent;
      setContent(data);
      setContentDirty(false);
      setContentStatus('success');
    } catch (error) {
      console.error(error);
      setContentStatus('error');
    } finally {
      setTimeout(() => setContentStatus('idle'), 2500);
    }
  };

  const handleSaveMedia = async () => {
    setMediaStatus('saving');
    try {
      const response = await fetch('/api/admin/site-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaConfig),
      });
      if (response.status === 401) {
        setAuthStatus('unauthenticated');
        setMediaStatus('error');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to save site media');
      }
      const data = (await response.json()) as SiteMedia;
      setMediaConfig(data);
      setMediaDirty(false);
      setMediaStatus('success');
    } catch (error) {
      console.error(error);
      setMediaStatus('error');
    } finally {
      setTimeout(() => setMediaStatus('idle'), 2500);
    }
  };

  const handleMediaUpload = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/media', {
        method: 'POST',
        body: formData,
      });
      if (response.status === 401) {
        setAuthStatus('unauthenticated');
  return null;
      }
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      const data = await response.json();
  return (data.item?.url as string) ?? null;
    } catch (error) {
      console.error('Media upload failed', error);
      alert('Не вдалося завантажити файл. Спробуйте ще раз.');
      return null;
    }
  };

  const allVideos = useMemo(() => {
    const unique = new Set([selectedVideo, videoConfig.heroVideo, 'hero-smoke.mp4', ...videoConfig.videos]);
    return Array.from(unique);
  }, [selectedVideo, videoConfig.heroVideo, videoConfig.videos]);

  if (authStatus === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-sm uppercase tracking-[0.5em] text-white/60">Checking access…</p>
      </div>
    );
  }

  if (authStatus !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-[#070707] to-[#0f0f0f] px-6 text-white">
        <motion.form
          onSubmit={handleLogin}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur"
        >
          <div className="mb-10 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/5">
              <Lock className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-light">onecompany admin</h1>
            <p className="mt-2 text-sm uppercase tracking-[0.4em] text-white/50">secure access</p>
          </div>
          <label className="block text-xs uppercase tracking-[0.4em] text-white/50">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-white focus:border-white/50 focus:outline-none"
            placeholder="Enter admin password"
            required
          />
          <AnimatePresence>
            {authError && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
              >
                {authError}
              </motion.p>
            )}
          </AnimatePresence>
          <button
            type="submit"
            disabled={loginLoading}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/90 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-black transition hover:bg-white disabled:opacity-50"
          >
            {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enter'}
          </button>
        </motion.form>
      </div>
    );
  }

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#050505] to-[#0f0f0f] text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-white/40">onecompany</p>
            <h1 className="text-2xl font-light">Admin workspace</h1>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/70 transition hover:border-white hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row">
            <nav className="w-full shrink-0 rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur lg:w-64">
              {PANELS.map((panel) => (
                <button
                  key={panel.id}
                  onClick={() => handlePanelChange(panel.id)}
                  className={`group flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    activePanel === panel.id
                      ? 'border-white/50 bg-white/10'
                      : 'border-transparent text-white/60 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <panel.icon className="mt-1 h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">{panel.label}</p>
                    <p className="text-xs text-white/40">{panel.description}</p>
                  </div>
                </button>
              ))}
            </nav>
        <main className="flex-1 rounded-3xl border border-white/10 bg-black/30 p-6 backdrop-blur">
          {activePanel === 'content' && (
            <ContentPanel
              content={content}
              dirty={contentDirty}
              status={contentStatus}
              onMutate={mutateContent}
              onSave={handleSaveContent}
            />
          )}
          {activePanel === 'media' && (
            <MediaPanel
              videoConfig={videoConfig}
              videos={allVideos}
              selectedVideo={selectedVideo}
              onSelectVideo={setSelectedVideo}
              onUpload={handleVideoUpload}
              uploading={uploading}
              onSave={handleSaveHeroVideo}
              status={videoStatus}
            />
          )}
          {activePanel === 'imagery' && (
            <ImageryPanel
              media={mediaConfig}
              dirty={mediaDirty}
              status={mediaStatus}
              onMutate={mutateMedia}
              onSave={handleSaveMedia}
              onUpload={handleMediaUpload}
            />
          )}
          {activePanel === 'contact' && (
            <ContactPanel
              contactContent={content.contactPage}
              dirty={contentDirty}
              status={contentStatus}
              onMutate={mutateContent}
              onSave={handleSaveContent}
            />
          )}
          {activePanel === 'brands' && (
            <BrandsPanel
              content={content}
              dirty={contentDirty}
              status={contentStatus}
              onMutate={mutateContent}
              onSave={handleSaveContent}
            />
          )}
          {activePanel === 'messages' && <MessagesPanel />}
        </main>
      </div>
    </div>
  );
}

type ContentPanelProps = {
  content: SiteContent;
  dirty: boolean;
  status: SaveState;
  onMutate: (updater: (prev: SiteContent) => SiteContent) => void;
  onSave: () => void;
};

type ContactPanelProps = {
  contactContent: ContactPageContent;
  dirty: boolean;
  status: SaveState;
  onMutate: (updater: (prev: SiteContent) => SiteContent) => void;
  onSave: () => void;
};

function ContentPanel({ content, dirty, status, onMutate, onSave }: ContentPanelProps) {
  return (
    <div className="space-y-10">
      <Section title="Hero microcopy" description="Update the hero badge and metadata lines.">
        <div className="grid gap-4 md:grid-cols-2">
          <LabeledInput
            label="Badge"
            value={content.hero.badge}
            onChange={(value) =>
              onMutate((prev) => ({ ...prev, hero: { ...prev.hero, badge: value } }))
            }
          />
          <LabeledInput
            label="Global presence"
            value={content.hero.globalPresence}
            onChange={(value) =>
              onMutate((prev) => ({ ...prev, hero: { ...prev.hero, globalPresence: value } }))
            }
          />
          <LabeledInput
            label="Brand promise"
            value={content.hero.brandPromise}
            onChange={(value) =>
              onMutate((prev) => ({ ...prev, hero: { ...prev.hero, brandPromise: value } }))
            }
          />
          <LabeledInput
            label="Atelier address"
            value={content.hero.atelierAddress}
            onChange={(value) =>
              onMutate((prev) => ({ ...prev, hero: { ...prev.hero, atelierAddress: value } }))
            }
          />
        </div>
      </Section>

      <Section title="Highlight stats" description="Numbers shown below the hero.">
        <div className="space-y-4">
          {content.statHighlights.map((stat, index) => (
            <div key={`${stat.label}-${index}`} className="flex flex-wrap gap-4 rounded-2xl border border-white/10 p-4">
              <LabeledInput
                label="Value"
                value={stat.value}
                onChange={(value) =>
                  onMutate((prev) => ({
                    ...prev,
                    statHighlights: prev.statHighlights.map((item, idx) =>
                      idx === index ? { ...item, value } : item
                    ),
                  }))
                }
              />
              <LabeledInput
                label="Label"
                value={stat.label}
                onChange={(value) =>
                  onMutate((prev) => ({
                    ...prev,
                    statHighlights: prev.statHighlights.map((item, idx) =>
                      idx === index ? { ...item, label: value } : item
                    ),
                  }))
                }
              />
              <button
                onClick={() =>
                  onMutate((prev) => ({
                    ...prev,
                    statHighlights: prev.statHighlights.filter((_, idx) => idx !== index),
                  }))
                }
                className="ml-auto rounded-full border border-white/20 p-2 text-white/50 hover:border-red-400 hover:text-red-300"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              onMutate((prev) => ({
                ...prev,
                statHighlights: [...prev.statHighlights, { value: '00', label: 'New stat' }],
              }))
            }
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-4 py-2 text-sm text-white/70"
          >
            <Plus className="h-4 w-4" />
            Add metric
          </button>
        </div>
      </Section>

      <Section title="Contact CTA" description="Controls the final section on the homepage.">
        <div className="grid gap-4 md:grid-cols-2">
          <LabeledInput
            label="Heading"
            value={content.contactCta.heading}
            onChange={(value) =>
              onMutate((prev) => ({ ...prev, contactCta: { ...prev.contactCta, heading: value } }))
            }
          />
          <LabeledInput
            label="Button label"
            value={content.contactCta.buttonLabel}
            onChange={(value) =>
              onMutate((prev) => ({ ...prev, contactCta: { ...prev.contactCta, buttonLabel: value } }))
            }
          />
          <LabeledInput
            label="Button href (without locale)"
            value={content.contactCta.buttonHref}
            onChange={(value) =>
              onMutate((prev) => ({ ...prev, contactCta: { ...prev.contactCta, buttonHref: value } }))
            }
          />
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-[0.4em] text-white/40">Body</label>
            <textarea
              value={content.contactCta.body}
              onChange={(event) =>
                onMutate((prev) => ({ ...prev, contactCta: { ...prev.contactCta, body: event.target.value } }))
              }
              rows={3}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-white/40 focus:outline-none"
            />
          </div>
        </div>
      </Section>

      <SaveBar dirty={dirty} status={status} onSave={onSave} />
    </div>
  );
}

function ContactPanel({ contactContent, dirty, status, onMutate, onSave }: ContactPanelProps) {
  const mutateContact = (updater: (prev: ContactPageContent) => ContactPageContent) => {
    onMutate((prev) => ({ ...prev, contactPage: updater(prev.contactPage) }));
  };

  const updateChannel = (index: number, key: keyof ContactChannel, value: string) => {
    mutateContact((prev) => ({
      ...prev,
      channels: prev.channels.map((channel, idx) => (idx === index ? { ...channel, [key]: value } : channel)),
    }));
  };

  const updateStory = (index: number, key: keyof ContactSuccessStory, value: string) => {
    mutateContact((prev) => ({
      ...prev,
      successStories: prev.successStories.map((story, idx) => (idx === index ? { ...story, [key]: value } : story)),
    }));
  };

  return (
    <div className="space-y-10">
      <Section title="Hero badge & microcopy" description="Controls the eyebrow, info body, timezone and SLA blocks on the contact page.">
        <div className="space-y-6">
          <LabeledInput
            label="Hero badge"
            value={contactContent.heroBadge}
            onChange={(value) => mutateContact((prev) => ({ ...prev, heroBadge: value }))}
          />
          <div>
            <label className="text-xs uppercase tracking-[0.4em] text-white/40">Info body</label>
            <textarea
              value={contactContent.infoBody}
              onChange={(event) => mutateContact((prev) => ({ ...prev, infoBody: event.target.value }))}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-white/40 focus:outline-none"
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <LabeledInput
              label="Timezone note"
              value={contactContent.timezoneNote}
              onChange={(value) => mutateContact((prev) => ({ ...prev, timezoneNote: value }))}
            />
            <LabeledInput
              label="SLA promise"
              value={contactContent.slaPromise}
              onChange={(value) => mutateContact((prev) => ({ ...prev, slaPromise: value }))}
            />
          </div>
          <LabeledInput
            label="Messenger tagline"
            value={contactContent.messengerTagline}
            onChange={(value) => mutateContact((prev) => ({ ...prev, messengerTagline: value }))}
          />
        </div>
      </Section>

      <Section title="Budget presets" description="Quick chips that pre-fill the budget field.">
        <div className="space-y-4">
          {contactContent.budgets.map((budget, index) => (
            <div key={`${budget}-${index}`} className="flex items-center gap-4 rounded-2xl border border-white/10 p-4">
              <input
                value={budget}
                onChange={(event) =>
                  mutateContact((prev) => ({
                    ...prev,
                    budgets: prev.budgets.map((item, idx) => (idx === index ? event.target.value : item)),
                  }))
                }
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
              />
              <button
                onClick={() =>
                  mutateContact((prev) => ({ ...prev, budgets: prev.budgets.filter((_, idx) => idx !== index) }))
                }
                className="rounded-full border border-white/10 p-2 text-white/50 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => mutateContact((prev) => ({ ...prev, budgets: [...prev.budgets, 'Новий бюджет'] }))}
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-4 py-2 text-sm text-white/70"
          >
            <Plus className="h-4 w-4" />
            Add preset
          </button>
        </div>
      </Section>

      <Section title="Preferred channels" description="Shown under the contact info stack with icons.">
        <div className="space-y-4">
          {contactContent.channels.map((channel, index) => (
            <div key={channel.id} className="space-y-3 rounded-2xl border border-white/10 p-4">
              <div className="flex items-center gap-4">
                <LabeledInput
                  label="Label"
                  value={channel.label}
                  onChange={(value) => updateChannel(index, 'label', value)}
                />
                <label className="text-xs uppercase tracking-[0.4em] text-white/40">
                  Type
                  <select
                    value={channel.type}
                    onChange={(event) => updateChannel(index, 'type', event.target.value as ContactChannel['type'])}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="telegram">Telegram</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <LabeledInput
                  label="Value"
                  value={channel.value}
                  onChange={(value) => updateChannel(index, 'value', value)}
                />
                <LabeledInput
                  label="Note"
                  value={channel.note}
                  onChange={(value) => updateChannel(index, 'note', value)}
                />
              </div>
              <button
                onClick={() =>
                  mutateContact((prev) => ({
                    ...prev,
                    channels: prev.channels.filter((_, idx) => idx !== index),
                  }))
                }
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-red-300/70"
              >
                Remove channel
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              mutateContact((prev) => ({
                ...prev,
                channels: [
                  ...prev.channels,
                  { id: `channel-${Date.now()}`, label: 'Новий канал', value: '', note: '', type: 'email' },
                ],
              }))
            }
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-4 py-2 text-sm text-white/70"
          >
            <Plus className="h-4 w-4" />
            Add channel
          </button>
        </div>
      </Section>

      <Section title="Messenger handles" description="CTA buttons under the form.">
        <div className="grid gap-4 md:grid-cols-3">
          <LabeledInput
            label="Telegram URL"
            value={contactContent.messengerHandles.telegram}
            onChange={(value) =>
              mutateContact((prev) => ({
                ...prev,
                messengerHandles: { ...prev.messengerHandles, telegram: value },
              }))
            }
          />
          <LabeledInput
            label="WhatsApp URL"
            value={contactContent.messengerHandles.whatsapp}
            onChange={(value) =>
              mutateContact((prev) => ({
                ...prev,
                messengerHandles: { ...prev.messengerHandles, whatsapp: value },
              }))
            }
          />
          <LabeledInput
            label="Concierge phone"
            value={contactContent.messengerHandles.phone}
            onChange={(value) =>
              mutateContact((prev) => ({
                ...prev,
                messengerHandles: { ...prev.messengerHandles, phone: value },
              }))
            }
          />
        </div>
      </Section>

      <Section title="Success stories" description="Cards displayed below the form to build trust.">
        <div className="space-y-4">
          {contactContent.successStories.map((story, index) => (
            <div key={story.id} className="space-y-4 rounded-2xl border border-white/10 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <LabeledInput label="Badge" value={story.badge} onChange={(value) => updateStory(index, 'badge', value)} />
                <LabeledInput label="Metric" value={story.metric} onChange={(value) => updateStory(index, 'metric', value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <LabeledInput label="Title" value={story.title} onChange={(value) => updateStory(index, 'title', value)} />
                <LabeledInput
                  label="Metric label"
                  value={story.metricLabel}
                  onChange={(value) => updateStory(index, 'metricLabel', value)}
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.4em] text-white/40">Summary</label>
                <textarea
                  value={story.summary}
                  onChange={(event) => updateStory(index, 'summary', event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-white/40 focus:outline-none"
                />
              </div>
              <button
                onClick={() =>
                  mutateContact((prev) => ({
                    ...prev,
                    successStories: prev.successStories.filter((_, idx) => idx !== index),
                  }))
                }
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-red-300/70"
              >
                Remove story
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              mutateContact((prev) => ({
                ...prev,
                successStories: [
                  ...prev.successStories,
                  {
                    id: `story-${Date.now()}`,
                    badge: 'New badge',
                    title: 'Новий кейс',
                    summary: '',
                    metric: '0',
                    metricLabel: 'metric',
                  },
                ],
              }))
            }
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-4 py-2 text-sm text-white/70"
          >
            <Plus className="h-4 w-4" />
            Add story
          </button>
        </div>
      </Section>

      <SaveBar dirty={dirty} status={status} onSave={onSave} />
    </div>
  );
}

type BrandsPanelProps = ContentPanelProps;

function BrandsPanel({ content, dirty, status, onMutate, onSave }: BrandsPanelProps) {
  const updateBrand = (section: 'automotive' | 'moto', index: number, key: keyof BrandEntry, value: string) => {
    onMutate((prev) => ({
      ...prev,
      brandSections: {
        ...prev.brandSections,
        [section]: prev.brandSections[section].map((entry, idx) =>
          idx === index ? { ...entry, [key]: value } : entry
        ),
      },
    }));
  };

  const removeBrand = (section: 'automotive' | 'moto', index: number) => {
    onMutate((prev) => ({
      ...prev,
      brandSections: {
        ...prev.brandSections,
        [section]: prev.brandSections[section].filter((_, idx) => idx !== index),
      },
    }));
  };

  const addBrand = (section: 'automotive' | 'moto') => {
    onMutate((prev) => ({
      ...prev,
      brandSections: {
        ...prev.brandSections,
        [section]: [...prev.brandSections[section], { name: 'New brand', logo: '/logos/example.png' }],
      },
    }));
  };

  const updateCategory = (index: number, patch: Partial<ProductCategory>) => {
    onMutate((prev) => ({
      ...prev,
      productCategories: prev.productCategories.map((category, idx) =>
        idx === index ? { ...category, ...patch } : category
      ),
    }));
  };

  const removeCategory = (index: number) => {
    onMutate((prev) => ({
      ...prev,
      productCategories: prev.productCategories.filter((_, idx) => idx !== index),
    }));
  };

  return (
    <div className="space-y-10">
      <Section title="Marquee brands" description="Displayed in the brands grid section.">
        <textarea
          value={content.marqueeBrands.join('\n')}
          onChange={(event) =>
            onMutate((prev) => ({
              ...prev,
              marqueeBrands: event.target.value
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean),
            }))
          }
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-white/40 focus:outline-none"
          placeholder="One brand per line"
        />
      </Section>

      <Section title="Automotive logos" description="Enter public/logo paths (e.g. /logos/brand.png).">
        <BrandGrid
          entries={content.brandSections.automotive}
          onChange={(index, key, value) => updateBrand('automotive', index, key, value)}
          onRemove={(index) => removeBrand('automotive', index)}
          onAdd={() => addBrand('automotive')}
        />
      </Section>

      <Section title="Moto logos" description="Rendered in the motorcycle carousel.">
        <BrandGrid
          entries={content.brandSections.moto}
          onChange={(index, key, value) => updateBrand('moto', index, key, value)}
          onRemove={(index) => removeBrand('moto', index)}
          onAdd={() => addBrand('moto')}
        />
      </Section>

      <Section title="Product categories" description="Cards shown in the categories grid.">
        <div className="space-y-4">
          {content.productCategories.map((category, index) => (
            <div key={`${category.name}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-4">
                <LabeledInput
                  label="Name"
                  value={category.name}
                  onChange={(value) => updateCategory(index, { name: value })}
                />
                <button
                  onClick={() => removeCategory(index)}
                  className="ml-auto rounded-full border border-white/20 p-2 text-white/60 hover:border-red-400 hover:text-red-300"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={category.description}
                onChange={(event) => updateCategory(index, { description: event.target.value })}
                rows={2}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white focus:border-white/40 focus:outline-none"
              />
            </div>
          ))}
          <button
            onClick={() =>
              onMutate((prev) => ({
                ...prev,
                productCategories: [
                  ...prev.productCategories,
                  { name: 'New category', description: 'Description' },
                ],
              }))
            }
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-4 py-2 text-sm text-white/70"
          >
            <Plus className="h-4 w-4" />
            Add category
          </button>
        </div>
      </Section>

      <SaveBar dirty={dirty} status={status} onSave={onSave} />
    </div>
  );
}

type MediaPanelProps = {
  videoConfig: VideoConfig;
  videos: string[];
  selectedVideo: string;
  onSelectVideo: (filename: string) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  onSave: () => void;
  status: SaveState;
};

function MediaPanel({ videoConfig, videos, selectedVideo, onSelectVideo, onUpload, uploading, onSave, status }: MediaPanelProps) {
  return (
    <div className="space-y-10">
      <Section title="Hero video" description="Current asset powering the homepage background.">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
          <div className="aspect-video overflow-hidden rounded-2xl border border-white/10">
            <video src={`/videos/${videoConfig.heroVideo}`} autoPlay muted loop className="h-full w-full object-cover" />
          </div>
          <p className="mt-3 text-sm text-white/60">{videoConfig.heroVideo}</p>
        </div>
      </Section>

      <Section title="Library" description="Select which video becomes the hero.">
        <div className="grid gap-4 md:grid-cols-2">
          {videos.map((video) => (
            <button
              key={video}
              onClick={() => onSelectVideo(video)}
              className={`overflow-hidden rounded-2xl border transition ${
                selectedVideo === video ? 'border-white bg-white/10' : 'border-white/10 bg-white/5 hover:border-white/40'
              }`}
            >
              <div className="aspect-video">
                <video src={`/videos/${video}`} muted loop className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="truncate">{video}</span>
                {selectedVideo === video && <Check className="h-4 w-4" />}
              </div>
            </button>
          ))}
        </div>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
          }}
          className="hidden"
          id="video-upload"
        />
        <label
          htmlFor="video-upload"
          className="mt-4 flex h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 text-sm text-white/60"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Upload className="mb-2 h-5 w-5" />
              Upload new video
            </>
          )}
        </label>
      </Section>

      <button
        onClick={onSave}
        disabled={status === 'saving' || selectedVideo === videoConfig.heroVideo}
        className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-black transition disabled:opacity-40"
      >
        {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save hero video
      </button>
      {status === 'success' && <p className="text-sm text-green-400">Video updated</p>}
      {status === 'error' && <p className="text-sm text-red-400">Failed to save video</p>}
    </div>
  );
}

type ImageryPanelProps = {
  media: SiteMedia;
  dirty: boolean;
  status: SaveState;
  onMutate: (updater: (prev: SiteMedia) => SiteMedia) => void;
  onSave: () => void;
  onUpload: (file: File) => Promise<string | null>;
};

type StoreSection = SiteMedia['stores'][StoreId];

function ImageryPanel({ media, dirty, status, onMutate, onSave, onUpload }: ImageryPanelProps) {
  const updateHeroPoster = (key: 'auto' | 'moto', value: string) => {
    onMutate((prev) => ({
      ...prev,
      heroPosters: {
        ...prev.heroPosters,
        [key]: value,
      },
    }));
  };

  const updateStore = (storeId: StoreId, updater: (section: StoreSection) => StoreSection) => {
    onMutate((prev) => ({
      ...prev,
      stores: {
        ...prev.stores,
        [storeId]: updater(prev.stores[storeId]),
      },
    }));
  };

  const addShowcaseCard = (storeId: StoreId) => {
    updateStore(storeId, (section) => ({
      ...section,
      brandShowcase: [
        ...section.brandShowcase,
        {
          id: generateId('showcase'),
          name: 'New product',
          description: 'Short description',
          image: '/images/placeholder.jpg',
          specs: ['Spec A', 'Spec B'],
        },
      ],
    }));
  };

  const updateShowcaseCard = (storeId: StoreId, index: number, patch: Partial<StoreSection['brandShowcase'][number]>) => {
    updateStore(storeId, (section) => ({
      ...section,
      brandShowcase: section.brandShowcase.map((card, idx) => (idx === index ? { ...card, ...patch } : card)),
    }));
  };

  const removeShowcaseCard = (storeId: StoreId, index: number) => {
    updateStore(storeId, (section) => ({
      ...section,
      brandShowcase: section.brandShowcase.filter((_, idx) => idx !== index),
    }));
  };

  const addCatalogCard = (storeId: StoreId) => {
    updateStore(storeId, (section) => ({
      ...section,
      catalogProducts: [
        ...section.catalogProducts,
        {
          id: generateId('catalog'),
          name: 'New catalog product',
          description: 'Add a compelling description',
          image: '/images/placeholder.jpg',
          specs: [],
          features: [],
        },
      ],
    }));
  };

  const updateCatalogCard = (storeId: StoreId, index: number, patch: Partial<StoreSection['catalogProducts'][number]>) => {
    updateStore(storeId, (section) => ({
      ...section,
      catalogProducts: section.catalogProducts.map((card, idx) => (idx === index ? { ...card, ...patch } : card)),
    }));
  };

  const removeCatalogCard = (storeId: StoreId, index: number) => {
    updateStore(storeId, (section) => ({
      ...section,
      catalogProducts: section.catalogProducts.filter((_, idx) => idx !== index),
    }));
  };

  const addGalleryItem = (storeId: StoreId) => {
    updateStore(storeId, (section) => ({
      ...section,
      gallery: [
        ...section.gallery,
        {
          id: generateId('gallery'),
          image: '/images/placeholder.jpg',
          caption: 'New highlight',
        },
      ],
    }));
  };

  const updateGalleryItem = (storeId: StoreId, index: number, patch: Partial<StoreSection['gallery'][number]>) => {
    updateStore(storeId, (section) => ({
      ...section,
      gallery: section.gallery.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    }));
  };

  const removeGalleryItem = (storeId: StoreId, index: number) => {
    updateStore(storeId, (section) => ({
      ...section,
      gallery: section.gallery.filter((_, idx) => idx !== index),
    }));
  };

  const handleUpload = async (file: File, onSuccess: (url: string) => void) => {
    const url = await onUpload(file);
    if (url) {
      onSuccess(url);
    }
  };

  return (
    <div className="space-y-10">
      <Section
        title="Hero posters"
        description="Large imagery shown behind the automotive and moto navigation split. Upload JPG/WebP at least 2000px wide."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {(['auto', 'moto'] as const).map((key) => (
            <div key={key} className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {key === 'auto' ? 'Automotive' : 'Moto'} hero poster
                  </p>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">/public{media.heroPosters[key]}</p>
                </div>
              </div>
              <ImageField
                label="Image path"
                value={media.heroPosters[key]}
                onChange={(value) => updateHeroPoster(key, value)}
                onUpload={(file) => handleUpload(file, (url) => updateHeroPoster(key, url))}
              />
            </div>
          ))}
        </div>
      </Section>

      {STORE_ORDER.map((storeId) => {
        const section = media.stores[storeId];
        const meta = STORE_LABELS[storeId];
        return (
          <Section key={storeId} title={meta.title} description={meta.subtitle}>
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Hero poster</p>
                </div>
                <ImageField
                  label="Backdrop image"
                  value={section.heroPoster}
                  onChange={(value) =>
                    updateStore(storeId, (prev) => ({
                      ...prev,
                      heroPoster: value,
                    }))
                  }
                  onUpload={(file) => handleUpload(file, (url) =>
                    updateStore(storeId, (prev) => ({
                      ...prev,
                      heroPoster: url,
                    }))
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Brand showcase cards</p>
                  <button
                    onClick={() => addShowcaseCard(storeId)}
                    className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70"
                  >
                    <Plus className="h-3 w-3" /> Add card
                  </button>
                </div>
                <div className="space-y-4">
                  {section.brandShowcase.map((card, index) => (
                    <div key={card.id} className="rounded-3xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-white/80">Showcase #{index + 1}</p>
                        <button
                          onClick={() => removeShowcaseCard(storeId, index)}
                          className="ml-auto rounded-full border border-white/20 p-2 text-white/50 hover:border-red-400 hover:text-red-300"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <LabeledInput
                          label="Name"
                          value={card.name}
                          onChange={(value) => updateShowcaseCard(storeId, index, { name: value })}
                        />
                        <ImageField
                          label="Image"
                          value={card.image}
                          onChange={(value) => updateShowcaseCard(storeId, index, { image: value })}
                          onUpload={(file) => handleUpload(file, (url) => updateShowcaseCard(storeId, index, { image: url }))}
                        />
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="text-xs uppercase tracking-[0.4em] text-white/40">
                          Description
                          <textarea
                            value={card.description}
                            onChange={(event) => updateShowcaseCard(storeId, index, { description: event.target.value })}
                            rows={3}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white focus:border-white/40 focus:outline-none"
                          />
                        </label>
                        <label className="text-xs uppercase tracking-[0.4em] text-white/40">
                          Specs (one per line)
                          <textarea
                            value={card.specs.join('\n')}
                            onChange={(event) =>
                              updateShowcaseCard(storeId, index, {
                                specs: event.target.value
                                  .split('\n')
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                            rows={3}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white focus:border-white/40 focus:outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  {section.brandShowcase.length === 0 && (
                    <p className="text-sm text-white/50">No showcase cards yet. Add one to highlight hero SKUs.</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Catalog stack</p>
                  <button
                    onClick={() => addCatalogCard(storeId)}
                    className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70"
                  >
                    <Plus className="h-3 w-3" /> Add product
                  </button>
                </div>
                <div className="space-y-4">
                  {section.catalogProducts.map((product, index) => (
                    <div key={product.id} className="rounded-3xl border border-white/10 bg-black/50 p-4">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-white/80">Product #{index + 1}</p>
                        <button
                          onClick={() => removeCatalogCard(storeId, index)}
                          className="ml-auto rounded-full border border-white/20 p-2 text-white/50 hover:border-red-400 hover:text-red-300"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <LabeledInput
                          label="Name"
                          value={product.name}
                          onChange={(value) => updateCatalogCard(storeId, index, { name: value })}
                        />
                        <LabeledInput
                          label="Series"
                          value={product.series ?? ''}
                          onChange={(value) => updateCatalogCard(storeId, index, { series: value })}
                        />
                        <LabeledInput
                          label="Price"
                          value={product.price ?? ''}
                          onChange={(value) => updateCatalogCard(storeId, index, { price: value })}
                        />
                        <LabeledInput
                          label="Compatibility"
                          value={product.compatibility ?? ''}
                          onChange={(value) => updateCatalogCard(storeId, index, { compatibility: value })}
                        />
                        <ImageField
                          label="Image"
                          value={product.image}
                          onChange={(value) => updateCatalogCard(storeId, index, { image: value })}
                          onUpload={(file) => handleUpload(file, (url) => updateCatalogCard(storeId, index, { image: url }))}
                        />
                      </div>
                      <label className="mt-4 block text-xs uppercase tracking-[0.4em] text-white/40">
                        Description
                        <textarea
                          value={product.description}
                          onChange={(event) => updateCatalogCard(storeId, index, { description: event.target.value })}
                          rows={3}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white focus:border-white/40 focus:outline-none"
                        />
                      </label>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="text-xs uppercase tracking-[0.4em] text-white/40">
                          Features (one per line)
                          <textarea
                            value={(product.features ?? []).join('\n')}
                            onChange={(event) =>
                              updateCatalogCard(storeId, index, {
                                features: event.target.value
                                  .split('\n')
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                            rows={3}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white focus:border-white/40 focus:outline-none"
                          />
                        </label>
                        <label className="text-xs uppercase tracking-[0.4em] text-white/40">
                          Specs (one per line)
                          <textarea
                            value={product.specs.join('\n')}
                            onChange={(event) =>
                              updateCatalogCard(storeId, index, {
                                specs: event.target.value
                                  .split('\n')
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                            rows={3}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white focus:border-white/40 focus:outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  {section.catalogProducts.length === 0 && (
                    <p className="text-sm text-white/50">No catalog products configured. Use them to power comparison decks.</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Gallery</p>
                  <button
                    onClick={() => addGalleryItem(storeId)}
                    className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70"
                  >
                    <Plus className="h-3 w-3" /> Add frame
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {section.gallery.map((item, index) => (
                    <div key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-white/80">Frame #{index + 1}</p>
                        <button
                          onClick={() => removeGalleryItem(storeId, index)}
                          className="ml-auto rounded-full border border-white/20 p-2 text-white/50 hover:border-red-400 hover:text-red-300"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <ImageField
                        label="Image"
                        value={item.image}
                        onChange={(value) => updateGalleryItem(storeId, index, { image: value })}
                        onUpload={(file) => handleUpload(file, (url) => updateGalleryItem(storeId, index, { image: url }))}
                      />
                      <LabeledInput
                        label="Caption"
                        value={item.caption ?? ''}
                        onChange={(value) => updateGalleryItem(storeId, index, { caption: value })}
                      />
                    </div>
                  ))}
                  {section.gallery.length === 0 && (
                    <p className="text-sm text-white/50">No gallery items. Add lifestyle or install imagery here.</p>
                  )}
                </div>
              </div>
            </div>
          </Section>
        );
      })}

      <SaveBar dirty={dirty} status={status} onSave={onSave} />
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="text-sm text-white/50">{description}</p>
      </div>
      {children}
    </section>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs uppercase tracking-[0.4em] text-white/40">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
      />
    </label>
  );
}

function ImageField({
  label,
  value,
  onChange,
  onUpload,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onUpload?: (file: File) => void;
}) {
  const inputId = useId();

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-[0.4em] text-white/40">{label}</label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
          placeholder="/images/..."
        />
        {onUpload && (
          <>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.target.value = '';
              }}
            />
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center rounded-2xl border border-white/20 px-3 py-2 text-xs uppercase tracking-[0.3em] text-white/70 hover:border-white hover:text-white"
            >
              Upload
            </label>
          </>
        )}
      </div>
      {value && (
        <div className="h-36 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <Image src={value} alt={`${label} preview`} width={640} height={256} className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}

function generateId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function SaveBar({ dirty, status, onSave }: { dirty: boolean; status: SaveState; onSave: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <button
        onClick={onSave}
        disabled={!dirty || status === 'saving'}
        className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-black transition disabled:opacity-40"
      >
        {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save content
      </button>
      {status === 'success' && <p className="text-sm text-green-400">Content saved</p>}
      {status === 'error' && <p className="text-sm text-red-400">Failed to save</p>}
      {!dirty && status === 'idle' && <p className="text-sm text-white/40">No unsaved changes</p>}
    </div>
  );
}

function BrandGrid({
  entries,
  onChange,
  onRemove,
  onAdd,
}: {
  entries: BrandEntry[];
  onChange: (index: number, key: keyof BrandEntry, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <div key={`${entry.name}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <LabeledInput label="Name" value={entry.name} onChange={(value) => onChange(index, 'name', value)} />
            <LabeledInput label="Logo path" value={entry.logo} onChange={(value) => onChange(index, 'logo', value)} />
            <button
              onClick={() => onRemove(index)}
              className="h-11 rounded-full border border-white/20 text-sm text-white/60 transition hover:border-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-4 py-2 text-sm text-white/70"
      >
        <Plus className="h-4 w-4" />
        Add brand
      </button>
    </div>
  );
}

function AdminPageFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-white">
      <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      <p className="text-sm uppercase tracking-[0.4em] text-white/50">Loading admin dashboard</p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="admin-font">
      <Suspense fallback={<AdminPageFallback />}>
        <AdminPageContent />
      </Suspense>
    </div>
  );
}
