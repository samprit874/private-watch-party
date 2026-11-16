'use client';

import React, { useEffect, useRef } from 'react';
import { RemoteTrack } from 'livekit-client';
import { Monitor, VolumeX, Maximize, StopCircle, AlertTriangle } from 'lucide-react';

interface LiveKitScreenPlayerProps {
  screenTrack: RemoteTrack | null;
  audioTrack: RemoteTrack | null;
  isSharing: boolean;
  hasAudio: boolean;
  isHost: boolean;
  onStopSharing?: () => void;
}

export function LiveKitScreenPlayer({
  screenTrack,
  audioTrack,
  isSharing,
  hasAudio,
  isHost,
  onStopSharing,
}: LiveKitScreenPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Attach remote video track
  useEffect(() => {
    const video = videoRef.current;
    if (video && screenTrack) {
      screenTrack.attach(video);
    }
    return () => {
      if (screenTrack && video) {
        screenTrack.detach(video);
      }
    };
  }, [screenTrack]);

  // Attach remote audio track
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && audioTrack) {
      audioTrack.attach(audio);
    }
    return () => {
      if (audioTrack && audio) {
        audioTrack.detach(audio);
      }
    };
  }, [audioTrack]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
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
        muted={isHost} // Mute locally for host to prevent feedback loop
        className="w-full h-full object-contain"
      />
      <audio ref={audioRef} autoPlay />

      {/* Top Left Badge: Engine A Indicator */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600/90 backdrop-blur-md text-xs font-semibold text-white shadow-lg shadow-indigo-600/30">
          <Monitor className="w-3.5 h-3.5" />
          <span>Engine A: Live Screen Share</span>
        </div>

        {!hasAudio && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 backdrop-blur-md text-xs text-amber-300">
            <VolumeX className="w-3.5 h-3.5" />
            <span>Video Only (System Audio Restricted)</span>
          </div>
        )}
      </div>

      {/* Top Right: Host Stop Control / Fullscreen */}
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
          className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 transition-colors"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Host Stream Active Notice */}
      {isHost && isSharing && (
        <div className="absolute bottom-4 left-4 z-20 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-xs text-gray-300">
          You are currently broadcasting your screen to all room viewers.
        </div>
      )}
    </div>
  );
}
