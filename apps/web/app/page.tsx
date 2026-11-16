'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Users, Shield, Tv, Sparkles, ArrowRight, Loader2 } from 'lucide-react';

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
      const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
        throw new Error(data.message || 'Failed to create room');
      }

      const data = await res.json();
      // Redirect to the newly created room cinema shell
      router.push(`/room/${data.slug}?invite=${data.inviteToken}`);
    } catch (err: any) {
      setError(err.message || 'Error connecting to server');
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen">
      {/* Navigation Header */}
      <header className="border-b border-cinema-850 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-white leading-tight">Private Watch Party</h1>
            <p className="text-xs text-gray-400">Strict 3-Person Virtual Cinema</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-cinema-900 border border-cinema-800 px-3 py-1.5 rounded-full">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Private & Encrypted</span>
        </div>
      </header>

      {/* Main Hero & Form */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 md:py-20 grid md:grid-cols-2 gap-12 items-center">
        {/* Left Column: Value Prop */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reliable Playback · Zero Clutter</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Watch together in <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">perfect synchronization</span>.
          </h2>
          <p className="text-gray-400 text-base mb-8 leading-relaxed">
            A high-performance virtual theater built for you and two friends. Supporting screen sharing, direct video URLs, and personal video uploads with zero drift and multi-device support.
          </p>

          <div className="space-y-4 text-sm text-gray-300">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cinema-850 border border-cinema-800 flex items-center justify-center text-indigo-400">
                <Users className="w-4 h-4" />
              </div>
              <span><strong>Maximum 3 participants</strong> — Intimate, private, distraction-free</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cinema-850 border border-cinema-800 flex items-center justify-center text-indigo-400">
                <Film className="w-4 h-4" />
              </div>
              <span><strong>3 Media Engines</strong> — Screen share, Direct URLs & HLS uploads</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cinema-850 border border-cinema-800 flex items-center justify-center text-indigo-400">
                <Tv className="w-4 h-4" />
              </div>
              <span><strong>Smart TV Ready</strong> — Remote D-pad navigation receiver</span>
            </div>
          </div>
        </div>

        {/* Right Column: Instant Room Creation Card */}
        <div className="bg-cinema-900 border border-cinema-800/80 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <h3 className="text-xl font-bold text-white mb-2">Create a Private Room</h3>
          <p className="text-sm text-gray-400 mb-6">No account or signup required. Get an instant secure link.</p>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateRoom} className="space-y-5">
            <div>
              <label htmlFor="displayName" className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Your Display Name *
              </label>
              <input
                id="displayName"
                type="text"
                required
                maxLength={64}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-cinema-950 border border-cinema-700/60 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="roomTitle" className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Room Title (Optional)
              </label>
              <input
                id="roomTitle"
                type="text"
                maxLength={128}
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="e.g. Friday Movie Night"
                className="w-full bg-cinema-950 border border-cinema-700/60 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Private Cinema...</span>
                </>
              ) : (
                <>
                  <span>Create Cinema Room</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-cinema-850 px-6 py-6 text-center text-xs text-gray-500">
        Private Watch Party · Enforced 3-Participant Capacity · Self-Hosted Infrastructure
      </footer>
    </main>
  );
}
