'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, MessageSquare, Image as ImageIcon, Sparkles, X, Loader2 } from 'lucide-react';
import { ChatMessage } from '../../hooks/useWebRTCScreenShare';
import { getApiBaseUrl } from '../../lib/api';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUserId?: string;
  className?: string;
}

const QUICK_EMOJIS = ['🍿', '😂', '🔥', '👏', '❤️', '😱'];

const DUDU_BUBU_STICKERS = [
  { name: 'Popcorn', url: 'https://media.tenor.com/W-wKjU5vT20AAAAC/bubu-dudu-popcorn.gif' },
  { name: 'Love Hug', url: 'https://media.tenor.com/iU1sJz1R-HAAAAAC/bubu-dudu-hug.gif' },
  { name: 'Sweet Kiss', url: 'https://media.tenor.com/s6nC4v6_w-sAAAAC/bubu-dudu-kiss.gif' },
  { name: 'Happy Dance', url: 'https://media.tenor.com/39mHlXJ06_sAAAAC/bubu-dudu-dance.gif' },
  { name: 'Cheering', url: 'https://media.tenor.com/0FwQe5K8hTIAAAAC/bubu-dudu-cheer.gif' },
  { name: 'Sleepy', url: 'https://media.tenor.com/s4aV3wGqjMIAAAAC/bubu-dudu-sleep.gif' },
  { name: 'Yay Party', url: 'https://media.tenor.com/mO_P8w-m46IAAAAC/bubu-dudu-happy.gif' },
  { name: 'Shy Love', url: 'https://media.tenor.com/2s36B5s9E1QAAAAC/bubu-dudu-shy.gif' },
];

const REACTION_GIFS = [
  { name: 'Popcorn Munch', url: 'https://media.giphy.com/media/GLbiGvv9RiNpGxubY5/giphy.gif' },
  { name: 'Mind Blown', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
  { name: 'Heart Eyes', url: 'https://media.giphy.com/media/26FLdmIp6wJr91JAI/giphy.gif' },
  { name: 'Clapping', url: 'https://media.giphy.com/media/nbvFVEldHM4EVyqPKA/giphy.gif' },
  { name: 'Laughing', url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif' },
  { name: 'Cheers', url: 'https://media.giphy.com/media/Zw3oBUuIg23EWvdvWK/giphy.gif' },
];

function parseChatContent(text: string): { type: 'text' | 'image'; content: string } {
  if (!text) return { type: 'text', content: '' };
  const match = text.match(/^\[(image|gif|sticker):(.+)\]$/);
  if (match) {
    return { type: 'image', content: match[2].trim() };
  }
  if (/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(text.trim())) {
    return { type: 'image', content: text.trim() };
  }
  return { type: 'text', content: text };
}

export function ChatArea({
  messages,
  onSendMessage,
  currentUserId,
  className = '',
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const [showStickerTray, setShowStickerTray] = useState(false);
  const [activeTrayTab, setActiveTrayTab] = useState<'stickers' | 'gifs'>('stickers');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const handleQuickEmoji = (emoji: string) => {
    onSendMessage(emoji);
  };

  const handleSendStickerOrGif = (url: string, type: 'sticker' | 'gif') => {
    onSendMessage(`[${type}:${url}]`);
    setShowStickerTray(false);
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    if (file.size > 15 * 1024 * 1024) {
      alert('Image exceeds 15MB limit.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const dataUrl = await base64Promise;

      const serverUrl = getApiBaseUrl();
      const res = await fetch(`${serverUrl}/api/upload/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: dataUrl,
          filename: file.name,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          onSendMessage(`[image:${data.url}]`);
          return;
        }
      }

      // Fallback
      onSendMessage(`[image:${dataUrl}]`);
    } catch (err) {
      console.error('Error uploading chat image:', err);
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatMessageTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`flex flex-col bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl relative ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-zinc-800/60 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-zinc-200 tracking-wide uppercase">
            Dudu & Bubu Chat
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium font-mono">
            {messages.length}
          </span>
        </div>

        {/* Quick Emoji Reaction Shortcuts */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleQuickEmoji(emoji)}
              className="text-xs sm:text-sm p-1 rounded-lg hover:bg-zinc-800 active:scale-95 transition-transform"
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-h-[140px] max-h-[300px] sm:max-h-[340px] scrollbar-thin scrollbar-thumb-zinc-800">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center text-zinc-500">
            <Smile className="w-8 h-8 mb-2 opacity-40 text-indigo-400" />
            <p className="text-xs font-medium">No messages yet. Send a message, sticker, or photo!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = currentUserId && msg.senderId === currentUserId;
            const isHost = msg.senderRole === 'host';
            const parsed = parseChatContent(msg.text);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Sender Tag */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px]">
                  <span
                    className={`font-semibold ${
                      isMe ? 'text-indigo-400' : 'text-zinc-300'
                    }`}
                  >
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  {isHost && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-bold">
                      Host
                    </span>
                  )}
                  <span className="text-zinc-500 text-[10px]">
                    {formatMessageTime(msg.timestamp)}
                  </span>
                </div>

                {/* Media or Text Content Bubble */}
                {parsed.type === 'image' ? (
                  <div
                    className={`rounded-2xl overflow-hidden p-1 bg-zinc-900/90 border border-zinc-800 shadow-lg max-w-[200px] sm:max-w-[260px] ${
                      isMe ? 'rounded-tr-sm border-indigo-500/40' : 'rounded-tl-sm'
                    }`}
                  >
                    <img
                      src={parsed.content}
                      alt="Chat media"
                      className="w-full max-h-48 object-contain rounded-xl bg-black/40"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm break-words leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-zinc-800/90 text-zinc-100 rounded-tl-sm border border-zinc-700/50'
                    }`}
                  >
                    {parsed.content}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sticker & GIF Shelf Popover */}
      {showStickerTray && (
        <div className="border-t border-zinc-800 bg-zinc-900/95 p-3 flex flex-col gap-2.5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTrayTab('stickers')}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  activeTrayTab === 'stickers'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Dudu & Bubu Stickers
              </button>
              <button
                type="button"
                onClick={() => setActiveTrayTab('gifs')}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  activeTrayTab === 'gifs'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Reaction GIFs
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowStickerTray(false)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-zinc-700">
            {activeTrayTab === 'stickers'
              ? DUDU_BUBU_STICKERS.map((stk) => (
                  <button
                    key={stk.name}
                    type="button"
                    onClick={() => handleSendStickerOrGif(stk.url, 'sticker')}
                    className="p-1 rounded-xl bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800/80 hover:border-indigo-500/50 transition-all flex flex-col items-center group active:scale-95"
                    title={stk.name}
                  >
                    <img
                      src={stk.url}
                      alt={stk.name}
                      className="w-14 h-14 object-contain rounded-lg group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <span className="text-[10px] text-zinc-400 truncate mt-1">
                      {stk.name}
                    </span>
                  </button>
                ))
              : REACTION_GIFS.map((gif) => (
                  <button
                    key={gif.name}
                    type="button"
                    onClick={() => handleSendStickerOrGif(gif.url, 'gif')}
                    className="p-1 rounded-xl bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800/80 hover:border-indigo-500/50 transition-all flex flex-col items-center group active:scale-95"
                    title={gif.name}
                  >
                    <img
                      src={gif.url}
                      alt={gif.name}
                      className="w-14 h-14 object-contain rounded-lg group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <span className="text-[10px] text-zinc-400 truncate mt-1">
                      {gif.name}
                    </span>
                  </button>
                ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-2.5 border-t border-zinc-800/80 bg-zinc-900/60"
      >
        {/* Photo Upload Button (PNG, JPG, JPEG, GIF) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          className="hidden"
          onChange={handleImageFileSelect}
        />
        <button
          type="button"
          disabled={isUploadingImage}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
          title="Send PNG, JPG, JPEG, or GIF"
        >
          {isUploadingImage ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
        </button>

        {/* Sticker / GIF Drawer Toggle */}
        <button
          type="button"
          onClick={() => setShowStickerTray((prev) => !prev)}
          className={`flex items-center justify-center p-2 rounded-xl transition-all active:scale-95 ${
            showStickerTray
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          title="Dudu & Bubu Stickers & GIFs"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message or paste image/GIF..."
          maxLength={500}
          className="flex-1 bg-zinc-950/80 border border-zinc-700/70 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="flex items-center justify-center p-2 sm:p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all active:scale-95 shadow-md shadow-indigo-600/20"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
