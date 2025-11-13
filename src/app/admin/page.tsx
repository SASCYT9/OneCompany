'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, LogOut, Video, Upload, Check, X } from 'lucide-react';

interface VideoConfig {
  heroVideo: string;
  videos: string[];
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [videoConfig, setVideoConfig] = useState<VideoConfig>({ heroVideo: 'hero-smoke.mp4', videos: [] });
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    const isAuth = sessionStorage.getItem('adminAuth') === 'true';
    setIsAuthenticated(isAuth);
    
    if (isAuth) {
      loadVideoConfig();
    }
  }, []);

  const loadVideoConfig = async () => {
    try {
      const response = await fetch('/api/admin/video-config');
      if (response.ok) {
        const data = await response.json();
        setVideoConfig(data);
        setSelectedVideo(data.heroVideo);
      }
    } catch (err) {
      console.error('Failed to load video config:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        sessionStorage.setItem('adminAuth', 'true');
        setIsAuthenticated(true);
        loadVideoConfig();
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch (err) {
      setError('Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
    setPassword('');
  };

  const handleVideoSelect = (video: string) => {
    setSelectedVideo(video);
  };

  const handleSaveConfig = async () => {
    setSaveStatus('saving');
    
    try {
      const response = await fetch('/api/admin/video-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroVideo: selectedVideo }),
      });

      if (response.ok) {
        setSaveStatus('success');
        setVideoConfig(prev => ({ ...prev, heroVideo: selectedVideo }));
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please upload a video file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch('/api/admin/upload-video', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setVideoConfig(prev => ({
          ...prev,
          videos: [...prev.videos, data.filename],
        }));
        alert('Video uploaded successfully!');
      } else {
        alert('Failed to upload video');
      }
    } catch (err) {
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-100 dark:bg-zinc-900/50 mb-6">
              <Lock className="w-8 h-8 text-zinc-900 dark:text-white" />
            </div>
            <h1 className="text-4xl font-extralight tracking-tight text-zinc-900 dark:text-white mb-4">
              Admin Access
            </h1>
            <p className="text-sm font-light text-zinc-600 dark:text-white/50">
              Enter your password to continue
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-xs uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-3 font-light">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-0 py-3 bg-transparent border-b border-zinc-300 dark:border-white/20 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors font-light"
                placeholder="Enter admin password"
                required
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm font-light"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black text-sm uppercase tracking-widest font-light hover:bg-zinc-800 dark:hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="border-b border-zinc-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extralight tracking-tight text-zinc-900 dark:text-white">
              Admin Panel
            </h1>
            <motion.button
              onClick={handleLogout}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-900/50 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors text-sm font-light"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <Video className="w-6 h-6 text-zinc-900 dark:text-white" />
              <h2 className="text-3xl font-light tracking-wide text-zinc-900 dark:text-white">
                Hero Video Management
              </h2>
            </div>
            <div className="w-24 h-px bg-zinc-300 dark:bg-white/20 mb-8" />
          </div>

          <div className="mb-12">
            <h3 className="text-sm uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-6 font-light">
              Current Hero Video
            </h3>
            <div className="aspect-video bg-zinc-100 dark:bg-zinc-900/50 relative overflow-hidden mb-4">
              <video
                src={`/videos/${videoConfig.heroVideo}`}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
              />
            </div>
            <p className="text-sm font-light text-zinc-600 dark:text-white/50">
              {videoConfig.heroVideo}
            </p>
          </div>

          <div className="mb-12">
            <h3 className="text-sm uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-6 font-light">
              Available Videos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {['hero-smoke.mp4', ...videoConfig.videos].map((video) => (
                <motion.div
                  key={video}
                  onClick={() => handleVideoSelect(video)}
                  whileHover={{ y: -4 }}
                  className={`cursor-pointer border-2 transition-all duration-300 ${
                    selectedVideo === video
                      ? 'border-black dark:border-white shadow-xl'
                      : 'border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/30'
                  }`}
                >
                  <div className="aspect-video bg-zinc-100 dark:bg-zinc-900/50 relative overflow-hidden">
                    <video
                      src={`/videos/${video}`}
                      className="w-full h-full object-cover"
                      muted
                    />
                    {selectedVideo === video && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-12 h-12 bg-white dark:bg-black rounded-full flex items-center justify-center">
                          <Check className="w-6 h-6 text-black dark:text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-white/10">
                    <p className="text-sm font-light text-zinc-900 dark:text-white truncate">
                      {video}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mb-12">
            <h3 className="text-sm uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-6 font-light">
              Upload New Video
            </h3>
            <label className="block">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <motion.div
                whileHover={{ scale: uploading ? 1 : 1.02 }}
                whileTap={{ scale: uploading ? 1 : 0.98 }}
                className="border-2 border-dashed border-zinc-300 dark:border-white/20 hover:border-zinc-400 dark:hover:border-white/30 transition-colors p-12 text-center cursor-pointer"
              >
                <Upload className="w-12 h-12 text-zinc-400 dark:text-white/30 mx-auto mb-4" />
                <p className="text-sm font-light text-zinc-600 dark:text-white/50 mb-2">
                  {uploading ? 'Uploading...' : 'Click to upload video'}
                </p>
                <p className="text-xs font-light text-zinc-400 dark:text-white/30">
                  MP4, WebM, or other video formats
                </p>
              </motion.div>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <motion.button
              onClick={handleSaveConfig}
              disabled={saveStatus === 'saving' || selectedVideo === videoConfig.heroVideo}
              whileHover={{ scale: saveStatus === 'saving' ? 1 : 1.02 }}
              whileTap={{ scale: saveStatus === 'saving' ? 1 : 0.98 }}
              className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black text-sm uppercase tracking-widest font-light hover:bg-zinc-800 dark:hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
            </motion.button>

            <AnimatePresence>
              {saveStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2 text-green-600 dark:text-green-400"
                >
                  <Check className="w-5 h-5" />
                  <span className="text-sm font-light">Changes saved successfully</span>
                </motion.div>
              )}
              {saveStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2 text-red-600 dark:text-red-400"
                >
                  <X className="w-5 h-5" />
                  <span className="text-sm font-light">Failed to save changes</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
