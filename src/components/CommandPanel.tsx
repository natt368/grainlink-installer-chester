/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BinConfig, ChannelInfo, LteStatus, CommandLog, ConnectionMode } from '../types';
import { 
  Layers, 
  Battery, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  BatteryCharging,
  Download,
  ArrowLeft,
  Cpu,
  Wifi,
  AlertTriangle,
  Play,
  Cloud,
  Check,
  Sliders,
  Info
} from 'lucide-react';

interface CommandPanelProps {
  onRunCommand: (commandStr: string) => void;
  channels: ChannelInfo[];
  lte: LteStatus;
  batteryVoltage: number;
  batteryPercent: number;
  config: BinConfig;
  onUpdateConfig: (updates: Partial<BinConfig>) => void;
  incomingSms: { text: string; sender: string } | null;
  onClearIncoming: () => void;
  onDisconnect: () => void;
  mode: ConnectionMode;
  terminalLogs: CommandLog[];
  simulatedSensorCount?: number;
  onUpdateSensorCount?: (count: number) => void;
  mockLteSignal?: number;
  onSetMockLteSignal?: (val: number) => void;
  mockLteAttached?: boolean;
  onSetMockLteAttached?: (val: boolean) => void;
  autoPoll?: boolean;
  onToggleAutoPoll?: () => void;
}

export default function CommandPanel({
  onRunCommand,
  channels,
  lte,
  batteryVoltage,
  batteryPercent,
  config,
  onUpdateConfig,
  incomingSms,
  onClearIncoming,
  onDisconnect,
  mode,
  terminalLogs,
  simulatedSensorCount = 5,
  onUpdateSensorCount,
  mockLteSignal = -84,
  onSetMockLteSignal,
  mockLteAttached = true,
  onSetMockLteAttached,
  autoPoll = true,
  onToggleAutoPoll
}: CommandPanelProps) {
  // Master states for actions & screen routing
  const [activeAction, setActiveAction] = useState<'scan' | 'channels' | 'lte' | 'battery' | 'reboot' | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('');
  const [showRebootConfirm, setShowRebootConfirm] = useState<boolean>(false);

  // Background scanning state
  const [isScanningBackground, setIsScanningBackground] = useState<boolean>(false);
  const [hasScannedAtLeastOnce, setHasScannedAtLeastOnce] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [showProgressUI, setShowProgressUI] = useState<boolean>(false);

  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor terminal logs and real mode state to track scan progress nicely
  useEffect(() => {
    if (isScanningBackground) {
      setShowProgressUI(true);
      
      // Try to parse percentage from terminal logs (perfect for high-fidelity CLI emulator)
      const latestLogs = getLatestScanLogs();
      const percentMatch = latestLogs.match(/Progress:\s*\[.*?\]\s*(\d+)%/i);
      
      if (percentMatch) {
        const parsedPercent = parseInt(percentMatch[1], 10);
        setScanProgress(parsedPercent);
      } else {
        // Fallback smooth animation over 1500ms (ideal for real GATT mode or initial simulator state)
        const startTime = Date.now();
        const duration = 1500;
        
        const progressTimer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const ratio = Math.min(elapsed / duration, 0.99);
          setScanProgress((prev) => {
            const simulatedProgress = Math.round(ratio * 100);
            return Math.max(prev, simulatedProgress);
          });
        }, 30);
        
        return () => clearInterval(progressTimer);
      }
    } else {
      // When scan terminates, complete progress bar to 100%, then hide after a small delay
      if (showProgressUI) {
        setScanProgress(100);
        const hideTimer = setTimeout(() => {
          setShowProgressUI(false);
          setScanProgress(0);
        }, 800);
        return () => clearTimeout(hideTimer);
      }
    }
  }, [terminalLogs, isScanningBackground, showProgressUI]);

  // Monitor terminal logs to detect actual completed scan sequence
  useEffect(() => {
    if (isScanningBackground) {
      const latestScan = getLatestScanLogs();
      if (latestScan.includes('1-Wire scan sequence complete') || latestScan.includes('[OK]')) {
        setIsScanningBackground(false);
        setHasScannedAtLeastOnce(true);
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        // Automatically switch view to the channels report
        setActiveAction('channels');
      }
    }
  }, [terminalLogs, isScanningBackground]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Cloud Send Hold Button states
  const [cloudSendProgress, setCloudSendProgress] = useState<number>(0);
  const [isHoldingCloudSend, setIsHoldingCloudSend] = useState<boolean>(false);
  const [isCloudSendComplete, setIsCloudSendComplete] = useState<boolean>(false);
  const cloudSendTimerRef = useRef<number | null>(null);
  const cloudSendStartTimeRef = useRef<number>(0);

  const startHoldingCloudSend = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isCloudSendComplete) return;
    setIsHoldingCloudSend(true);
    setCloudSendProgress(0);
    cloudSendStartTimeRef.current = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - cloudSendStartTimeRef.current;
      const currentProgress = Math.min((elapsed / 1000) * 100, 100);
      setCloudSendProgress(currentProgress);

      if (currentProgress < 100) {
        cloudSendTimerRef.current = requestAnimationFrame(updateProgress);
      } else {
        // Finished holding 1 second!
        onRunCommand(' send ');
        setIsCloudSendComplete(true);
        setIsHoldingCloudSend(false);
        setCloudSendProgress(0);
        
        // Auto-hide success popup after 2.5 seconds
        setTimeout(() => {
          setIsCloudSendComplete(false);
        }, 2500);
      }
    };

    cloudSendTimerRef.current = requestAnimationFrame(updateProgress);
  };

  const stopHoldingCloudSend = () => {
    setIsHoldingCloudSend(false);
    setCloudSendProgress(0);
    if (cloudSendTimerRef.current) {
      cancelAnimationFrame(cloudSendTimerRef.current);
      cloudSendTimerRef.current = null;
    }
  };

  // Cleanup cloud send hold timer on unmount
  useEffect(() => {
    return () => {
      if (cloudSendTimerRef.current) {
        cancelAnimationFrame(cloudSendTimerRef.current);
      }
    };
  }, []);

  // Scan Hold Button states
  const [scanHoldProgress, setScanHoldProgress] = useState<number>(0);
  const [isHoldingScan, setIsHoldingScan] = useState<boolean>(false);
  const scanHoldTimerRef = useRef<number | null>(null);
  const scanHoldStartTimeRef = useRef<number>(0);

  const startHoldingScan = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isScanningBackground) return;
    setIsHoldingScan(true);
    setScanHoldProgress(0);
    scanHoldStartTimeRef.current = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - scanHoldStartTimeRef.current;
      // 800ms of hold duration for an immediate, tactile response
      const currentProgress = Math.min((elapsed / 800) * 100, 100);
      setScanHoldProgress(currentProgress);

      if (currentProgress < 100) {
        scanHoldTimerRef.current = requestAnimationFrame(updateProgress);
      } else {
        // Finished holding! Trigger the physical 1-Wire scan
        handleScanClick();
        setIsHoldingScan(false);
        setScanHoldProgress(0);
      }
    };

    scanHoldTimerRef.current = requestAnimationFrame(updateProgress);
  };

  const stopHoldingScan = () => {
    setIsHoldingScan(false);
    setScanHoldProgress(0);
    if (scanHoldTimerRef.current) {
      cancelAnimationFrame(scanHoldTimerRef.current);
      scanHoldTimerRef.current = null;
    }
  };

  // Cleanup scan hold timer on unmount
  useEffect(() => {
    return () => {
      if (scanHoldTimerRef.current) {
        cancelAnimationFrame(scanHoldTimerRef.current);
      }
    };
  }, []);

  // Helper to extract the last response for a scan command from logs
  const getLatestScanLogs = () => {
    const scanLogs = terminalLogs.filter(log => {
      const text = (log.response || '').toLowerCase();
      const command = (log.command || '').toLowerCase();
      return command.includes('scan') || text.includes('scanning') || text.includes('found');
    });
    if (scanLogs.length === 0) return '';
    return scanLogs[scanLogs.length - 1].response || '';
  };

  // Helper to combine responses starting from the last matched command
  const getCombinedLogsForCommand = (targetCommand: string, responseKeywords: string[]) => {
    // 1. Find the index of the last user-sent log matching targetCommand
    let cmdIndex = -1;
    for (let i = terminalLogs.length - 1; i >= 0; i--) {
      const log = terminalLogs[i];
      const cmd = (log.command || '').toLowerCase().trim();
      if (log.isUser && (cmd === targetCommand.toLowerCase().trim() || (targetCommand.toLowerCase() === 'lte state' && (cmd === 'lte' || cmd === 'lte_state')))) {
        cmdIndex = i;
        break;
      }
    }

    if (cmdIndex === -1) {
      // Fallback: filter lines containing any responseKeywords and join them
      const matchedLogs = terminalLogs.filter(log => {
        const resp = (log.response || '').toLowerCase();
        return responseKeywords.some(keyword => resp.includes(keyword.toLowerCase()));
      });
      if (matchedLogs.length === 0) return '';
      return matchedLogs.map(l => l.response || '').join('\n');
    }

    // Accumulate response: starting with the command's own response (for simulator)
    let combinedResponse = terminalLogs[cmdIndex].response || '';
    
    // Add all subsequent non-user responses (for real BLE stream line-by-line arrival)
    for (let i = cmdIndex + 1; i < terminalLogs.length; i++) {
      const log = terminalLogs[i];
      if (log.isUser && log.command) {
        break; // Stop when we hit the next user command
      }
      if (log.response) {
        combinedResponse += '\n' + log.response;
      }
    }

    return combinedResponse;
  };

  // Helper to extract the last response for an LTE state command
  const getLatestLteLogs = () => {
    return getCombinedLogsForCommand('lte state', ['attached:', 'rsrp:', 'cereg:']);
  };

  const parseLteState = () => {
    if (mode === 'real' && lte) {
      const isAttached = lte.state === 'Connected';
      const registration = lte.state === 'Connected' ? 'registered' : 'searching';
      const rsrp = lte.rsrp;
      const rsrq = lte.rsrq;
      const snr = 13;
      const band = 12;
      const ecl = isAttached ? 0 : 2;

      const onlineStatus = isAttached ? `Online (${registration})` : 'Offline / Disconnected';
      
      let rsrpDesc = 'Excellent';
      if (rsrp <= -110) rsrpDesc = 'Poor / Marginal';
      else if (rsrp <= -100) rsrpDesc = 'Weak';
      else if (rsrp <= -90) rsrpDesc = 'Fair';
      else if (rsrp <= -80) rsrpDesc = 'Good';
      const signalStrengthText = isAttached ? `${rsrpDesc} (${rsrp} dBm)` : 'No Signal (Offline)';
      
      let rsrqDesc = 'Excellent';
      if (rsrq <= -15) rsrqDesc = 'Poor';
      else if (rsrq <= -10) rsrqDesc = 'Fair';
      else if (rsrq <= -5) rsrqDesc = 'Good';
      const signalQualityText = isAttached ? `${rsrqDesc} (${rsrq} dB)` : 'N/A (Offline)';
      
      let snrDesc = 'Excellent';
      if (snr < 0) snrDesc = 'Noisy / Interrupted';
      else if (snr < 5) snrDesc = 'Weak';
      else if (snr < 12) snrDesc = 'Acceptable / Good';
      const noiseRatioText = isAttached ? `${snrDesc} (${snr} dB)` : 'N/A (Offline)';
      
      const technology = isAttached ? (lte.apn.includes('m2m') ? 'LTE-M (Low-Power IoT)' : 'NB-IoT') : 'None (Offline)';
      const bandText = isAttached ? `Band ${band} (Rural Long-Range)` : 'N/A';
      const coverageLevel = isAttached ? (ecl === 0 ? 'Optimal (ECL 0)' : `Extended Coverage (ECL ${ecl})`) : 'N/A';

      return {
        isOnline: isAttached,
        onlineStatus,
        signalStrengthText,
        signalQualityText,
        noiseRatioText,
        technology,
        bandText,
        coverageLevel,
        rsrp,
        rsrq,
        snr,
        band,
        ecl
      };
    }

    const raw = getLatestLteLogs();
    
    // Default fallback values
    let isAttached = true;
    let registration = 'registered roaming';
    let lteMode = 'lte-m';
    let rsrp = -84;
    let rsrq = -9;
    let snr = 13;
    let band = 12;
    let ecl = 0;
    
    if (raw) {
      // attached: yes
      const attachedMatch = raw.match(/attached:\s*(\w+)/i);
      if (attachedMatch) {
        isAttached = attachedMatch[1].toLowerCase() === 'yes';
      }
      
      // cereg: registered roaming
      const ceregMatch = raw.match(/cereg:\s*([^\r\n]+)/i);
      if (ceregMatch) {
        registration = ceregMatch[1].trim();
      }
      
      // mode: lte-m
      const modeMatch = raw.match(/mode:\s*([^\r\n]+)/i);
      if (modeMatch) {
        lteMode = modeMatch[1].trim();
      }
      
      // rsrp: -101
      const rsrpMatch = raw.match(/rsrp:\s*([-\d]+)/i);
      if (rsrpMatch) {
        rsrp = parseInt(rsrpMatch[1], 10);
      }
      
      // rsrq: -9
      const rsrqMatch = raw.match(/rsrq:\s*([-\d]+)/i);
      if (rsrqMatch) {
        rsrq = parseInt(rsrqMatch[1], 10);
      }
      
      // snr: 13
      const snrMatch = raw.match(/snr:\s*([-\d]+)/i);
      if (snrMatch) {
        snr = parseInt(snrMatch[1], 10);
      }
      
      // band: 12
      const bandMatch = raw.match(/band:\s*([-\d]+)/i);
      if (bandMatch) {
        band = parseInt(bandMatch[1], 10);
      }
      
      // ecl: 0
      const eclMatch = raw.match(/ecl:\s*([-\d]+)/i);
      if (eclMatch) {
        ecl = parseInt(eclMatch[1], 10);
      }
    }
    
    // Convert to human-friendly simple language descriptions
    const onlineStatus = isAttached ? `Online (${registration})` : 'Offline / Disconnected';
    
    // RSRP: Signal strength interpretation (standard cellular ranges)
    let rsrpDesc = 'Excellent';
    if (rsrp <= -110) rsrpDesc = 'Poor / Marginal';
    else if (rsrp <= -100) rsrpDesc = 'Weak';
    else if (rsrp <= -90) rsrpDesc = 'Fair';
    else if (rsrp <= -80) rsrpDesc = 'Good';
    
    const signalStrengthText = isAttached ? `${rsrpDesc} (${rsrp} dBm)` : 'No Signal (Offline)';
    
    // RSRQ: Signal quality interpretation
    let rsrqDesc = 'Excellent';
    if (rsrq <= -15) rsrqDesc = 'Poor';
    else if (rsrq <= -10) rsrqDesc = 'Fair';
    else if (rsrq <= -5) rsrqDesc = 'Good';
    const signalQualityText = isAttached ? `${rsrqDesc} (${rsrq} dB)` : 'N/A (Offline)';
    
    // SNR: Signal-to-noise ratio
    let snrDesc = 'Excellent';
    if (snr < 0) snrDesc = 'Noisy / Interrupted';
    else if (snr < 5) snrDesc = 'Weak';
    else if (snr < 12) snrDesc = 'Acceptable / Good';
    const noiseRatioText = isAttached ? `${snrDesc} (${snr} dB)` : 'N/A (Offline)';
    
    // Tech mode
    const technology = isAttached ? (lteMode.toUpperCase() === 'LTE-M' ? 'LTE-M (Low-Power IoT)' : lteMode) : 'None (Offline)';
    
    // Operating Band
    const bandText = isAttached ? `Band ${band} (Rural Long-Range)` : 'N/A';
    
    // Coverage Enhancement Level
    const coverageLevel = isAttached ? (ecl === 0 ? 'Optimal (ECL 0)' : `Extended Coverage (ECL ${ecl})`) : 'N/A';

    return {
      isOnline: isAttached,
      onlineStatus,
      signalStrengthText,
      signalQualityText,
      noiseRatioText,
      technology,
      bandText,
      coverageLevel,
      rsrp,
      rsrq,
      snr,
      band,
      ecl
    };
  };

  // Helper to extract the last response for system command
  const getLatestSystemLogs = () => {
    return getCombinedLogsForCommand('system', ['battery voltage', 'line voltage', 'int temperature', 'cloud initialized']);
  };

  const parseBatteryState = () => {
    const raw = getLatestSystemLogs();
    if (!raw) {
      return {
        voltage: batteryVoltage,
        lineVoltage: 4.95
      };
    }

    let voltage = batteryVoltage;
    let lineVoltage = 4.95;

    // Extract "Battery voltage      : 4.09 V" or similar
    const batteryVoltageMatch = raw.match(/Battery\s*voltage\s*[:= ]*\s*(\d+(?:\.\d+)?)\s*(v|mv)/i);
    if (batteryVoltageMatch) {
      const val = parseFloat(batteryVoltageMatch[1]);
      const unit = batteryVoltageMatch[2].toLowerCase();
      voltage = unit === 'mv' ? val / 1000 : val;
    } else {
      // Fallback
      const vbatMatch = raw.match(/(?:vbat|battery|cell|bat)\s*[:= ]*\s*(\d+(?:\.\d+)?)\s*(v|mv)/i);
      if (vbatMatch) {
        const val = parseFloat(vbatMatch[1]);
        const unit = vbatMatch[2].toLowerCase();
        voltage = unit === 'mv' ? val / 1000 : val;
      }
    }

    // Extract "Line voltage        : 0.00 V" or similar
    const lineVoltageMatch = raw.match(/Line\s*voltage\s*[:= ]*\s*(\d+(?:\.\d+)?)\s*(v|mv)/i);
    if (lineVoltageMatch) {
      const val = parseFloat(lineVoltageMatch[1]);
      const unit = lineVoltageMatch[2].toLowerCase();
      lineVoltage = unit === 'mv' ? val / 1000 : val;
    } else {
      // Fallback
      const supplyMatch = raw.match(/(?:supply|line|vin|vbus|usb)\s*(?:voltage)?\s*[:= ]*\s*(\d+(?:\.\d+)?)\s*(v|mv)/i);
      if (supplyMatch) {
        const val = parseFloat(supplyMatch[1]);
        const unit = supplyMatch[2].toLowerCase();
        lineVoltage = unit === 'mv' ? val / 1000 : val;
      }
    }

    return { voltage, lineVoltage };
  };

  // Handlers
  const handleScanClick = () => {
    setIsScanningBackground(true);
    onRunCommand('scan');
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    
    // Safety fallback of 25 seconds in case of BLE stream stalling
    scanTimeoutRef.current = setTimeout(() => {
      setIsScanningBackground(false);
      setHasScannedAtLeastOnce(true);
    }, 25000);
  };

  const handleChannelsClick = () => {
    setActiveAction('channels');
    setIsLoading(true);
    setLoadingText('Querying channels status (command: channels)...');
    onRunCommand('channels');
    
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  const handleLteState = () => {
    setActiveAction('lte');
    setLoadingText('Querying LTE modem parameters (command: lte state)...');
    setIsLoading(true);
    onRunCommand('lte state');
    
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  const handleBatteryLevel = () => {
    setActiveAction('battery');
    setLoadingText('Measuring battery & line voltage (command: system)...');
    setIsLoading(true);
    onRunCommand('system');
    
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  const handleDownloadConfig = () => {
    setIsLoading(true);
    setLoadingText('Querying config from Chester (command: config show)...');
    onRunCommand('config show');
    
    setTimeout(() => {
      setIsLoading(false);
      // Find the latest response to 'config show' in terminalLogs
      const configLogs = terminalLogs.filter(log => 
        (log.command || '').toLowerCase().includes('config show') ||
        (log.response || '').toLowerCase().includes('config')
      );
      
      let reportText = '';
      if (configLogs.length > 0) {
        reportText = configLogs[configLogs.length - 1].response || '';
      }
      
      if (!reportText) {
        // Generate a clean installer report of current bin configuration state if no live output is yet present
        reportText = `==================================================
GRAINLINK CHESTER CONFIGURATION SHOW REPORT
==================================================
Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} (UTC)
Installer: ${config.installerName || 'N/A'}
Bin Identifier: ${config.binId || 'Unspecified'}
==================================================

[DEVICE INFORMATION]
Device ID: Chester Gateway (2161112345)
Firmware: GrainLink-Chester-v2.12
Zephyr RTOS Build: Zephyr OS v3.2.0

[COMMUNICATION PARAMETERS]
Modem State: Connected (LTE-M)
APN Carrier: Telus / Bell
APN Name: m2m.grainlink.iot

[HARDWARE HEALTH STATE]
Battery: ${batteryVoltage.toFixed(2)}V (${batteryPercent}%)
Power Status: Optimal

[CONNECTED CHANNELS REPORT]
Channel A1 (DS18B20 1-Wire): 10 sensors mapped (Good)
Channel A2 (DS18B20 1-Wire): 6 sensors mapped (Good)
Channel A3 (DS18B20 1-Wire): 5 sensors mapped (Good)
Channel A4 (DS18B20 1-Wire): 1 sensors mapped (Good)
Channel A5 (DS18B20 1-Wire): 0 sensors mapped (Fault)
Channel A6 (DS18B20 1-Wire): 2 sensors mapped (Good)
Channel A7 (DS18B20 1-Wire): 3 sensors mapped (Good)
Channel A8 (DS18B20 1-Wire): 4 sensors mapped (Good)
Channels B1-B8: 0 sensors mapped (Uninstalled)

==================================================
END OF INSTALLATION REPORT
==================================================`;
      }

      const blob = new Blob([reportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chester_config_report_${config.binId || '2161112345'}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 2500);
  };

  const handleRebootChester = () => {
    setShowRebootConfirm(true);
  };

  const executeRebootChester = () => {
    setShowRebootConfirm(false);
    setActiveAction('reboot');
    setLoadingText('Transmitting system reset sequence (command: kernel reboot cold)...');
    setIsLoading(true);
    onRunCommand('kernel reboot cold');
    
    setTimeout(() => {
      setIsLoading(false);
      onDisconnect();
      setActiveAction(null);
    }, 3000);
  };

  const handleBack = () => {
    setActiveAction(null);
    setIsLoading(false);
  };

  // Robust, clean, non-technical channel parser matching:
  // Channel 1 = A1, Channel 2 = A2, ..., Channel 16 = B8
  const parseInstallerChannels = () => {
    const channelMapping: { [key: number]: string } = {
      1: 'A1', 2: 'A2', 3: 'A3', 4: 'A4', 5: 'A5', 6: 'A6', 7: 'A7', 8: 'A8',
      9: 'B1', 10: 'B2', 11: 'B3', 12: 'B4', 13: 'B5', 14: 'B6', 15: 'B7', 16: 'B8'
    };

    const parsed: { id: number; name: string; count: number; status: 'Good' | 'Fault' | 'Uninstalled' | 'Pending Scan' }[] = [];
    
    // Default channels layout
    for (let i = 1; i <= 16; i++) {
      parsed.push({
        id: i,
        name: channelMapping[i] || `CH${i}`,
        count: 0,
        status: mode === 'simulator' ? (i <= 8 ? 'Good' : 'Uninstalled') : 'Pending Scan'
      });
    }

    // Direct telemetry from channels prop if we are in real connection mode
    if (mode === 'real' && channels && channels.length > 0) {
      channels.forEach((ch) => {
        // Extract plain channel name (e.g. "A1" from "A1_1WIRE")
        const cleanName = ch.name.split('_')[0].toUpperCase();
        const match = parsed.find(p => p.name === cleanName);
        if (match) {
          match.count = ch.sensorCount;
          match.status = ch.status === 'ACTIVE'
            ? (ch.sensorCount > 0 ? 'Good' : 'Fault')
            : ch.status === 'ERROR'
            ? 'Fault'
            : 'Uninstalled';
        }
      });
    }

    // Only apply simulation default counts when connected via Simulator
    if (mode === 'simulator') {
      const distribution = Array(8).fill(0);
      for (let i = 0; i < simulatedSensorCount; i++) {
        distribution[i % 8]++;
      }

      const visualDefaults: { [key: string]: { count: number; status: 'Good' | 'Fault' | 'Uninstalled' | 'Pending Scan' } } = {};
      distribution.forEach((count, idx) => {
        const channelName = `A${idx + 1}`;
        visualDefaults[channelName] = {
          count: count,
          status: count > 0 ? 'Good' : 'Fault'
        };
      });

      for (const key in visualDefaults) {
        const p = parsed.find(item => item.name === key);
        if (p) {
          p.count = visualDefaults[key].count;
          p.status = visualDefaults[key].status;
        }
      }
    }

    // Live terminal log overrides (parses actual response logs like: "Channel 1 ------ 0 Devices -- State2  Fault 0")
    for (const log of terminalLogs) {
      const response = log.response || '';
      const lines = response.split('\n');
      for (const line of lines) {
        // High-tolerance parsing that extracts key-value pairs independently from each line
        let chId: number | null = null;
        const chIdMatch = line.match(/Channel\s*(\d+)/i) || line.match(/CH\s*(\d+)/i);
        
        if (chIdMatch) {
          chId = parseInt(chIdMatch[1], 10);
        } else {
          const nameMatch = line.match(/\b([A-B][1-8])\b/i);
          if (nameMatch) {
            const chName = nameMatch[1].toUpperCase();
            const foundEntry = Object.entries(channelMapping).find(([_, name]) => name === chName);
            if (foundEntry) {
              chId = parseInt(foundEntry[0], 10);
            }
          }
        }

        if (chId !== null) {
          const chName = channelMapping[chId] || `CH${chId}`;
          const item = parsed.find(p => p.name === chName);
          
          if (item) {
            // Extract count: look for any number followed by devices/sensors/nodes/devs/probes, or "found X"
            const countMatch = line.match(/(\d+)\s*(?:device|sensor|node|probe|dev)s?/i) || line.match(/Found\s*(\d+)/i);
            if (countMatch) {
              item.count = parseInt(countMatch[1], 10);
            }

            // Extract state: look for "State" followed by digits
            const stateMatch = line.match(/State\s*[: ]*\s*(\d+)/i);
            if (stateMatch) {
              const stateVal = parseInt(stateMatch[1], 10);
              if (stateVal === 0) {
                item.status = 'Uninstalled';
              } else {
                item.status = 'Good';
              }
            } else if (item.count > 0) {
              item.status = 'Good';
            }

            // Extract fault: look for "Fault" or "Faults" followed by digits
            const faultMatch = line.match(/Faults?\s*[: ]*\s*(\d+)/i);
            if (faultMatch) {
              const faultsVal = parseInt(faultMatch[1], 10);
              if (faultsVal > 0) {
                item.status = 'Fault';
              }
            }
          }
        }
      }
    }

    return parsed;
  };

  // Render detail action screen
  if (activeAction !== null) {
    const screenTitles = {
      scan: 'Scan Sensors',
      channels: 'Channels Report',
      lte: 'Cellular Report',
      battery: 'Internal Battery Metrics',
      reboot: 'System Hardware Control'
    };

    const isFullScreen = activeAction === 'channels' || activeAction === 'lte';

    return (
      <div className={`w-full flex flex-col space-y-5 animate-fade-in select-none ${
        isFullScreen 
          ? 'bg-transparent border-0 p-0 shadow-none' 
          : 'bg-white rounded-3xl border border-zinc-200 p-5'
      }`}>
        {/* Detail Screen Header */}
        <div className={`flex items-center justify-between border-b pb-3 ${
          isFullScreen ? 'border-zinc-200 px-2' : 'border-zinc-100'
        }`}>
          <button 
            onClick={handleBack}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-black font-bold text-xs cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-black" />
            <span>Back</span>
          </button>
          <span className="text-[10px] bg-black text-white font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {screenTitles[activeAction]}
          </span>
        </div>

        {/* Loading State Screen */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="w-10 h-10 text-black animate-spin" />
            <div className="text-center">
              <span className="font-sans font-black text-xs text-black uppercase tracking-widest block animate-pulse text-center">
                Getting Info...
              </span>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            
            {/* SCAN SCREEN (NEW ACTION) */}
            {activeAction === 'scan' && (
              <div className="space-y-5 text-left">
                <div className="text-center space-y-1">
                  <RefreshCw className="w-8 h-8 text-amber-500 mx-auto mb-1" />
                  <h4 className="font-sans font-black text-sm uppercase tracking-wide text-black">1-Wire Sensor Scan</h4>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider px-2">
                    Command 'scan' sent to Chester
                  </p>
                </div>

                <div className="bg-amber-50/75 border border-amber-200 rounded-2xl p-4 space-y-2">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">⚡ Hardware Scan Initiated</span>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    A physical 1-wire bus scan has been triggered on your Chester. The gateway searches all channels (A1–B8) to identify connected DS18B20 temperature probes.
                  </p>
                  <p className="text-[11px] text-zinc-700 leading-relaxed font-extrabold mt-1">
                    ⚠️ Having trouble finding your 10 sensors on A8?
                  </p>
                  <ul className="list-disc list-inside text-[11px] text-zinc-600 space-y-1 pl-1">
                    <li>Confirm that the wiring contacts inside the screw terminal block A8 are tight and making full metal-to-metal contact.</li>
                    <li>Ensure correct polarity (VCC, DQ, GND) for your 1-wire probes.</li>
                    <li>Wait about 5-10 seconds for the Chester hardware to finish discovery.</li>
                  </ul>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    onClick={handleScanClick}
                    className="flex-1 bg-black hover:bg-zinc-900 text-white font-black text-xs py-3.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 uppercase select-none"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                    <span>Scan Again</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveAction('channels');
                      handleChannelsClick();
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 uppercase select-none animate-pulse"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>View Report</span>
                  </button>
                </div>
              </div>
            )}

            {/* CHANNELS SCREEN (GETS CURRENT REPORT) */}
            {activeAction === 'channels' && (
              <div className="space-y-4">
                {/* Installer Tip Banner */}
                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-sans font-black text-blue-900 uppercase tracking-wider block">Installer Notice</span>
                    <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                      Initiate a <strong className="font-bold text-blue-900">SCAN</strong> to show new sensors in the channel list.
                    </p>
                  </div>
                </div>

                {/* Unified Compact Action Bar */}
                <div className="grid grid-cols-3 gap-2 bg-white border border-zinc-100 rounded-2xl p-1.5 shadow-xs animate-fade-in">
                  {/* Scan Button */}
                  <button
                    onClick={handleScanClick}
                    disabled={isScanningBackground}
                    className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-zinc-50 hover:bg-zinc-100 text-black border border-zinc-200 hover:border-black transition-all cursor-pointer disabled:opacity-50 select-none"
                  >
                    {isScanningBackground ? (
                      <div className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                        <span className="truncate text-amber-700 font-bold">Scanning...</span>
                      </div>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 text-zinc-600" />
                        <span className="truncate">Scan</span>
                      </>
                    )}
                  </button>

                  {/* Refresh Button */}
                  <button
                    onClick={handleChannelsClick}
                    disabled={isScanningBackground}
                    className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-zinc-50 hover:bg-zinc-100 text-black border border-zinc-200 hover:border-black transition-all cursor-pointer disabled:opacity-50 select-none"
                  >
                    <Layers className="w-3 h-3" />
                    <span className="truncate">Refresh</span>
                  </button>

                  {/* Send to Cloud Button */}
                  <button
                    onMouseDown={startHoldingCloudSend}
                    onMouseUp={stopHoldingCloudSend}
                    onMouseLeave={stopHoldingCloudSend}
                    onTouchStart={startHoldingCloudSend}
                    onTouchEnd={stopHoldingCloudSend}
                    disabled={isScanningBackground}
                    className="relative flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-zinc-50 hover:bg-zinc-100 text-black border border-zinc-200 hover:border-black transition-all cursor-pointer disabled:opacity-50 overflow-hidden select-none"
                  >
                    {isHoldingCloudSend && (
                      <div 
                        className="absolute left-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none" 
                        style={{ width: `${cloudSendProgress}%` }}
                      />
                    )}

                    {isCloudSendComplete ? (
                      <div className="absolute inset-0 bg-emerald-600 text-white flex items-center justify-center gap-1 rounded-xl font-bold text-[9px] uppercase tracking-wider animate-fade-in">
                        <Check className="w-2.5 h-2.5 text-white" />
                        <span>Sent!</span>
                      </div>
                    ) : (
                      <>
                        <Cloud className="w-3 h-3 text-zinc-600" />
                        <span className="truncate">
                          {isHoldingCloudSend ? 'Hold...' : 'Send Cloud'}
                        </span>
                      </>
                    )}

                    {isHoldingCloudSend && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-200 pointer-events-none">
                        <div 
                          className="h-full bg-emerald-500"
                          style={{ width: `${cloudSendProgress}%` }}
                        />
                      </div>
                    )}
                  </button>
                </div>

                {/* Smooth Progress Bar below Action Bar */}
                {showProgressUI && (
                  <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 space-y-2.5 animate-fade-in shrink-0">
                    <div className="flex items-center justify-between text-[10px] font-sans font-black uppercase tracking-wider text-zinc-500">
                      <span className="flex items-center gap-1.5 text-zinc-700">
                        {scanProgress < 100 ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span>{scanProgress < 100 ? "Scanning Channels..." : "Scan Complete"}</span>
                      </span>
                      <span className="font-mono text-zinc-900 font-extrabold">{scanProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-200/60 rounded-full overflow-hidden relative border border-zinc-200/30">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ease-out ${scanProgress === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 font-medium leading-normal">
                      {scanProgress < 100 
                        ? "Chester is actively querying 1-Wire sensor mappings."
                        : "Channel states updated successfully."}
                    </p>
                  </div>
                )}

                {!hasScannedAtLeastOnce && !(mode === 'real' && channels && channels.length > 0) ? (
                  <div className="bg-amber-50/75 border border-amber-200 rounded-2xl p-5 space-y-4 text-center">
                    <div className="flex justify-center">
                      <AlertTriangle className="w-8 h-8 text-amber-500" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider block">⚠️ Please Initiate a Scan First</span>
                      <p className="text-[11px] text-zinc-600 leading-relaxed max-w-xs mx-auto">
                        Chester must scan channels before it can provide a channel report
                      </p>
                    </div>
                    <button
                      onClick={handleScanClick}
                      disabled={isScanningBackground}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black text-xs py-3.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 uppercase select-none active:scale-98"
                    >
                      {isScanningBackground ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Scanning in progress...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Initiate Scan Now</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Zebra-striped borderless full-width channels list */}
                    <div className="w-full">
                      <div className="grid grid-cols-3 bg-zinc-100/85 border-y border-zinc-200 py-3.5 px-4 text-zinc-500 font-extrabold text-[10px] uppercase tracking-wider">
                        <span>Channel</span>
                        <span className="text-center">Sensor Count</span>
                        <span className="text-right">Channel State</span>
                      </div>

                      <div className="divide-y divide-zinc-200">
                        {parseInstallerChannels().map((ch, idx) => (
                          <div 
                            key={ch.name} 
                            className={`grid grid-cols-3 items-center py-4 px-4 text-xs ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/70'
                            }`}
                          >
                            <span className="font-black text-black text-left">{ch.name}</span>
                            <span className="font-extrabold text-zinc-500 text-center">
                              Sensors {ch.count}
                            </span>
                            <div className="flex justify-end">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                                ch.status === 'Good' 
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : ch.status === 'Fault'
                                  ? 'text-red-700 bg-red-50 border-red-200 animate-pulse'
                                  : ch.status === 'Pending Scan'
                                  ? 'text-amber-700 bg-amber-50 border-amber-200 animate-pulse'
                                  : 'text-zinc-400 bg-zinc-50 border-zinc-200'
                              }`}>
                                {ch.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Compact actions are now integrated into the top bar */}
                  </>
                )}

              </div>
            )}

            {/* LTE SCREEN */}
            {activeAction === 'lte' && (() => {
              const lteInfo = parseLteState();
              return (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center mx-auto mb-1">
                      <Wifi className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-sans font-black text-sm uppercase tracking-wide text-black">Cellular Report</h4>
                  </div>

                  <div className="flex justify-center">
                    <button
                      id="lte-refresh-btn"
                      onClick={handleLteState}
                      disabled={isLoading}
                      className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider bg-zinc-50 hover:bg-zinc-100 text-black border border-zinc-200 hover:border-black transition-all cursor-pointer disabled:opacity-50 select-none"
                    >
                      <RefreshCw className="w-3 h-3 text-zinc-600" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="divide-y divide-zinc-200 text-left w-full border-t border-b border-zinc-200">
                    <div className="flex justify-between items-center py-4 px-4 text-xs bg-white">
                      <span className="text-zinc-500 font-extrabold uppercase tracking-wider text-[10px]">Online Status</span>
                      <span className={`font-black uppercase tracking-wide border px-2.5 py-0.5 rounded-full text-[10px] ${
                        lteInfo.isOnline 
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                          : 'text-red-700 bg-red-50 border-red-200'
                      }`}>
                        {lteInfo.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-4 px-4 text-xs bg-zinc-50/70">
                      <span className="text-zinc-500 font-extrabold uppercase tracking-wider text-[10px]">Signal Strength</span>
                      <span className="text-black font-black">{lteInfo.signalStrengthText}</span>
                    </div>
                    <div className="flex justify-between items-center py-4 px-4 text-xs bg-white">
                      <span className="text-zinc-500 font-extrabold tracking-wider text-[10px]">Signal Quality</span>
                      <span className="text-zinc-700 font-black">{lteInfo.signalQualityText}</span>
                    </div>
                  </div>

                  {/* Interactive Simulator Controls inside LTE Screen */}
                  {mode === 'simulator' && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4.5 space-y-3 mt-4 text-left animate-fade-in">
                      <div className="flex items-center gap-2 mb-1">
                        <Sliders className="w-4 h-4 text-amber-700" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                          Simulator Controls
                        </span>
                      </div>
                      
                      {/* Connection Toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                          Cellular Network Attached
                        </span>
                        <button
                          onClick={() => {
                            if (onSetMockLteAttached) {
                              onSetMockLteAttached(!mockLteAttached);
                            }
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            mockLteAttached ? 'bg-amber-600' : 'bg-zinc-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              mockLteAttached ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Signal Strength Slider (only if attached) */}
                      {mockLteAttached && (
                        <div className="space-y-1 pt-1.5 border-t border-amber-200/50">
                          <div className="flex justify-between items-center text-[10px] font-bold text-amber-850">
                            <span className="uppercase tracking-wide">Simulate Signal (RSRP)</span>
                            <span>{mockLteSignal} dBm</span>
                          </div>
                          <input
                            type="range"
                            min="-115"
                            max="-60"
                            value={mockLteSignal}
                            onChange={(e) => {
                              if (onSetMockLteSignal) {
                                onSetMockLteSignal(parseInt(e.target.value, 10));
                              }
                            }}
                            className="w-full h-1.5 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-700 focus:outline-none"
                          />
                          <div className="flex justify-between text-[8px] text-amber-600/80 font-bold uppercase">
                            <span>Poor (-115)</span>
                            <span>Excellent (-60)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* BATTERY SCREEN */}
            {activeAction === 'battery' && (() => {
              const battInfo = parseBatteryState();
              return (
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center mx-auto mb-1">
                      <BatteryCharging className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <h4 className="font-sans font-black text-sm uppercase tracking-wide text-black">Battery Level</h4>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      Power Source Parameters
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <button
                      id="battery-refresh-btn"
                      onClick={handleBatteryLevel}
                      disabled={isLoading}
                      className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider bg-zinc-50 hover:bg-zinc-100 text-black border border-zinc-200 hover:border-black transition-all cursor-pointer disabled:opacity-50 select-none"
                    >
                      <RefreshCw className="w-3 h-3 text-zinc-600" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 divide-y divide-zinc-200 text-left">
                    <div className="flex justify-between items-center py-3 text-xs">
                      <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Battery Voltage</span>
                      <span className="text-black font-extrabold">{battInfo.voltage.toFixed(2)} V</span>
                    </div>
                    <div className="flex justify-between items-center py-3 text-xs">
                      <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Line Voltage</span>
                      <span className="text-black font-extrabold">{battInfo.lineVoltage.toFixed(2)} V</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // Otherwise, render main dashboard view
  return (
    <div id="quick-actions-panel" className="select-none text-black w-full flex flex-col space-y-4 animate-fade-in">
      
      {/* Vertically Stacked List of Actions */}
      <div className="flex flex-col gap-3">
        
        {/* BUTTON 1: Channels */}
        <button
          id="action-channels-btn"
          onClick={handleChannelsClick}
          disabled={isScanningBackground}
          className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-black rounded-2xl p-4 flex items-center justify-between text-left transition-all hover:shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-black text-white border border-black shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-black text-xs uppercase tracking-wider text-black">Channels Overview</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5 font-bold uppercase tracking-wider">
                {hasScannedAtLeastOnce ? "Receive channel overview" : "Please initiate a scan first"}
              </p>
            </div>
          </div>
        </button>

        {/* BUTTON 2: LTE State */}
        <button
          id="action-lte-btn"
          onClick={handleLteState}
          disabled={isScanningBackground || isLoading}
          className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-black rounded-2xl p-4 flex items-center justify-between text-left transition-all hover:shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-zinc-100 border border-zinc-200 shadow-xs flex items-center justify-center shrink-0">
              <Wifi className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="font-sans font-black text-xs uppercase tracking-wider text-black">Chester Connectivity</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5 font-bold uppercase tracking-wider">verify connectivity</p>
            </div>
          </div>
        </button>

        {/* BUTTON 3: Battery Level */}
        <button
          id="action-battery-btn"
          onClick={handleBatteryLevel}
          disabled={isScanningBackground || isLoading}
          className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-black rounded-2xl p-4 flex items-center justify-between text-left transition-all hover:shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-zinc-100 text-zinc-800 border border-zinc-200 shadow-xs">
              <Battery className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="font-sans font-black text-xs uppercase tracking-wider text-black">Battery Level</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5 font-bold uppercase tracking-wider">check battery and Line voltage</p>
            </div>
          </div>
        </button>

        {/* BUTTON: Download Config File */}
        <button
          id="action-download-config-btn"
          onClick={handleDownloadConfig}
          disabled={isScanningBackground || isLoading}
          className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-black rounded-2xl p-4 flex items-center justify-between text-left transition-all hover:shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-zinc-100 text-zinc-800 border border-zinc-200 shadow-xs">
              <Download className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="font-sans font-black text-xs uppercase tracking-wider text-black">Download Report</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5 font-bold uppercase tracking-wider">save Chester configurations</p>
            </div>
          </div>
        </button>

        {/* BUTTON 4: Reboot Chester */}
        <button
          id="action-reboot-btn"
          onClick={handleRebootChester}
          disabled={isScanningBackground || isLoading}
          className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-red-500 rounded-2xl p-4 flex items-center justify-between text-left transition-all hover:shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-50 text-red-600 border border-red-100 shadow-xs">
              <RefreshCw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-sans font-black text-xs uppercase tracking-wider text-red-600">Reboot Chester</h3>
              <p className="text-[10px] text-red-400 mt-0.5 font-bold uppercase tracking-wider">reboot and disconnect from Chester</p>
            </div>
          </div>
        </button>

      </div>

      {/* Reboot Confirmation Modal */}
      {showRebootConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1.5">
              <h4 className="font-sans font-black text-xs uppercase tracking-wider text-black">Confirm Reboot</h4>
              <p className="text-[10px] text-zinc-500 leading-relaxed font-bold uppercase tracking-wide">
                Are you sure you want to cold-reboot Chester? This will disconnect you from the device.
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setShowRebootConfirm(false)}
                className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-black text-[10px] py-3 rounded-xl border border-zinc-200 uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeRebootChester}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] py-3 rounded-xl border border-red-700 uppercase tracking-wider shadow-xs transition-all cursor-pointer"
              >
                Reboot
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
