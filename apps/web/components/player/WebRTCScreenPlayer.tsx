'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Volume2, VolumeX, Maximize, Minimize, StopCircle, Loader2 } from 'lucide-react';
import { enterLandscapeFullscreen, exitLandscapeFullscreen, isFullscreenActive } from '../../lib/fullscreen';

interface WebRTCScreenPlayerProps {
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  isSharing: boolean;
  hasAudio: boolean;
  isHost: boolean;
  onStopSharing?: () => void;
}

export function WebRTCScreenPlayer({
  localStream,
  remoteStream,
  isSharing,
  hasAudio,
  isHost,
  onStopSharing,
}: WebRTCScreenPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsUnmute, setNeedsUnmute] = useState(false);

  const activeStream = isHost ? localStream : (remoteStream || localStream);

  // Attach local (host) or remote (viewer) MediaStream to HTML5 video element
  useEffect(() => {
    const video = videoRef.current;

    if (video && activeStream) {
      video.srcObject = activeStream;
      video.muted = isHost;
      video.play().catch((err) => {
        console.warn('[WebRTCScreenPlayer] Autoplay blocked by mobile browser, falling back to muted playback:', err);
        video.muted = true;
        setNeedsUnmute(true);
        video.play().catch(() => {});
      });
    }

    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [activeStream, isHost]);

  // Listen for fullscreen and rotation changes
  useEffect(() => {
    const handleFsChange = () => {
      const active = isFullscreenActive();
      setIsFullscreen(active);
      if (!active && typeof screen !== 'undefined' && (screen.orientation as any)?.unlock) {
        try {
          (screen.orientation as any).unlock();
        } catch {}
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (isFullscreenActive()) {
      exitLandscapeFullscreen();
      setIsFullscreen(false);
    } else {
      enterLandscapeFullscreen(containerRef.current, videoRef.current);
      setIsFullscreen(true);
    }
  };

  const handleUnmute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      setNeedsUnmute(false);
      video.play().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black rounded-2xl overflow-hidden flex flex-col justify-center items-center group select-none shadow-2xl"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isHost} // Always mute locally for host to prevent feedback echo loops
        className="w-full h-full object-contain"
        style={{
          transform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
        }}
      />

      {/* Connecting Spinner for Viewer when Stream has not arrived yet */}
      {!activeStream && (
        <div className="absolute inset-0 z-10 bg-black/90 flex flex-col items-center justify-center gap-2.5 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-xs font-medium">Connecting to Host Screen Share...</p>
        </div>
      )}

      {/* Floating Unmute Button for Mobile Browser Autoplay policies */}
      {needsUnmute && !isHost && (
        <button
          onClick={handleUnmute}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 shadow-xl shadow-indigo-600/40 backdrop-blur-md active:scale-95 transition-all animate-bounce"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Tap to Unmute Audio</span>
        </button>
      )}

      {/* Top Left Badge: Engine A Indicator */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-600/90 backdrop-blur-md text-xs font-semibold text-white shadow-lg shadow-indigo-600/30">
          <Monitor className="w-3.5 h-3.5" />
          <span>Screen Share · 1080p 60fps</span>
        </div>

        {hasAudio ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md text-xs text-emerald-300">
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">System Audio</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30 backdrop-blur-md text-xs text-amber-300">
            <VolumeX className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">No Tab Audio</span>
          </div>
        )}
      </div>

      {/* Top Right: Host Stop Control & Fullscreen */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {isHost && isSharing && (
          <button
            onClick={onStopSharing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-lg shadow-red-600/30 transition-all active:scale-95"
          >
            <StopCircle className="w-3.5 h-3.5" />
            <span>Stop Sharing</span>
          </button>
        )}

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white backdrop-blur-md transition-colors"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
