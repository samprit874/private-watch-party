'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Users, Shield, Sparkles, ArrowRight, Loader2, Monitor, UploadCloud, Link as LinkIcon } from 'lucide-react';
import { getApiBaseUrl, saveSessionToken } from '../lib/api';

export default function LandingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [roomTitle, setRoomTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const serverUrl = getApiBaseUrl();
      const res = await fetch(`${serverUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: displayName.trim(),
          title: roomTitle.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Failed to create room');
      }

      const data = await res.json();
      if (data.sessionToken) {
        saveSessionToken(data.slug, data.sessionToken);
      }
      router.push(`/room/${data.slug}?invite=${data.inviteToken}`);
    } catch (err: any) {
      setError(err.message || 'Error connecting to cinema server');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-white/[0.08] px-4 sm:px-8 py-4 flex items-center justify-between bg-[#111827]/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg text-white leading-tight">Dudu & Bubu</h1>
            <p className="text-[11px] text-gray-400">Cinema & Watch Party</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Encrypted & Private</span>
          <span className="sm:hidden">Private</span>
        </div>
      </header>

      {/* Hero & Card */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Headlines */}
        <div className="lg:col-span-7 flex flex-col items-start text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Zero Signups · Pure Real-time Sync</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Watch movies with your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">
              two best friends
            </span>.
          </h2>

          <p className="text-gray-400 text-sm sm:text-base mb-8 max-w-xl leading-relaxed">
            A high-performance virtual theater built for intimate 3-person groups. Screen share, stream direct video URLs, or upload personal video files with sub-50ms synchronized drift control.
          </p>

          {/* 3 Engines Badges */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-lg mb-4">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-2.5 sm:p-3 text-center">
              <Monitor className="w-4 h-4 text-indigo-400 mx-auto mb-1.5" />
              <p className="text-[11px] sm:text-xs font-semibold text-white">Screen Share</p>
              <p className="text-[10px] text-gray-500">Audio + Video</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-2.5 sm:p-3 text-center">
              <LinkIcon className="w-4 h-4 text-violet-400 mx-auto mb-1.5" />
              <p className="text-[11px] sm:text-xs font-semibold text-white">Direct URLs</p>
              <p className="text-[10px] text-gray-500">MP4 / HLS</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-2.5 sm:p-3 text-center">
              <UploadCloud className="w-4 h-4 text-emerald-400 mx-auto mb-1.5" />
              <p className="text-[11px] sm:text-xs font-semibold text-white">Video Uploads</p>
              <p className="text-[10px] text-gray-500">Instant Stream</p>
            </div>
          </div>
        </div>

        {/* Right Column: Room Creation Card */}
        <div className="lg:col-span-5 bg-[#111827]/70 border border-white/[0.1] rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-black/80">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">Create Cinema Room</h3>
          </div>
          <p className="text-xs text-gray-400 mb-6">Instant private link for you and 2 friends.</p>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-xs font-semibold text-gray-300 mb-1.5">
                Your Display Name *
              </label>
              <input
                id="displayName"
                type="text"
                required
                maxLength={64}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Samprit"
                className="w-full bg-[#0B0F19] border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="roomTitle" className="block text-xs font-semibold text-gray-300 mb-1.5">
                Room Title (Optional)
              </label>
              <input
                id="roomTitle"
                type="text"
                maxLength={128}
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="e.g. Friday Movie Night"
                className="w-full bg-[#0B0F19] border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Creating Cinema...</span>
                </>
              ) : (
                <>
                  <span className="text-sm">Open Cinema Theater</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] px-4 py-5 text-center text-xs text-gray-500 bg-[#111827]/20 backdrop-blur-md">
        Dudu & Bubu · Up to 3 Participants · Watch Together
      </footer>
    </div>
  );
}
