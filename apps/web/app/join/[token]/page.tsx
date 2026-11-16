'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Film, Users, Shield, Lock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

interface RoomDetails {
  id: string;
  slug: string;
  title: string;
  isLocked: boolean;
  maxParticipants: number;
  activeParticipantsCount: number;
  isFull: boolean;
  expiresAt: string;
}

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isFetching, setIsFetching] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchRoom = async () => {
      try {
        const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${serverUrl}/api/rooms/invite/${token}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('This invitation link is invalid or has expired.');
          throw new Error('Failed to load room details.');
        }
        const data = await res.json();
        setRoom(data);
      } catch (err: any) {
        setError(err.message || 'Error loading invitation');
      } finally {
        setIsFetching(false);
      }
    };

    fetchRoom();
  }, [token]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${serverUrl}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          inviteToken: token,
          displayName: displayName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          throw new Error('This room has reached the maximum capacity of 3 participants.');
        }
        if (res.status === 403) {
          throw new Error('This room has been locked by the host.');
        }
        throw new Error(data.message || 'Failed to join room');
      }

      const data = await res.json();
      router.push(`/room/${data.slug}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join');
      setIsJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-cinema-950 flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-md bg-cinema-900 border border-cinema-800 rounded-2xl p-8 shadow-2xl shadow-black/60">
        {/* Header Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Film className="w-7 h-7" />
          </div>
        </div>

        {isFetching ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-sm">Verifying invitation...</p>
          </div>
        ) : error && !room ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Invitation Unavailable</h2>
            <p className="text-sm text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-cinema-800 hover:bg-cinema-700 text-white text-sm font-medium py-2.5 px-5 rounded-xl transition-colors"
            >
              Return to Home
            </button>
          </div>
        ) : room?.isLocked ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Room Locked</h2>
            <p className="text-sm text-gray-400 mb-6">The host has temporarily locked this room to new participants.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-cinema-800 hover:bg-cinema-700 text-white text-sm font-medium py-2.5 px-5 rounded-xl transition-colors"
            >
              Return to Home
            </button>
          </div>
        ) : room?.isFull ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Cinema Full</h2>
            <p className="text-sm text-gray-400 mb-6">This private room has already reached its strict 3-participant limit.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-cinema-800 hover:bg-cinema-700 text-white text-sm font-medium py-2.5 px-5 rounded-xl transition-colors"
            >
              Return to Home
            </button>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">{room?.title}</h2>
              <div className="inline-flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full mt-2">
                <Users className="w-3.5 h-3.5" />
                <span>{room?.activeParticipantsCount} of 3 Seats Filled</span>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label htmlFor="joinName" className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Enter Your Name
                </label>
                <input
                  id="joinName"
                  type="text"
                  required
                  maxLength={64}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Sam"
                  className="w-full bg-cinema-950 border border-cinema-700/60 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Entering Cinema...</span>
                  </>
                ) : (
                  <>
                    <span>Take a Seat</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
