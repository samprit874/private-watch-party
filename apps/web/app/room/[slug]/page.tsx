'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  Film, 
  Users, 
  Shield, 
  Copy, 
  Check, 
  Lock, 
  Unlock, 
  Radio, 
  AlertCircle,
  Loader2,
  Monitor,
  StopCircle 
} from 'lucide-react';
import { VideoPlayer } from '../../../components/player/VideoPlayer';
import { LiveKitScreenPlayer } from '../../../components/player/LiveKitScreenPlayer';
import { useLiveKitRoom } from '../../../hooks/useLiveKitRoom';

interface ParticipantInfo {
  id: string;
  displayName: string;
  role: 'host' | 'co-host' | 'viewer';
  isConnected: boolean;
}

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const rawInviteToken = searchParams?.get('invite');

  const [session, setSession] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);

  const isHost = session?.role === 'host' || session?.role === 'co-host';

  const {
    isSharing,
    hasAudio,
    screenTrack,
    audioTrack,
    startScreenShare,
    stopScreenShare,
  } = useLiveKitRoom({
    roomId: session?.room_id,
    isHost,
  });

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${serverUrl}/api/rooms/session`, {
          credentials: 'include',
        });

        if (!res.ok) {
          // If unauthenticated and no invite token, go to landing
          if (!rawInviteToken) {
            router.push('/');
            return;
          }
        } else {
          const data = await res.json();
          setSession(data);
          // Set initial host / participant list
          setParticipants([
            {
              id: data.user_id,
              displayName: data.display_name,
              role: data.role,
              isConnected: true,
            },
          ]);
        }
      } catch (err) {
        console.error('Session load error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [slug, rawInviteToken, router]);

  const copyInviteLink = () => {
    if (!rawInviteToken && !session) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = rawInviteToken 
      ? `${origin}/join/${rawInviteToken}`
      : `${origin}/join/${session?.room_id}`; // fallback

    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cinema-950 flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">Connecting to cinema...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cinema-950 flex flex-col">
      {/* Top Bar */}
      <header className="h-16 border-b border-cinema-850 px-6 flex items-center justify-between bg-cinema-900/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>{session?.title || 'Private Watch Party'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cinema-800 text-gray-400 font-mono font-normal">
                {slug}
              </span>
            </h1>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Room Synchronized</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {isHost && (
            <button
              onClick={isSharing ? stopScreenShare : startScreenShare}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm ${
                isSharing 
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
              }`}
            >
              {isSharing ? (
                <>
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>Stop Screen Share</span>
                </>
              ) : (
                <>
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Share Screen</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={copyInviteLink}
            className="flex items-center gap-2 bg-cinema-850 hover:bg-cinema-800 border border-cinema-700/60 text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-200 transition-colors shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-indigo-400" />
                <span>Copy Invite Link</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Cinema Theater */}
      <div className="flex-1 flex flex-col p-4 md:p-6 max-w-7xl mx-auto w-full gap-4">
        {/* Video Canvas Stage: Switches between Engine A (Screen Share) and Engine B (Direct Video) */}
        <div className="flex-1 bg-black rounded-2xl border border-cinema-850 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl min-h-[460px]">
          {isSharing || screenTrack ? (
            <LiveKitScreenPlayer
              screenTrack={screenTrack}
              audioTrack={audioTrack}
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

        {/* 3-Seat Participant Bar */}
        <div className="bg-cinema-900 border border-cinema-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Cinema Seats (Max 3)</span>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
            {/* Seat 1 (Active Host or User) */}
            <div className="bg-cinema-950 border border-cinema-700/60 rounded-lg px-4 py-2.5 flex items-center gap-3 min-w-[160px]">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow">
                {session?.display_name?.[0]?.toUpperCase() || 'H'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {session?.display_name || 'Host'}
                </p>
                <p className="text-[10px] text-indigo-400 uppercase tracking-wider">
                  {session?.role || 'Host'}
                </p>
              </div>
            </div>

            {/* Seat 2 */}
            <div className="bg-cinema-950/40 border border-dashed border-cinema-800 rounded-lg px-4 py-2.5 flex items-center gap-3 min-w-[160px]">
              <div className="w-7 h-7 rounded-full bg-cinema-900 border border-cinema-800 flex items-center justify-center text-xs text-gray-600">
                2
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Empty Seat</p>
                <p className="text-[10px] text-gray-600">Invite Viewer</p>
              </div>
            </div>

            {/* Seat 3 */}
            <div className="bg-cinema-950/40 border border-dashed border-cinema-800 rounded-lg px-4 py-2.5 flex items-center gap-3 min-w-[160px]">
              <div className="w-7 h-7 rounded-full bg-cinema-900 border border-cinema-800 flex items-center justify-center text-xs text-gray-600">
                3
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Empty Seat</p>
                <p className="text-[10px] text-gray-600">Invite Viewer</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
