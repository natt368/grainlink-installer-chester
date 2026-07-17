/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface MobileFrameProps {
  children: React.ReactNode;
  mockTempOffset: number;
  onSetMockTempOffset: (val: number) => void;
  mockLteSignal: number;
  onSetMockLteSignal: (val: number) => void;
  mockLteAttached: boolean;
  onOpenInNewTab: () => void;
  isIframe: boolean;
}

export default function MobileFrame({
  children
}: MobileFrameProps) {
  return (
    <div className="min-h-screen bg-zinc-100/40 flex flex-col items-center justify-center p-0 md:p-6 font-sans">
      {/* Clean, responsive application card shell */}
      <div className="w-full max-w-md min-h-screen md:min-h-[840px] md:max-h-[880px] bg-white rounded-none overflow-hidden flex flex-col relative shadow-xl md:border md:border-zinc-200/80">
        
        {/* Main Content View */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-white">
          {children}
        </div>

      </div>
    </div>
  );
}
