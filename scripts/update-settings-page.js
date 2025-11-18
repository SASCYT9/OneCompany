const fs = require('fs');
const path = require('path');

const content = `'use client';

import { useState, useEffect } from 'react';
import { Bell, Volume2, Shield, Moon, Smartphone, Check } from 'lucide-react';

export default function SettingsPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('default');

  useEffect(() => {
    // Load saved preferences
    const savedSound = localStorage.getItem('adminSoundEnabled') === 'true';
    setSoundEnabled(savedSound);

    // Check notification permission
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      setNotificationsEnabled(permission === 'granted');
      
      if (permission === 'granted') {
        new Notification('OneCompany Admin', {
          body: 'Notifications enabled successfully!',
          icon: '/branding/logo.png' // Assuming this exists, or fallback
        });
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    }
  };

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('adminSoundEnabled', String(newState));
    
    if (newState) {
      // Play a test sound
      const audio = new Audio('/sounds/notification.mp3'); // We might need to add this file or use a data URI
      // Fallback beep if file doesn't exist
      // audio.play().catch(() => {});
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 text-white pb-20">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Settings</h1>
        <p className="text-zinc-500 font-light">Manage your application preferences and notifications.</p>
      </div>

      {/* Notifications Section */}
      <div className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-medium">Notifications</h2>
          </div>
          <p className="text-sm text-zinc-500 pl-[52px]">
            Receive alerts directly on your device when new messages arrive.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-zinc-200">Push Notifications</div>
              <div className="text-xs text-zinc-500 mt-1">Get notified even when the app is in background</div>
            </div>
            <button
              onClick={requestNotificationPermission}
              disabled={permissionStatus === 'granted'}
              className={\`px-4 py-2 rounded-lg text-sm font-medium transition-all \${
                permissionStatus === 'granted'
                  ? 'bg-green-500/10 text-green-400 cursor-default'
                  : 'bg-white text-black hover:bg-zinc-200'
              }\`}
            >
              {permissionStatus === 'granted' ? 'Enabled' : 'Enable'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-zinc-200">Sound Effects</div>
              <div className="text-xs text-zinc-500 mt-1">Play a sound when a new message arrives</div>
            </div>
            <button
              onClick={toggleSound}
              className={\`w-12 h-6 rounded-full transition-colors relative \${
                soundEnabled ? 'bg-blue-500' : 'bg-zinc-700'
              }\`}
            >
              <div className={\`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform \${
                soundEnabled ? 'translate-x-6' : 'translate-x-0'
              }\`} />
            </button>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-medium">Security</h2>
          </div>
          <p className="text-sm text-zinc-500 pl-[52px]">
            Manage your admin access and session.
          </p>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-zinc-200">Admin Session</div>
              <div className="text-xs text-zinc-500 mt-1">You are currently logged in as Admin</div>
            </div>
            <button
              onClick={() => {
                sessionStorage.removeItem('adminAuth');
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-zinc-900/30 rounded-xl border border-white/5">
          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Version</div>
          <div className="text-white font-mono text-sm">2.0.0 Premium</div>
        </div>
        <div className="p-4 bg-zinc-900/30 rounded-xl border border-white/5">
          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Status</div>
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            System Online
          </div>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(path.join(process.cwd(), 'src/app/admin/settings/page.tsx'), content);
console.log('File written successfully');
