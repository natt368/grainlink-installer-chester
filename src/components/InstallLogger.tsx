/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BinConfig } from '../types';
import { Save, Plus, ClipboardList, CheckCircle2, Trash2, Milestone } from 'lucide-react';

interface InstallLoggerProps {
  currentConfig: BinConfig;
  onUpdateConfig: (config: Partial<BinConfig>) => void;
}

export default function InstallLogger({ currentConfig, onUpdateConfig }: InstallLoggerProps) {
  const [history, setHistory] = useState<BinConfig[]>([]);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('chester_install_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  const handleSaveToHistory = () => {
    if (!currentConfig.binId.trim()) {
      alert('Please provide a Grain Bin ID or Label first.');
      return;
    }

    const updatedItem: BinConfig = {
      ...currentConfig,
      timestamp: new Date().toLocaleString(),
      status: 'completed'
    };

    const newHistory = [updatedItem, ...history.filter(item => item.binId !== currentConfig.binId)];
    setHistory(newHistory);
    localStorage.setItem('chester_install_history', JSON.stringify(newHistory));
    
    onUpdateConfig({ status: 'completed' });
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear your installation history log?')) {
      localStorage.removeItem('chester_install_history');
      setHistory([]);
    }
  };

  const loadFromHistory = (item: BinConfig) => {
    onUpdateConfig(item);
  };

  return (
    <div id="installation-config-logger" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-5 text-zinc-300">
      <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-3">
        <Milestone className="w-5 h-5 text-emerald-400" />
        <h2 className="font-display text-base font-semibold text-white">Field Configuration & SMS Link</h2>
      </div>

      {/* Configuration Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
            1. Grain Bin ID / Label
          </label>
          <input
            id="config-bin-id"
            type="text"
            value={currentConfig.binId}
            onChange={(e) => onUpdateConfig({ binId: e.target.value, status: 'pending' })}
            placeholder="e.g. Bin #4 - North Field"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-sans font-medium"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
              2. Installer / Farmer Name
            </label>
            <input
              id="config-installer-name"
              type="text"
              value={currentConfig.installerName}
              onChange={(e) => onUpdateConfig({ installerName: e.target.value })}
              placeholder="e.g. Nat"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-sans font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
              3. Text Alert Phone Number
            </label>
            <input
              id="config-phone-number"
              type="tel"
              value={currentConfig.phoneNumber}
              onChange={(e) => onUpdateConfig({ phoneNumber: e.target.value })}
              placeholder="e.g. +1 (555) 019-2834"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono font-medium"
            />
            <p className="text-[10px] text-zinc-500 mt-1 select-none leading-relaxed">
              Required to simulate the Chester Gateway text-back alerts.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
            4. Field Notes (Optional)
          </label>
          <textarea
            id="config-notes"
            value={currentConfig.notes}
            onChange={(e) => onUpdateConfig({ notes: e.target.value })}
            placeholder="Add bin notes, sensor count observations, or structure descriptions..."
            rows={2}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-sans"
          />
        </div>

        <button
          id="save-installation-notes-btn"
          onClick={handleSaveToHistory}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded-xl px-4 py-3 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.2)] active:scale-[0.99]"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Lock Configuration & Log Installation</span>
        </button>
      </div>

      {/* Saved Installations History */}
      {history.length > 0 && (
        <div className="border-t border-zinc-800 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-zinc-500" />
              Logged Jobs ({history.length})
            </span>
            <button
              id="clear-install-history-btn"
              onClick={handleClearHistory}
              className="text-[10px] text-zinc-500 hover:text-rose-500 transition-colors flex items-center gap-1 font-medium cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear logs</span>
            </button>
          </div>

          <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {history.map((item) => (
              <div
                key={item.binId}
                onClick={() => loadFromHistory(item)}
                className="bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 rounded-xl p-3 flex justify-between items-center cursor-pointer transition-colors text-left"
              >
                <div>
                  <h4 className="text-xs font-bold text-white truncate max-w-[180px]">{item.binId}</h4>
                  <div className="text-[10px] text-zinc-500 mt-0.5 font-medium">
                    Installer: {item.installerName || 'None'} • {item.timestamp}
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase border border-emerald-500/20 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.08)]">
                  Logged
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
