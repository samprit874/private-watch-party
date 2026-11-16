'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Film,
  Users,
  Copy,
  Check,
  Share2,
  Monitor,
  StopCircle,
  Crown,
  UserCheck,
  UserPlus,
  Loader2,
  Radio,
  Sparkles
} from 'lucide-react';
import { VideoPlayer } from '../../../components/player/VideoPlayer';
import { WebRTCScreenPlayer } from '../../../components/player/WebRTCScreenPlayer';
import { useWebRTCScreenShare } from '../../../hooks/useWebRTCScreenShare';
import { getApiBaseUrl, getAuthHeaders } from '../../../lib/api';

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const rawInviteToken = searchParams?.get('invite');

  const [session, setSession] = useState<any>(null);
  const [dbParticipants, setDbParticipants] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isHost = session?.role === 'host' || session?.role === 'co-host';

  // 1. WebRTC Screen Share Hook & Live Socket Presence
  const {
    isSharing,
    isRemoteSharing,
    hasAudio,
    localStream,
    remoteStream,
    participants: liveSocketParticipants,
    startScreenShare,
    stopScreenShare,
  } = useWebRTCScreenShare({
    roomId: session?.room_id,
    slug,
    isHost,
  });

  // 2. Load Session Context
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const serverUrl = getApiBaseUrl();
        const headers = getAuthHeaders(slug);
        const res = await fetch(`${serverUrl}/api/rooms/session`, {
          headers,
          credentials: 'include',
        });

        if (!res.ok) {
          if (!rawInviteToken) {
            router.push('/');
            return;
          }
        } else {
          const data = await res.json();
          setSession(data);
        }
      } catch (err) {
        console.error('Session load error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [slug, rawInviteToken, router]);

  // 3. Database Participants Sync (Instant fallback)
  const fetchParticipants = useCallback(async () => {
    if (!slug) return;
    try {
      const serverUrl = getApiBaseUrl();
      const res = await fetch(`${serverUrl}/api/rooms/${slug}/participants`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.participants)) {
          setDbParticipants(data.participants);
        }
      }
    } catch (err) {
      // ignore transient network glitch
    }
  }, [slug]);

  useEffect(() => {
    fetchParticipants();
    const interval = setInterval(fetchParticipants, 3000);
    return () => clearInterval(interval);
  }, [fetchParticipants]);

  // 4. Unified Participant Deduplication
  const allKnownParticipants = useMemo(() => {
    const map = new Map<string, any>();

    // Add session host
    if (session) {
      map.set(session.user_id, {
        id: session.user_id,
        displayName: session.display_name,
        role: session.role || 'host',
        isConnected: true,
      });
    }

    // Add database participants
    dbParticipants.forEach((p) => {
      map.set(p.id, {
        id: p.id,
        displayName: p.displayName,
        role: p.role,
        isConnected: p.isConnected !== false,
      });
    });

    // Add live socket participants
    (liveSocketParticipants || []).forEach((p) => {
      if (p.id) {
        map.set(p.id, {
          id: p.id,
          displayName: p.displayName,
          role: p.role,
          isConnected: true,
        });
      }
    });

    return Array.from(map.values());
  }, [session, dbParticipants, liveSocketParticipants]);

  // Compute 3 Seats
  const hostUser = allKnownParticipants.find((p) => p.role === 'host') || (session ? {
    id: session.user_id,
    displayName: session.display_name,
    role: session.role,
    isConnected: true,
  } : null);

  const viewers = allKnownParticipants.filter((p) => p.id !== hostUser?.id);
  const seat2 = viewers[0] || null;
  const seat3 = viewers[1] || null;
  const totalOccupied = (hostUser ? 1 : 0) + (seat2 ? 1 : 0) + (seat3 ? 1 : 0);

  // 5. Mobile Native Share Sheet & Clipboard Copy
  const handleShareOrCopy = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = rawInviteToken
      ? `${origin}/join/${rawInviteToken}`
      : session?.invite_token
        ? `${origin}/join/${session.invite_token}`
        : `${origin}/join/${session?.room_id}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: session?.title || 'Private Watch Party',
          text: `Join my private 3-person cinema theater to watch together in perfect sync!`,
          url: inviteUrl,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium">Entering Virtual Cinema...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="h-16 border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between bg-[#111827]/60 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight truncate max-w-[140px] sm:max-w-xs md:max-w-md">
                {session?.title || 'Private Cinema'}
              </h1>
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-gray-400 font-mono border border-white/[0.06]">
                {slug}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Sync Online</span>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isHost && (
            <button
              onClick={isSharing ? stopScreenShare : startScreenShare}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95 ${
                isSharing
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
              }`}
            >
              {isSharing ? (
                <>
                  <StopCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Stop Share</span>
                </>
              ) : (
                <>
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share Screen</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleShareOrCopy}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] text-white transition-all shadow-sm active:scale-95"
            title="Share invite link"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Invite Friend</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Theater View */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-4">
        {/* Cinema Screen Stage */}
        <div className="w-full aspect-video max-h-[64vh] sm:max-h-[70vh] rounded-2xl bg-black border border-white/[0.08] overflow-hidden relative shadow-2xl flex flex-col justify-center items-center">
          {isSharing || isRemoteSharing || localStream || remoteStream ? (
            <WebRTCScreenPlayer
              localStream={localStream}
              remoteStream={remoteStream}
              isSharing={isSharing}
              hasAudio={hasAudio}
              isHost={isHost}
              onStopSharing={stopScreenShare}
            />
          ) : (
            <VideoPlayer
              roomId={session?.room_id}
              isHost={isHost}
            />
          )}
        </div>

        {/* 3-Seat Cinema Lounge */}
        <div className="bg-[#111827]/50 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-gray-400">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Cinema Lounge</span>
            </div>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {totalOccupied} / 3 Seats Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Seat 1: Host */}
            <div className="bg-white/[0.03] border border-indigo-500/30 rounded-xl p-3 flex items-center gap-3 relative overflow-hidden shadow-sm">
              <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30 relative">
                {hostUser?.displayName?.[0]?.toUpperCase() || 'H'}
                <Crown className="w-3.5 h-3.5 text-amber-300 absolute -top-1 -right-1 drop-shadow" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-white truncate">
                    {hostUser?.displayName || 'Host'}
                  </p>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                </div>
                <p className="text-[10px] text-indigo-300 font-medium uppercase tracking-wider">
                  Host & Streamer
                </p>
              </div>
            </div>

            {/* Seat 2: Friend 1 */}
            {seat2 ? (
              <div className="bg-white/[0.03] border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3 relative overflow-hidden shadow-sm">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-emerald-600/30">
                  {seat2.displayName?.[0]?.toUpperCase() || 'F'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white truncate">
                      {seat2.displayName}
                    </p>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  </div>
                  <p className="text-[10px] text-emerald-300 font-medium uppercase tracking-wider">
                    Viewer · Synchronized
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleShareOrCopy}
                className="bg-white/[0.01] hover:bg-white/[0.04] border border-dashed border-white/[0.15] hover:border-indigo-500/40 rounded-xl p-3 flex items-center gap-3 text-left transition-all group"
              >
                <div className="w-10 h-10 shrink-0 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-gray-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">
                    Seat 2 Available
                  </p>
                  <p className="text-[10px] text-gray-500 group-hover:text-indigo-400 transition-colors">
                    Tap to invite friend
                  </p>
                </div>
              </button>
            )}

            {/* Seat 3: Friend 2 */}
            {seat3 ? (
              <div className="bg-white/[0.03] border border-teal-500/30 rounded-xl p-3 flex items-center gap-3 relative overflow-hidden shadow-sm">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-tr from-cyan-600 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-cyan-600/30">
                  {seat3.displayName?.[0]?.toUpperCase() || 'F'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white truncate">
                      {seat3.displayName}
                    </p>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  </div>
                  <p className="text-[10px] text-teal-300 font-medium uppercase tracking-wider">
                    Viewer · Synchronized
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleShareOrCopy}
                className="bg-white/[0.01] hover:bg-white/[0.04] border border-dashed border-white/[0.15] hover:border-indigo-500/40 rounded-xl p-3 flex items-center gap-3 text-left transition-all group"
              >
                <div className="w-10 h-10 shrink-0 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-gray-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">
                    Seat 3 Available
                  </p>
                  <p className="text-[10px] text-gray-500 group-hover:text-indigo-400 transition-colors">
                    Tap to invite friend
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
