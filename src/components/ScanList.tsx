/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bluetooth, 
  AlertCircle,
  ExternalLink,
  X,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ChesterDevice, ConnectionState, ConnectionMode } from '../types';

interface ScanListProps {
  connectionState: ConnectionState;
  mode: ConnectionMode;
  onToggleMode: () => void;
  onConnectReal: (unfiltered?: boolean) => void;
  onConnectSimulated: (device: ChesterDevice) => void;
  onDisconnect: () => void;
  activeDevice: ChesterDevice | null;
  isIframe: boolean;
}

export default function ScanList({
  connectionState,
  mode,
  onToggleMode,
  onConnectReal,
  onConnectSimulated,
  onDisconnect,
  activeDevice,
  isIframe
}: ScanListProps) {

  const [dismissedIframeWarning, setDismissedIframeWarning] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const isBluetoothSupported = typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;

  // Open in new tab helper
  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  // If we are outside the AI Studio iframe (i.e. on the public URL),
  // we do not want to show the Simulator tab. We enforce real-world mode.
  const showModeSelector = isIframe;

  return (
    <div id="grainlink-scan-list-container" className="bg-white h-full min-h-[750px] flex flex-col text-black font-sans relative">
      
      {/* Header Branding */}
      <div className="bg-white border-b border-zinc-100 px-6 py-5 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-sans font-black text-lg tracking-tight text-black">GRAINLINK CHESTER</span>
        </div>
        
        {/* Right tools (only if showing simulator/iframe mode) */}
        {showModeSelector && (
          <button 
            onClick={onToggleMode}
            className="text-[10px] font-bold text-zinc-400 hover:text-black border border-zinc-200 px-2.5 py-1 rounded-lg hover:border-black transition-colors cursor-pointer uppercase select-none"
          >
            Switch to {mode === 'simulator' ? 'Real BLE' : 'Simulator'}
          </button>
        )}
      </div>

      {/* Warning Alert if nested in Iframe (which browser blocks BLE inside) */}
      {isIframe && !dismissedIframeWarning && (
        <div className="bg-amber-50 border-b border-amber-150 px-6 py-4.5 select-none animate-fade-in shrink-0 relative">
          <button 
            onClick={() => setDismissedIframeWarning(true)}
            className="absolute top-3.5 right-4.5 p-1 text-amber-500 hover:text-amber-800 rounded-lg hover:bg-amber-100/50 transition-all cursor-pointer"
            aria-label="Dismiss warning"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-sans font-extrabold text-xs text-amber-900 leading-tight">
                Bluetooth requires a New Tab
              </h4>
              <p className="text-[11px] text-amber-700 leading-normal">
                Web Bluetooth is security-restricted inside iframes. Click below to open in a new tab for physical connections.
              </p>
              
              <button
                onClick={handleOpenInNewTab}
                className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-4 py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container - Simple and Clean for Installers */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 relative bg-white overflow-y-auto">
        
        {connectionState === 'scanning' || connectionState === 'connecting' ? (
          /* SCANNING OR CONNECTING VIEW */
          <div className="flex-1 flex flex-col items-center justify-center space-y-5 animate-fade-in text-center max-w-sm mx-auto">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-zinc-100 border-t-black animate-spin" />
              <Bluetooth className="w-6 h-6 text-black absolute animate-pulse" />
            </div>
            {connectionState === 'scanning' && (
              <div className="space-y-1">
                <h3 className="font-sans font-black text-sm uppercase tracking-wider text-black">
                  Searching for CHESTER...
                </h3>
                <p className="text-xs text-zinc-500 font-medium leading-relaxed px-4">
                  Open your browser Bluetooth prompt and select your Chester Gateway.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* UNCONNECTED HOME VIEW - STUNNINGLY SIMPLE */
          <div className="w-full max-w-md mx-auto space-y-8 py-4 animate-fade-in">
            
            {/* Minimalist Visual Representation of the Chester Gateways */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-black rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <Bluetooth className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-1">
                <h2 className="font-sans font-black text-xl tracking-tight text-black uppercase">
                  GrainLink Chester
                </h2>
              </div>
            </div>

            {/* Browser Support Check */}
            {!isBluetoothSupported && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4.5 space-y-2">
                <h4 className="font-sans font-bold text-xs text-red-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  Browser does not support BLE
                </h4>
                <p className="text-[11px] text-red-700 leading-normal">
                  Web Bluetooth is restricted on this browser. For physical installation, please open in **Google Chrome** or **Microsoft Edge**.
                </p>
              </div>
            )}

            {/* CONNECT METHOD ACTION */}
            <div className="space-y-4">
              
              {/* Method 1: Scan for Chesters */}
              <button
                id="scan-chesters-btn"
                onClick={() => onConnectReal(false)}
                disabled={isIframe}
                className="w-full bg-black hover:bg-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-black text-xs py-4 px-5 rounded-2xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2.5 uppercase active:scale-98 select-none"
              >
                <Bluetooth className="w-4.5 h-4.5" />
                <span>Scan for Chesters (Filtered)</span>
              </button>

              {/* Troubleshooting action: Unfiltered Scan */}
              <button
                id="scan-unfiltered-btn"
                onClick={() => onConnectReal(true)}
                disabled={isIframe}
                className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 text-black font-black text-xs py-3 px-5 rounded-2xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2.5 uppercase active:scale-98 select-none"
              >
                <Bluetooth className="w-4 h-4 text-zinc-500" />
                <span>Scan All Devices (Unfiltered)</span>
              </button>

              <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 text-center">
                <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                  🔑 <strong className="text-zinc-700 font-bold">Bluetooth password</strong> can be retrieved by scanning the QR code inside the Chester lid.
                </p>
              </div>

              {/* Collapsible Troubleshooting Guide */}
              <div className="border border-zinc-100 rounded-2xl overflow-hidden mt-2">
                <button
                  id="toggle-troubleshoot-btn"
                  onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                  className="w-full flex items-center justify-between p-4 bg-zinc-50 hover:bg-zinc-100/70 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 text-zinc-700">
                    <HelpCircle className="w-4 h-4 text-black" />
                    <span className="text-xs font-bold uppercase tracking-wider">Can't find your Chester?</span>
                  </div>
                  {showTroubleshoot ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  )}
                </button>

                {showTroubleshoot && (
                  <div className="p-5 bg-white border-t border-zinc-100 space-y-4 text-left animate-fade-in">
                    <p className="text-xs text-zinc-600 leading-normal">
                      If your Chester device isn't showing up in the Bluetooth search window, go through these steps to fix the issue:
                    </p>
                    
                    <div className="space-y-3.5">
                      {/* Step 1 */}
                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-zinc-100 text-black font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          1
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-[11px] font-bold text-black uppercase tracking-wider">Use Unfiltered Scan</h4>
                          <p className="text-[11px] text-zinc-500 leading-normal">
                            Try clicking the <strong className="text-black">Scan All Devices (Unfiltered)</strong> button above. Some Chester units broadcast names that aren't matched by the default Chester name filter.
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-zinc-100 text-black font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-[11px] font-bold text-black uppercase tracking-wider">Check App Bluetooth Permission</h4>
                          <p className="text-[11px] text-zinc-500 leading-normal">
                            On iPhones using <strong className="text-black">Bluefy</strong>, make sure iOS has allowed <strong className="text-black">Bluetooth permissions</strong> for the Bluefy app. Go to your iPhone Settings → scroll down to Bluefy → verify Bluetooth is enabled.
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-zinc-100 text-black font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          3
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-[11px] font-bold text-black uppercase tracking-wider">Ensure Chester is not connected elsewhere</h4>
                          <p className="text-[11px] text-zinc-500 leading-normal">
                            Bluetooth LE devices can only be connected to <strong className="text-black">one phone or app at a time</strong>. If another phone is connected to the Chester, it will stop advertising and become completely invisible. Close other Bluetooth apps on nearby devices.
                          </p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-zinc-100 text-black font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          4
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-[11px] font-bold text-black uppercase tracking-wider">Wake or Power Cycle the Chester</h4>
                          <p className="text-[11px] text-zinc-500 leading-normal">
                            The Chester may have entered a low-power sleep mode. Press the physical <strong className="text-black">Reset/Wake button</strong> inside the Chester lid or power cycle the unit to restart its Bluetooth advertisement signals.
                          </p>
                        </div>
                      </div>

                      {/* Step 5 */}
                      <div className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-zinc-100 text-black font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          5
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-[11px] font-bold text-black uppercase tracking-wider">Proximity</h4>
                          <p className="text-[11px] text-zinc-500 leading-normal">
                            Keep your smartphone within 10 feet (3 meters) of the Chester during the connection process to ensure a strong signal.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>



      {/* Simple Professional Footnote */}
      <div className="bg-white px-6 py-4.5 border-t border-zinc-100 text-[10px] text-zinc-400 flex justify-between items-center select-none shrink-0 font-medium">
        <span>GrainLink Mobile v1.2</span>
      </div>

    </div>
  );
}
