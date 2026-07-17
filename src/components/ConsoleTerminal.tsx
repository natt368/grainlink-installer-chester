/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, CornerDownLeft, Sparkles, Trash2, ArrowUpRight } from 'lucide-react';
import { CommandLog } from '../types';

interface ConsoleTerminalProps {
  logs: CommandLog[];
  onSendCommand: (commandStr: string) => void;
  onClearLogs: () => void;
  connectionState: string;
}

const SAMPLE_COMMANDS = [
  { cmd: 'help', desc: 'Show all available commands' },
  { cmd: 'chester channel list', desc: 'List configured sensor channels & counts' },
  { cmd: 'chester channel read', desc: 'Perform live read of active channels' },
  { cmd: 'chester lte status', desc: 'Check cell network registration & signal' },
  { cmd: 'chester sms test', desc: 'Trigger text alert to installer phone' },
  { cmd: 'system info', desc: 'Show device firmware, OS & hardware profile' },
];

export default function ConsoleTerminal({ logs, onSendCommand, onClearLogs, connectionState }: ConsoleTerminalProps) {
  const [input, setInput] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of logs on new inputs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendCommand(input.trim());
    setInput('');
  };

  const handleSuggestionClick = (cmd: string) => {
    setInput(cmd);
  };

  return (
    <div id="terminal-section" className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg h-full font-mono">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-850 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-200">
          <TerminalIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold tracking-wider uppercase text-white">Live Chester BLE Shell</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${
            connectionState === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
          }`} />
          <span className="text-[10px] text-zinc-400 uppercase tracking-widest mr-2">
            {connectionState === 'connected' ? 'active stream' : 'offline simulator'}
          </span>
          <button
            id="clear-terminal-logs-btn"
            onClick={onClearLogs}
            title="Clear Terminal logs"
            className="text-zinc-400 hover:text-rose-400 p-1 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Terminal Output Area */}
      <div className="flex-1 p-4 overflow-y-auto text-xs text-zinc-300 space-y-3 min-h-[220px] max-h-[350px] scrollbar-thin">
        <div className="text-zinc-600 text-[10px] select-none border-b border-zinc-900 pb-2">
          *** CHESTER SERIAL TERMINAL OPENED AT {new Date().toLocaleDateString()} ***<br />
          Type commands below or tap suggestion tabs for rapid configuration.
        </div>

        {logs.map((log) => (
          <div key={log.id} className="space-y-1 animate-fade-in">
            {log.isUser ? (
              <div className="flex items-start text-emerald-400">
                <span className="text-zinc-500 select-none mr-2">uart:~$</span>
                <span className="font-semibold text-zinc-100">{log.command}</span>
                <span className="text-[9px] text-zinc-600 ml-auto select-none">{log.timestamp}</span>
              </div>
            ) : null}
            <div className="pl-4 whitespace-pre-wrap text-zinc-300 font-mono leading-relaxed bg-zinc-900/40 p-2 rounded border border-zinc-850">
              {log.response}
            </div>
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Commands Suggestion Ribbon */}
      <div className="px-4 py-2 bg-zinc-900/60 border-t border-zinc-950 flex flex-wrap gap-1.5 items-center">
        <span className="text-[10px] text-zinc-500 flex items-center gap-1 uppercase mr-1 select-none font-sans font-semibold">
          <Sparkles className="w-3 h-3 text-emerald-400" /> Installer Shortcuts:
        </span>
        {SAMPLE_COMMANDS.map((sc) => (
          <button
            id={`suggest-btn-${sc.cmd.replace(/\s+/g, '-')}`}
            key={sc.cmd}
            onClick={() => handleSuggestionClick(sc.cmd)}
            title={sc.desc}
            className="bg-zinc-900 hover:bg-zinc-850 hover:text-emerald-400 text-[10px] text-zinc-300 px-2.5 py-1 rounded transition-colors flex items-center gap-1 select-none border border-zinc-800 hover:border-zinc-700 cursor-pointer"
          >
            {sc.cmd}
            <ArrowUpRight className="w-2.5 h-2.5 opacity-60" />
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="bg-zinc-900 p-3 border-t border-zinc-850 flex items-center gap-2">
        <span className="text-emerald-400 font-bold select-none text-xs ml-1">uart:~$</span>
        <input
          id="terminal-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type console command (e.g. chester channel read) or 'help'..."
          className="flex-1 bg-transparent text-zinc-100 focus:outline-none placeholder-zinc-600 text-xs font-mono"
        />
        <button
          id="terminal-submit-btn"
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-500 text-black px-3 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.15)] cursor-pointer"
        >
          <span>Run</span>
          <CornerDownLeft className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
}
