/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageSquare, Phone, Send, ShieldAlert, Wifi, X } from 'lucide-react';

interface SmsMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  isSelf: boolean;
}

interface SmsMockupProps {
  phoneNumber: string;
  incomingMessage: { text: string; sender: string } | null;
  onClearIncoming: () => void;
}

export default function SmsMockup({ phoneNumber, incomingMessage, onClearIncoming }: SmsMockupProps) {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [userText, setUserText] = useState('');
  const [activeNotification, setActiveNotification] = useState<SmsMessage | null>(null);

  // Load initial simulated text exchange
  useEffect(() => {
    setMessages([
      {
        id: '1',
        sender: 'Chester Gateway',
        text: 'GrainLink Gateway activated. Ready for Bluetooth connection and field testing.',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        isSelf: false,
      }
    ]);
  }, []);

  // Listen to new incoming messages triggered by the main app
  useEffect(() => {
    if (incomingMessage) {
      const newMsg: SmsMessage = {
        id: Math.random().toString(),
        sender: incomingMessage.sender,
        text: incomingMessage.text,
        timestamp: new Date(),
        isSelf: false,
      };
      
      setMessages((prev) => [...prev, newMsg]);
      setActiveNotification(newMsg);
      onClearIncoming();

      // Auto-hide push notification after 8 seconds
      const timer = setTimeout(() => {
        setActiveNotification(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [incomingMessage, onClearIncoming]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userText.trim()) return;

    const myMsg: SmsMessage = {
      id: Math.random().toString(),
      sender: 'Me',
      text: userText,
      timestamp: new Date(),
      isSelf: true,
    };

    setMessages((prev) => [...prev, myMsg]);
    setUserText('');

    // Simulate auto-reply if they text the gateway back
    setTimeout(() => {
      let replyText = "CHESTER: Command unrecognized. Commands available: 'STATUS', 'CHANNELS', 'HELP'.";
      const normalized = userText.toLowerCase().trim();
      
      if (normalized.includes('status') || normalized.includes('lte') || normalized.includes('online')) {
        replyText = `CHESTER STATUS: Online.\nLTE RSSI: -82dBm\nBattery: 3.65V (92%)\nUptime: 14d 6h\nBin Link: Active`;
      } else if (normalized.includes('channel') || normalized.includes('read') || normalized.includes('temp')) {
        replyText = `CHESTER CHANNELS:\nA1_1 (Bottom): 71.2°F\nA1_2 (Mid-Low): 72.8°F\nA1_3 (Mid-High): 73.5°F\nA1_4 (Top): 74.9°F\nAll nodes reading ok.`;
      } else if (normalized.includes('help')) {
        replyText = `CHESTER HELP: Reply with 'STATUS' for connection strength, or 'CHANNELS' for sensor readings.`;
      }

      const gatewayMsg: SmsMessage = {
        id: Math.random().toString(),
        sender: 'Chester Gateway',
        text: replyText,
        timestamp: new Date(),
        isSelf: false,
      };
      setMessages((prev) => [...prev, gatewayMsg]);
      setActiveNotification(gatewayMsg);
    }, 1500);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div id="sms-simulator-wrapper" className="flex flex-col h-full bg-zinc-900 text-zinc-100 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl">
      {/* Real-time SMS Toast (Push Notification simulation) */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20 }}
            className="absolute top-4 left-4 right-4 z-50 bg-zinc-950/95 backdrop-blur-md border border-emerald-500/30 text-zinc-100 p-4 rounded-xl shadow-2xl flex items-start gap-3"
          >
            <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400 border border-emerald-500/20 shrink-0">
              <MessageSquare className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span className="font-display font-semibold text-xs text-emerald-400 uppercase tracking-wider">SMS Alert Received</span>
                <span className="text-[10px] text-zinc-500">Just Now</span>
              </div>
              <p className="font-semibold text-sm text-zinc-200 mb-1">{activeNotification.sender}</p>
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{activeNotification.text}</p>
            </div>
            <button
              id="close-sms-toast-btn"
              onClick={() => setActiveNotification(null)}
              className="text-zinc-400 hover:text-zinc-200 shrink-0 p-1 rounded-md hover:bg-zinc-850 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulator Device Header */}
      <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-display font-medium text-xs text-zinc-400 uppercase tracking-widest">Installer SMS Monitor</span>
        </div>
        <div className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-semibold shadow-[0_0_8px_rgba(16,185,129,0.08)]">
          Target: {phoneNumber || 'Not Configured'}
        </div>
      </div>

      {/* Text Message History */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col justify-end min-h-[300px]">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs font-mono">
            No text alerts sent yet. Use LTE State or SMS Test options on Chester.
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500">
                  <span className="font-medium">{msg.sender}</span>
                  <span>•</span>
                  <span>{formatTime(msg.timestamp)}</span>
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    msg.isSelf
                      ? 'bg-emerald-600 text-black font-semibold rounded-br-none shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-zinc-750/60'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply Box */}
      <form onSubmit={handleSend} className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center gap-2">
        <input
          id="sms-reply-input"
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          placeholder={phoneNumber ? "Type response command (e.g. STATUS, CHANNELS)..." : "Set phone number in Config to enable"}
          disabled={!phoneNumber}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          id="sms-reply-send-btn"
          type="submit"
          disabled={!userText.trim() || !phoneNumber}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-black disabled:text-zinc-600 font-bold p-2.5 rounded-xl transition-all cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.1)] hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
