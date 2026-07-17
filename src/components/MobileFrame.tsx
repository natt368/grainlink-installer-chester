/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Smartphone, 
  Settings, 
  Bluetooth, 
  TrendingUp, 
  TrendingDown, 
  Sliders, 
  CloudSun,
  Radio,
  ExternalLink
} from 'lucide-react';

interface MobileFrameProps {
  children: React.ReactNode;
  mockTempOffset: number;
  onSetMockTempOffset: (val: number) => void;
  mockLteSignal: number; // -110 to -60
  onSetMockLteSignal: (val: number) => void;
  mockLteAttached: boolean;
  onOpenInNewTab: () => void;
  isIframe: boolean;
}

export default function MobileFrame({
  children,
  mockTempOffset,
  onSetMockTempOffset,
  mockLteSignal,
  onSetMockLteSignal,
  mockLteAttached,
  onOpenInNewTab,
  isIframe
}: MobileFrameProps) {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 md:p-8 font-sans text-zinc-300">
      
      {/* Centered Smartphone View Pane (iPhone 17 Pro Max Dimension & Look) */}
      <div className="w-full flex flex-col justify-center items-center select-none">
        
        {/* iPhone 17 Pro Max Frame Chassis */}
        <div className="w-[430px] h-[910px] bg-neutral-900 border-[10px] border-neutral-850 rounded-[55px] p-2 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] relative flex flex-col justify-between ring-1 ring-white/10">
          
          {/* Natural Titanium Accent Bezels */}
          <div className="absolute inset-0 rounded-[45px] border-2 border-neutral-700/35 pointer-events-none" />

          {/* Inner Mobile Screen Frame */}
          <div className="bg-white rounded-[42px] overflow-hidden flex flex-col relative w-full h-full border border-zinc-200">
            
            {/* Mock Phone Status Bar & Dynamic Island */}
            <div className="bg-white px-6 pt-4 pb-2.5 flex justify-between items-center select-none text-[11px] font-semibold text-zinc-800 relative z-30 border-b border-zinc-100">
              <span>9:41 AM</span>
              
              {/* iPhone 17 Pro Max - Sleek Dynamic Island */}
              <div className="absolute top-3.5 left-1/2 -translate-x-1/2 bg-black w-[85px] h-6 rounded-full flex items-center justify-center shadow-inner ring-1 ring-white/10 pointer-events-none">
                <div className="w-2 h-2 rounded-full bg-[#0d0d0d] relative">
                  <div className="absolute inset-0.5 rounded-full bg-blue-950/40" />
                </div>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-700">
                <span>{mockLteAttached ? '5G' : 'No Service'}</span>
                <div className="flex gap-0.5 items-end h-2.5">
                  <div className={`w-0.5 h-1 rounded-xs ${mockLteAttached ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
                  <div className={`w-0.5 h-1.5 rounded-xs ${mockLteAttached ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
                  <div className={`w-0.5 h-2 rounded-xs ${mockLteAttached ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
                  <div className={`w-0.5 h-2.5 rounded-xs ${mockLteAttached && mockLteSignal > -95 ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
                  <div className={`w-0.5 h-2.5 rounded-xs ${mockLteAttached && mockLteSignal > -80 ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
                </div>
                <span className="ml-1">100%</span>
              </div>
            </div>

            {/* Main Content Render (iPhone 17 Pro Max tall view) */}
            <div className="flex-1 overflow-y-auto h-[815px] max-h-[815px] scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-transparent bg-white">
              {children}
            </div>

            {/* Home Swipe Indicator */}
            <div className="bg-white py-3 flex justify-center select-none border-t border-zinc-100">
              <div className="w-32 h-1 bg-zinc-800 rounded-full" />
            </div>

          </div>
        </div>

        {/* Dynamic Spec Label */}
        <div className="mt-3 text-[10px] font-bold text-zinc-600 tracking-wider uppercase select-none flex items-center gap-1">
          <span>iPhone 17 Pro Max Simulation</span>
          <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full" />
          <span>GrainLink Diagnostics Platform</span>
        </div>

      </div>
    </div>
  );
}
