'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tv, Users, Radio, ArrowLeft, Volume2, Maximize, Minimize } from 'lucide-react';
import { VideoPlayer } from '../../../components/player/VideoPlayer';
import { DOMSpatialNavigator } from '../../../lib/spatialNavigation';

export default function TVReceiverPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const navigatorRef = useRef<DOMSpatialNavigator | null>(null);

  useEffect(() => {
    const nav = new DOMSpatialNavigator({
      onSelect: (id) => {
        if (id === 'tv-btn-unlock') {
          setAudioUnlocked(true);
        } else if (id === 'tv-btn-exit') {
          router.push(`/room/${slug}`);
        } else if (id === 'tv-btn-fullscreen') {
          toggleFullscreen();
        }
      },
      onBack: () => {
        router.push(`/room/${slug}`);
      },
    });

    navigatorRef.current = nav;

    const handleKeyDown = (e: KeyboardEvent) => {
      nav.handleKeyDown(e);
    };

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on the unlock button or first navigable element
    setTimeout(() => {
      nav.setActiveId(audioUnlocked ? 'tv-btn-fullscreen' : 'tv-btn-unlock');
    }, 100);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioUnlocked, router, slug]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between p-6 md:p-8 select-none overflow-hidden">
      {/* Top TV Header */}
      <div className="flex items-center justify-between border-b border-cinema-800/80 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Smart TV Cinema Receiver</h1>
            <p className="text-sm text-gray-400 flex items-center gap-2 mt-0.5">
              <span>Room:</span>
              <span className="font-mono text-amber-300 font-semibold">{slug}</span>
              <span>·</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>10-Foot Spatial Navigation Active</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="tv-btn-fullscreen"
            data-tv-nav="true"
            onClick={toggleFullscreen}
            tabIndex={0}
            className="focus:outline-none focus:ring-4 focus:ring-amber-500 bg-cinema-900 border border-cinema-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-cinema-850 transition-all"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span>{isFullscreen ? 'Windowed' : 'Fullscreen'}</span>
          </button>

          <button
            id="tv-btn-exit"
            data-tv-nav="true"
            onClick={() => router.push(`/room/${slug}`)}
            tabIndex={0}
            className="focus:outline-none focus:ring-4 focus:ring-amber-500 bg-cinema-900 border border-cinema-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-cinema-850 transition-all text-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit TV Mode</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Stage */}
      <div className="flex-1 my-4 bg-cinema-950 rounded-3xl border border-cinema-850 relative overflow-hidden flex items-center justify-center">
        {!audioUnlocked ? (
          <div className="text-center max-w-lg bg-cinema-900/95 border border-amber-500/40 rounded-2xl p-8 backdrop-blur-xl shadow-2xl z-30">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 animate-pulse">
              <Volume2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Audio Interaction Required</h2>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Smart TV browser autoplay policies require one user interaction to activate synchronized audio on Tizen, webOS, and Android TV.
            </p>
            <button
              id="tv-btn-unlock"
              data-tv-nav="true"
              onClick={() => setAudioUnlocked(true)}
              autoFocus
              tabIndex={0}
              className="focus:outline-none focus:ring-4 focus:ring-amber-400 bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-8 py-3.5 rounded-xl text-base tracking-wide transition-all shadow-lg shadow-amber-500/20"
            >
              PRESS ENTER TO UNLOCK AUDIO
            </button>
          </div>
        ) : (
          <div className="w-full h-full relative">
            <VideoPlayer
              roomId={slug}
              isHost={false}
              isTvReceiver={true}
            />
          </div>
        )}
      </div>

      {/* Bottom Remote Hints */}
      <div className="flex items-center justify-between text-xs text-gray-400 border-t border-cinema-800/80 pt-4">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-cinema-800 rounded font-mono text-gray-200">D-PAD</kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-cinema-800 rounded font-mono text-gray-200">ENTER</kbd>
            <span>Select / Action</span>
          </span>
          <span className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-cinema-800 rounded font-mono text-gray-200">BACK</kbd>
            <span>Return to Room</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Smart TV Cinema Receiver</span>
        </div>
      </div>
    </div>
  );
}
