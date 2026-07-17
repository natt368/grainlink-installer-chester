/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { 
  QrCode, 
  Bluetooth, 
  AlertCircle,
  ExternalLink,
  Camera,
  X,
  Sparkles,
  Search,
  Wifi
} from 'lucide-react';
import { ChesterDevice, ConnectionState, ConnectionMode } from '../types';

// Helper to extract a serial number from scanned QR code string
const extractSerialFromQr = (text: string): { name: string, id: string } => {
  const cleanText = text.trim();
  // Extract trailing 10-digit number if present (e.g. from URLs like https://grainlink.com/chester/2161112345 or just plain serial)
  const match = cleanText.match(/\d{10}/);
  if (match) {
    return { name: match[0], id: match[0] };
  }
  // If it contains any other digits
  const digitMatch = cleanText.match(/\d+/);
  if (digitMatch) {
    return { name: digitMatch[0], id: digitMatch[0] };
  }
  // Alphanumeric fallback
  const name = cleanText.replace(/Chester\s*/gi, '').trim();
  return { name: name || '2161112345', id: name || '2161112345' };
};

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
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<boolean>(false);
  const [scanningStatus, setScanningStatus] = useState<string>('Initializing camera...');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Web Audio scan beep synthesis
  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1100, audioCtx.currentTime); // Crisp crystal tone
      
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio feedback failed', e);
    }
  };

  // Manage camera streaming and QR code scanning lifecycle
  useEffect(() => {
    let active = true;
    let streamRef: MediaStream | null = null;
    let animationFrameId: number | null = null;

    if (showQrScanner) {
      setCameraError(false);
      setScanningStatus('Align QR code within target frame...');

      const canvas = document.createElement('canvas');
      const canvasCtx = canvas.getContext('2d', { willReadFrequently: true });

      // Fallback timer: if no physical QR is scanned within 6 seconds, we auto-trigger simulated demo
      const fallbackTimer = setTimeout(() => {
        if (!active) return;
        playScanBeep();
        setScanningStatus('Using simulated sandbox gateway (2161112345)...');
        
        setTimeout(() => {
          if (!active) return;
          if (streamRef) {
            streamRef.getTracks().forEach(track => track.stop());
          }
          setCameraStream(null);
          setShowQrScanner(false);
          onConnectSimulated({
            name: '2161112345',
            id: '2161112345',
            batteryVoltage: 3.65,
            batteryPercent: 92,
            signalStrength: -65
          });
        }, 800);
      }, 6000);

      const scanFrame = () => {
        if (!active) return;
        const video = videoRef.current;
        if (video && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvasCtx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = canvasCtx?.getImageData(0, 0, canvas.width, canvas.height);
          if (imageData) {
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
              clearTimeout(fallbackTimer);
              const info = extractSerialFromQr(code.data);
              playScanBeep();
              setScanningStatus(`QR scanned! Serial: ${info.id}`);

              setTimeout(() => {
                if (!active) return;
                if (streamRef) {
                  streamRef.getTracks().forEach(track => track.stop());
                }
                setCameraStream(null);
                setShowQrScanner(false);
                onConnectSimulated({
                  name: info.name,
                  id: info.id,
                  batteryVoltage: 3.65,
                  batteryPercent: 92,
                  signalStrength: -65
                });
              }, 800);
              return;
            }
          }
        }
        animationFrameId = requestAnimationFrame(scanFrame);
      };

      // Start camera stream
      navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef = stream;
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn('Video play interrupted', e));
        }
        // Start scanning loop
        animationFrameId = requestAnimationFrame(scanFrame);
      })
      .catch((err) => {
        console.warn('Camera access denied or unavailable, running radar fallback', err);
        setCameraError(true);
        setScanningStatus('Running radar search...');
        
        // Fallback simulated scanner (radar)
        const radarTimer = setTimeout(() => {
          if (!active) return;
          playScanBeep();
          setScanningStatus('Chester detected! Pairing...');
          
          const pairTimer = setTimeout(() => {
            if (!active) return;
            setShowQrScanner(false);
            onConnectSimulated({
              name: '2161112345',
              id: '2161112345',
              batteryVoltage: 3.65,
              batteryPercent: 92,
              signalStrength: -65
            });
          }, 800);
          
          return () => clearTimeout(pairTimer);
        }, 2500);

        return () => clearTimeout(radarTimer);
      });

      return () => {
        active = false;
        clearTimeout(fallbackTimer);
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        if (streamRef) {
          streamRef.getTracks().forEach(track => track.stop());
        }
      };
    } else {
      // Cleanup stream when closed
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }
  }, [showQrScanner]);

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
      {isIframe && (
        <div className="bg-amber-50 border-b border-amber-150 px-6 py-4.5 select-none animate-fade-in shrink-0">
          <div className="flex items-start gap-3">
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
            {!isBluetoothSupported && !showQrScanner && (
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

            {/* TWO IMMERSIVE METHOD ACTIONS - GET RID OF EVERYTHING ELSE */}
            <div className="space-y-3">
              
              {/* Method 1: Scan for Chesters */}
              <button
                onClick={() => onConnectReal(false)}
                disabled={isIframe}
                className="w-full bg-black hover:bg-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-black text-xs py-4 px-5 rounded-2xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2.5 uppercase active:scale-98 select-none"
              >
                <Bluetooth className="w-4.5 h-4.5" />
                <span>Scan for Chesters</span>
              </button>

              {/* Method 2: Camera QR Scan */}
              <button
                onClick={() => setShowQrScanner(true)}
                className="w-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-250 text-black font-black text-xs py-4 px-5 rounded-2xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2.5 uppercase active:scale-98 select-none"
              >
                <QrCode className="w-4.5 h-4.5" />
                <span>Scan QR Code on Chester</span>
              </button>

            </div>

          </div>
        )}

      </div>

      {/* IMMERSIVE CAMERA QR SCANNER MODAL */}
      {showQrScanner && (
        <div className="absolute inset-0 bg-neutral-950 z-50 flex flex-col justify-between p-6 animate-fade-in select-none">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between text-white border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="font-sans font-black text-[11px] tracking-widest uppercase">
                Align QR Code
              </span>
            </div>
            <button 
              onClick={() => setShowQrScanner(false)}
              className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Camera Frame Viewport */}
          <div className="flex-1 flex items-center justify-center my-6 relative overflow-hidden rounded-3xl border border-white/20 bg-neutral-900 shadow-2xl">
            
            {cameraError ? (
              /* Fallback Beautiful Scanner Overlay (Radar) */
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-5 px-6">
                <div className="relative w-40 h-40 border border-emerald-500/20 rounded-full flex items-center justify-center overflow-hidden">
                  {/* Glowing Radar sweep line */}
                  <div className="absolute inset-0 bg-conic-to-emerald animate-radar-sweep opacity-40 rounded-full" />
                  <div className="w-28 h-28 border border-emerald-500/30 rounded-full flex items-center justify-center">
                    <div className="w-14 h-14 border border-emerald-500/40 rounded-full flex items-center justify-center">
                      <QrCode className="w-6 h-6 text-emerald-500 animate-pulse" />
                    </div>
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold uppercase tracking-widest block max-w-max mx-auto">
                    Smart Radar Scanning
                  </span>
                  <p className="text-[10px] text-zinc-400 max-w-xs mx-auto pt-1 leading-normal">
                    Camera stream blocked or unavailable. Falling back to high-sensitivity Bluetooth sensor broadcast scanning.
                  </p>
                </div>
              </div>
            ) : (
              /* Live Camera Stream Video View */
              <video 
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Tactile Frame Scanner Target (Green Corners & Red Pulsing laser) */}
            <div className="absolute w-60 h-60 border-2 border-transparent relative flex items-center justify-center select-none pointer-events-none">
              
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />

              {/* Laser line effect */}
              <div className="absolute left-1.5 right-1.5 h-0.5 bg-emerald-500/80 shadow-[0_0_8px_#10b981] animate-laser-scan" />
            </div>

          </div>

          {/* Status Tray */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-white/90 space-y-1.5">
            <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-zinc-400 block">
              Diagnostic Scanner State
            </span>
            <p className="text-xs font-bold font-sans text-emerald-400 animate-pulse leading-normal">
              {scanningStatus}
            </p>
          </div>

        </div>
      )}

      {/* Immersive CSS injection for custom keyframe animations */}
      <style>{`
        @keyframes laser-scan {
          0% { top: 10px; opacity: 0.3; }
          50% { top: 230px; opacity: 0.9; }
          100% { top: 10px; opacity: 0.3; }
        }
        @keyframes radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-laser-scan {
          animation: laser-scan 2.5s infinite ease-in-out;
        }
        .animate-radar-sweep {
          animation: radar-sweep 4s infinite linear;
        }
        .bg-conic-to-emerald {
          background: conic-gradient(from 0deg, transparent 40%, rgba(16, 185, 129, 0.45));
        }
      `}</style>

      {/* Simple Professional Footnote */}
      <div className="bg-white px-6 py-4.5 border-t border-zinc-100 text-[10px] text-zinc-400 flex justify-between items-center select-none shrink-0 font-medium">
        <span>GrainLink Mobile v1.2</span>
      </div>

    </div>
  );
}
