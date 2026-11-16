'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Shield, Sparkles, ArrowRight, Loader2, Monitor, UploadCloud, Link as LinkIcon, KeyRound, Plus } from 'lucide-react';
import { getApiBaseUrl, saveSessionToken } from '../lib/api';

export default function LandingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [displayName, setDisplayName] = useState('');
  const [roomTitle, setRoomTitle] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('');
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

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter a valid 6-digit room code');
      return;
    }
    if (!joinDisplayName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const serverUrl = getApiBaseUrl();
      const res = await fetch(`${serverUrl}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          joinCode: cleanCode,
          displayName: joinDisplayName.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to join room');
      }

      if (data.sessionToken) {
        saveSessionToken(data.slug, data.sessionToken);
      }
      router.push(`/room/${data.slug}`);
    } catch (err: any) {
      setError(err.message || 'Error joining room');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-white/[0.08] px-4 sm:px-8 py-3.5 flex items-center justify-between bg-[#111827]/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Dudu & Bubu Logo"
            className="w-10 h-10 rounded-2xl object-cover shadow-lg shadow-indigo-500/25 border border-white/20"
          />
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
            <span>Zero Signups · 6-Digit OTP or Link</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Watch movies with your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">
              two best friends
            </span>.
          </h2>

          <p className="text-gray-400 text-sm sm:text-base mb-8 max-w-xl leading-relaxed">
            A high-performance virtual theater built for intimate 3-person groups. Screen share, stream direct video URLs, or upload personal video files with real-time synchronized playback.
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
              <p className="text-[10px] text-gray-500">MP4 / MKV</p>
            </div>
          </div>
        </div>

        {/* Right Column: Room Creation & OTP Join Card */}
        <div className="lg:col-span-5 bg-[#111827]/70 border border-white/[0.1] rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-black/80">
          {/* Segmented Tab Switcher */}
          <div className="flex p-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('create');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Room</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('join');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'join'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>6-Digit Code</span>
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          {activeTab === 'create' ? (
            /* Create Room Form */
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
                  className="w-full bg-[#0B0F19] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
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
                  className="w-full bg-[#0B0F19] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
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
                    <span className="text-sm">Creating Room...</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">Open Cinema Room</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* 6-Digit OTP Join Form */
            <form onSubmit={handleJoinWithCode} className="space-y-4">
              <div>
                <label htmlFor="joinCode" className="block text-xs font-semibold text-gray-300 mb-1.5">
                  6-Digit Room Code (OTP) *
                </label>
                <input
                  id="joinCode"
                  type="text"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 583921"
                  className="w-full bg-[#0B0F19] border border-white/[0.1] rounded-xl px-4 py-3 text-lg font-mono font-bold tracking-widest text-center text-indigo-400 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="joinDisplayName" className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Your Display Name *
                </label>
                <input
                  id="joinDisplayName"
                  type="text"
                  required
                  maxLength={64}
                  value={joinDisplayName}
                  onChange={(e) => setJoinDisplayName(e.target.value)}
                  placeholder="e.g. Charlie"
                  className="w-full bg-[#0B0F19] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
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
                    <span className="text-sm">Joining Room...</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">Join with 6-Digit Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] px-4 py-5 text-center text-xs text-gray-500 bg-[#111827]/20 backdrop-blur-md">
        Dudu & Bubu · Up to 3 Participants · Watch Together
      </footer>
    </div>
  );
}
