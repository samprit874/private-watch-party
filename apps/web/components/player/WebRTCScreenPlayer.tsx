'use client';

import React, { useEffect, useRef } from 'react';
import { Monitor, Volume2, VolumeX, Maximize, Minimize, StopCircle } from 'lucide-react';

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
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Attach local (host) or remote (viewer) MediaStream to HTML5 video element
  useEffect(() => {
    const video = videoRef.current;
    const activeStream = isHost ? localStream : (remoteStream || localStream);

    if (video && activeStream) {
      video.srcObject = activeStream;
      video.play().catch((err) => {
        console.warn('[WebRTCScreenPlayer] Autoplay prevented, waiting for interaction:', err);
      });
    }

    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [localStream, remoteStream, isHost]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
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
        muted={isHost} // Always mute locally for host to prevent system audio feedback loops
        className="w-full h-full object-contain"
      />

      {/* Top Left Badge: Engine A Indicator */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600/90 backdrop-blur-md text-xs font-semibold text-white shadow-lg shadow-indigo-600/30">
          <Monitor className="w-3.5 h-3.5" />
          <span>Engine A: Live Screen Share</span>
        </div>

        {hasAudio ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md text-xs text-emerald-300">
            <Volume2 className="w-3.5 h-3.5" />
            <span>System Audio Active</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 backdrop-blur-md text-xs text-amber-300">
            <VolumeX className="w-3.5 h-3.5" />
            <span>Video Only (No Tab Audio)</span>
          </div>
        )}
      </div>

      {/* Top Right: Host Stop Control & Fullscreen */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {isHost && isSharing && (
          <button
            onClick={onStopSharing}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-lg shadow-red-600/30 transition-colors"
          >
            <StopCircle className="w-3.5 h-3.5" />
            <span>Stop Sharing</span>
          </button>
        )}

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white backdrop-blur-md transition-colors"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
