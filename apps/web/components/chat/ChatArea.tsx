'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../../hooks/useWebRTCScreenShare';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUserId?: string;
  className?: string;
}

const QUICK_EMOJIS = ['🍿', '😂', '🔥', '👏', '❤️', '😱'];

export function ChatArea({
  messages,
  onSendMessage,
  currentUserId,
  className = '',
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
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

  const formatMessageTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`flex flex-col bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-zinc-200 tracking-wide uppercase">
            Room Chat
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium">
            {messages.length}
          </span>
        </div>

        {/* Quick Emoji Reaction Shortcuts */}
        <div className="flex items-center gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleQuickEmoji(emoji)}
              className="text-sm p-1 rounded-lg hover:bg-zinc-800 active:scale-95 transition-transform"
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[140px] max-h-[320px] scrollbar-thin scrollbar-thumb-zinc-800">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center text-zinc-500">
            <Smile className="w-8 h-8 mb-2 opacity-40 text-indigo-400" />
            <p className="text-xs">No messages yet. Say hello to your friends!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = currentUserId && msg.senderId === currentUserId;
            const isHost = msg.senderRole === 'host';

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

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm break-words leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-zinc-800/90 text-zinc-100 rounded-tl-sm border border-zinc-700/50'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-2.5 border-t border-zinc-800/80 bg-zinc-900/60"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send a message to the room..."
          maxLength={500}
          className="flex-1 bg-zinc-950/80 border border-zinc-700/70 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="flex items-center justify-center p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all active:scale-95 shadow-md shadow-indigo-600/20"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
