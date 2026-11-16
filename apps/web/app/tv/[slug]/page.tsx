'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tv, Users, Radio, ArrowLeft, Volume2 } from 'lucide-react';

export default function TVReceiverPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [activeElementIndex, setActiveElementIndex] = useState(0);

  // Key navigation for TV remote
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // D-Pad / Remote Keycodes
      // Enter / Select: 13
      // Back: 10009 (Tizen), 461 (webOS), 27 (Escape)
      if (e.keyCode === 13 || e.key === 'Enter') {
        if (!audioUnlocked) {
          setAudioUnlocked(true);
        }
      } else if (e.keyCode === 10009 || e.keyCode === 461 || e.key === 'Escape') {
        router.push(`/room/${slug}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioUnlocked, router, slug]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between p-8 md:p-12 select-none overflow-hidden">
      {/* Top TV Header */}
      <div className="flex items-center justify-between border-b border-cinema-800/80 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Smart TV Cinema Receiver</h1>
            <p className="text-sm text-gray-400 flex items-center gap-2 mt-0.5">
              <span>Room:</span>
              <span className="font-mono text-amber-300 font-semibold">{slug}</span>
              <span>·</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>10-Foot Navigation Mode</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/room/${slug}`)}
          tabIndex={0}
          className="focus:outline-none focus:ring-4 focus:ring-amber-500 bg-cinema-900 border border-cinema-700 px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-cinema-850 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit TV Mode</span>
        </button>
      </div>

      {/* Main Viewport Stage */}
      <div className="flex-1 my-8 bg-cinema-950 rounded-3xl border border-cinema-850 flex flex-col items-center justify-center relative p-8">
        {!audioUnlocked ? (
          <div className="text-center max-w-lg bg-cinema-900/90 border border-amber-500/30 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 animate-pulse">
              <Volume2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Audio Interaction Required</h2>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Smart TV browser autoplay policies require one user interaction to activate synchronized audio.
            </p>
            <button
              onClick={() => setAudioUnlocked(true)}
              autoFocus
              tabIndex={0}
              className="focus:outline-none focus:ring-4 focus:ring-amber-400 bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-8 py-3.5 rounded-xl text-base tracking-wide transition-all shadow-lg shadow-amber-500/20"
            >
              PRESS ENTER TO UNLOCK AUDIO
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Radio className="w-16 h-16 text-emerald-400 mx-auto mb-4 animate-pulse" />
            <h2 className="text-3xl font-extrabold text-white mb-2">TV Receiver Active</h2>
            <p className="text-gray-400 text-base max-w-md mx-auto">
              Ready for synchronized playback stream. Host controls playback from their phone or laptop.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Remote Hints */}
      <div className="flex items-center justify-between text-xs text-gray-400 border-t border-cinema-800/80 pt-6">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-cinema-800 rounded font-mono text-gray-200">D-PAD</kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-cinema-800 rounded font-mono text-gray-200">ENTER</kbd>
            <span>Select / Play</span>
          </span>
          <span className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-cinema-800 rounded font-mono text-gray-200">BACK</kbd>
            <span>Return</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Strict 3-Participant Enforced Cinema</span>
        </div>
      </div>
    </div>
  );
}
