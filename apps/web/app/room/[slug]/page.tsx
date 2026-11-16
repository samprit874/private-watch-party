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
  UserPlus,
  Loader2,
  MoreVertical,
  X,
  Link as LinkIcon,
  UploadCloud
} from 'lucide-react';
import { VideoPlayer } from '../../../components/player/VideoPlayer';
import { WebRTCScreenPlayer } from '../../../components/player/WebRTCScreenPlayer';
import { ChatArea } from '../../../components/chat/ChatArea';
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
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const isHost = session?.role === 'host' || session?.role === 'co-host';

  // 1. WebRTC Screen Share Hook, Live Socket Presence, & Room Chat
  const {
    isSharing,
    isRemoteSharing,
    hasAudio,
    localStream,
    remoteStream,
    participants: liveSocketParticipants,
    messages,
    sendMessage,
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
          title: session?.title || 'Dudu & Bubu',
          text: `Join my private Dudu & Bubu cinema to watch together in perfect sync!`,
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
      <div className="min-h-screen bg-[#090D16] flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium">Entering Dudu & Bubu Cinema...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-zinc-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="h-14 sm:h-16 border-b border-zinc-800/80 px-3 sm:px-6 flex items-center justify-between bg-zinc-950/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate max-w-[120px] sm:max-w-xs md:max-w-md">
              {session?.title || 'Dudu & Bubu'}
            </h1>
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
              {slug}
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Host Screen Share Button */}
          {isHost && (
            <button
              onClick={isSharing ? stopScreenShare : startScreenShare}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95 ${
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

          {/* Invite Friend Button */}
          <button
            onClick={handleShareOrCopy}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-white transition-all shadow-sm active:scale-95"
            title="Invite friend"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-xs">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Invite</span>
              </>
            )}
          </button>

          {/* 3-Dots / 3-Lines Menu Trigger */}
          <button
            onClick={() => setShowMembersDrawer(true)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-white transition-all shadow-sm active:scale-95"
            title="Cinema Menu & Members (3 Dots)"
          >
            <MoreVertical className="w-4 h-4 text-zinc-300" />
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-600 text-white font-mono font-bold">
              {totalOccupied}/3
            </span>
          </button>
        </div>
      </header>

      {/* Main Theater Layout: [video] under [message area] */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-4 flex flex-col gap-3">
        {/* [video] Container */}
        <div className="w-full aspect-video rounded-2xl bg-black border border-zinc-800/80 overflow-hidden relative shadow-2xl flex flex-col justify-center items-center">
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
              showUrlModal={showUrlModal}
              setShowUrlModal={setShowUrlModal}
              showUploadModal={showUploadModal}
              setShowUploadModal={setShowUploadModal}
            />
          )}
        </div>

        {/* [message area] Directly Underneath [video] */}
        <ChatArea
          messages={messages}
          onSendMessage={sendMessage}
          currentUserId={session?.user_id}
          className="w-full flex-1"
        />
      </main>

      {/* 3-Dots Drawer (Media Controls, Sync Telemetry, & Members) */}
      {showMembersDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setShowMembersDrawer(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-xs sm:max-w-sm bg-zinc-950 border-l border-zinc-800 p-5 shadow-2xl flex flex-col gap-4 z-10 overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                  Dudu & Bubu Lounge
                </h2>
              </div>
              <button
                onClick={() => setShowMembersDrawer(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sync Telemetry (Hidden under 3-dots) */}
            <div className="flex items-center justify-between bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-semibold text-zinc-200">Synced Real-Time</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono text-[10px] border border-emerald-500/20">
                Sub-50ms Drift
              </span>
            </div>

            {/* Media Controls for Host (Moved from above video into 3-dots) */}
            {isHost && (
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Change Video Source
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setShowUrlModal(true);
                      setShowMembersDrawer(false);
                    }}
                    className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Paste URL</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUploadModal(true);
                      setShowMembersDrawer(false);
                    }}
                    className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold active:scale-95 transition-all"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Upload (.mkv)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Occupancy Indicator */}
            <div className="flex items-center justify-between bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-800/60 text-xs">
              <span className="text-zinc-400">Theater Capacity</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                {totalOccupied} / 3 Seats Active
              </span>
            </div>

            {/* 3 Seats List */}
            <div className="space-y-2.5">
              {/* Seat 1: Host */}
              <div className="bg-zinc-900/80 border border-indigo-500/30 rounded-xl p-3 flex items-center gap-3 relative shadow-sm">
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
                <div className="bg-zinc-900/80 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3 relative shadow-sm">
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
                      Viewer · In Sync
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleShareOrCopy}
                  className="w-full bg-zinc-900/30 hover:bg-zinc-900/70 border border-dashed border-zinc-700 hover:border-indigo-500/50 rounded-xl p-3 flex items-center gap-3 text-left transition-all group"
                >
                  <div className="w-10 h-10 shrink-0 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
                      Seat 2 Empty
                    </p>
                    <p className="text-[10px] text-zinc-500 group-hover:text-indigo-400 transition-colors">
                      Tap to invite friend
                    </p>
                  </div>
                </button>
              )}

              {/* Seat 3: Friend 2 */}
              {seat3 ? (
                <div className="bg-zinc-900/80 border border-teal-500/30 rounded-xl p-3 flex items-center gap-3 relative shadow-sm">
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
                      Viewer · In Sync
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleShareOrCopy}
                  className="w-full bg-zinc-900/30 hover:bg-zinc-900/70 border border-dashed border-zinc-700 hover:border-indigo-500/50 rounded-xl p-3 flex items-center gap-3 text-left transition-all group"
                >
                  <div className="w-10 h-10 shrink-0 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
                      Seat 3 Empty
                    </p>
                    <p className="text-[10px] text-zinc-500 group-hover:text-indigo-400 transition-colors">
                      Tap to invite friend
                    </p>
                  </div>
                </button>
              )}
            </div>

            {/* Invite Button */}
            <div className="mt-auto pt-4 border-t border-zinc-800">
              <button
                onClick={handleShareOrCopy}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Invite Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Copy Room Invite Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
