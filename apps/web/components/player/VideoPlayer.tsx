'use client';

import React, { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Link as LinkIcon,
  Loader2,
  Film,
  UploadCloud,
} from 'lucide-react';
import { useSocketSync } from '../../hooks/useSocketSync';
import { UploadModal } from '../upload/UploadModal';
import { getApiBaseUrl } from '../../lib/api';
import { enterLandscapeFullscreen, exitLandscapeFullscreen, isFullscreenActive } from '../../lib/fullscreen';
import { Socket } from 'socket.io-client';

interface VideoPlayerProps {
  roomId?: string;
  isHost: boolean;
  socket?: Socket | null;
  showUrlModal?: boolean;
  setShowUrlModal?: (show: boolean) => void;
  showUploadModal?: boolean;
  setShowUploadModal?: (show: boolean) => void;
}

const PLAYBACK_RATES = [0.75, 1.0, 1.25, 1.5, 2.0];

export function VideoPlayer({
  roomId,
  isHost,
  socket,
  showUrlModal: externalShowUrlModal,
  setShowUrlModal: externalSetShowUrlModal,
  showUploadModal: externalShowUploadModal,
  setShowUploadModal: externalSetShowUploadModal,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [videoSrc, setVideoSrc] = useState<string>(
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [baseRate, setBaseRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [internalShowUrlModal, setInternalShowUrlModal] = useState(false);
  const [internalShowUploadModal, setInternalShowUploadModal] = useState(false);

  const showUrlModal = externalShowUrlModal !== undefined ? externalShowUrlModal : internalShowUrlModal;
  const setShowUrlModal = externalSetShowUrlModal || setInternalShowUrlModal;
  const showUploadModal = externalShowUploadModal !== undefined ? externalShowUploadModal : internalShowUploadModal;
  const setShowUploadModal = externalSetShowUploadModal || setInternalShowUploadModal;

  const [inputUrl, setInputUrl] = useState('');
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const {
    isConnected,
    driftInfo,
    sendPlay,
    sendPause,
    sendSeek,
    sendRate,
    sendMediaChange,
  } = useSocketSync({
    roomId,
    isHost,
    videoRef,
    socket,
    onMediaChange: (newUrl) => {
      setVideoSrc(newUrl);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
    },
  });

  // Load HLS or direct MP4 source
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    if (videoSrc.includes('.m3u8')) {
      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;
        hls.loadSource(videoSrc);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoSrc;
      }
    } else {
      video.src = videoSrc;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [videoSrc]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Play / Pause toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
      if (isHost) {
        sendPlay(video.currentTime);
      }
    } else {
      video.pause();
      setIsPlaying(false);
      if (isHost) {
        sendPause(video.currentTime);
      }
    }
  };

  // Seek bar
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
    if (isHost) {
      sendSeek(target);
    }
  };

  // Cycle speed rate
  const cyclePlaybackRate = () => {
    if (!isHost) return;
    const currentIndex = PLAYBACK_RATES.indexOf(baseRate);
    const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
    const nextRate = PLAYBACK_RATES[nextIndex];
    setBaseRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
      sendRate(nextRate, videoRef.current.currentTime);
    }
  };

  // Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

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

  // Fullscreen with Mobile Landscape Rotation
  const toggleFullscreen = () => {
    if (isFullscreenActive()) {
      exitLandscapeFullscreen();
      setIsFullscreen(false);
    } else {
      enterLandscapeFullscreen(containerRef.current, videoRef.current);
      setIsFullscreen(true);
    }
  };

  // Direct video URL validation & broadcast
  const handleApplyUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setIsValidatingUrl(true);
    setUrlError(null);

    try {
      const serverUrl = getApiBaseUrl();
      const res = await fetch(`${serverUrl}/api/media/validate-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'URL failed security validation');
      }

      const trimmed = inputUrl.trim();
      setVideoSrc(trimmed);
      if (isHost) {
        sendMediaChange(trimmed, 'Direct Video');
      }
      setShowUrlModal(false);
      setInputUrl('');
    } catch (err: any) {
      setUrlError(err.message || 'Error validating URL');
    } finally {
      setIsValidatingUrl(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black rounded-2xl overflow-hidden flex flex-col justify-center items-center group select-none"
    >
      <video
        ref={videoRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        playsInline
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
      />

      {/* Center Big Play Button Overlay */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute z-20 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl shadow-indigo-600/50 hover:scale-105 active:scale-95 transition-all backdrop-blur-md"
        >
          <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1" />
        </button>
      )}

      {/* Bottom Controls Overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 sm:p-4 ${
          !isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity flex flex-col gap-2`}
      >
        {/* Scrubber Bar */}
        <div className="w-full flex items-center gap-2.5 sm:gap-3">
          <span className="text-[11px] font-mono text-gray-300 w-10 text-right shrink-0">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            disabled={!isHost}
            className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:cursor-not-allowed"
          />
          <span className="text-[11px] font-mono text-gray-400 w-10 shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        {/* Buttons Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={togglePlay}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            {/* Volume Toggle & Slider */}
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-gray-300 hover:text-white p-1">
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Load URL Modal */}
      {showUrlModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/[0.1] rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Load Video Stream</h3>
            <p className="text-xs text-gray-400 mb-4">Paste any direct MP4, WebM, or HLS (.m3u8) video URL.</p>

            {urlError && (
              <div className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {urlError}
              </div>
            )}

            <form onSubmit={handleApplyUrl} className="space-y-4">
              <input
                type="url"
                required
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://example.com/stream.mp4"
                className="w-full bg-[#0B0F19] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUrlModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isValidatingUrl}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {isValidatingUrl ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating...</span>
                    </>
                  ) : (
                    <span>Load & Sync</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {roomId && (
        <UploadModal
          roomId={roomId}
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={(streamUrlOrId) => {
            const serverUrl = getApiBaseUrl();
            const fullUrl = streamUrlOrId.startsWith('http')
              ? streamUrlOrId
              : `${serverUrl}/api/uploads/${streamUrlOrId}/video.mp4`;
            setVideoSrc(fullUrl);
            if (isHost) {
              sendMediaChange(fullUrl, 'Uploaded Video');
            }
            setShowUploadModal(false);
          }}
        />
      )}
    </div>
  );
}
