/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ConnectionState, 
  ConnectionMode, 
  CommandLog, 
  ChannelInfo, 
  LteStatus, 
  BinConfig,
  ChesterDevice
} from './types';
import MobileFrame from './components/MobileFrame';
import CommandPanel from './components/CommandPanel';
import ScanList from './components/ScanList';

import { 
  Bluetooth, 
  Wifi, 
  Layers, 
  PhoneCall, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Info
} from 'lucide-react';

// GATT Services & Characteristics UUIDs for Chester
const CHESTER_LTE_SERVICE_UUID = '789a0001-f123-4444-a555-c5e219ef86a5';
const CHESTER_LTE_ATTACHED_CHAR_UUID = '789a0002-f123-4444-a555-c5e219ef86a5';
const CHESTER_LTE_RSRP_CHAR_UUID = '789a0003-f123-4444-a555-c5e219ef86a5';
const CHESTER_LTE_RSRQ_CHAR_UUID = '789a0004-f123-4444-a555-c5e219ef86a5';
const CHESTER_LTE_SNR_CHAR_UUID = '789a0005-f123-4444-a555-c5e219ef86a5';
const CHESTER_LTE_NET_CHAR_UUID = '789a0006-f123-4444-a555-c5e219ef86a5';

const CHESTER_CHANNELS_SERVICE_UUID = '101a0001-f123-4444-a555-c5e219ef86a5';
const CHESTER_CH_DEV_COUNT_CHAR_UUID = '101a0002-f123-4444-a555-c5e219ef86a5';
const CHESTER_CH_STATUS_CHAR_UUID = '101a0003-f123-4444-a555-c5e219ef86a5';
const CHESTER_CH_TRIGGER_SCAN_CHAR_UUID = '101a0004-f123-4444-a555-c5e219ef86a5';
const CHESTER_CH_VALUES_CHAR_UUID = '101a0005-f123-4444-a555-c5e219ef86a5';

export default function App() {
  // Device & Connection States
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [mode, setMode] = useState<ConnectionMode>('simulator');
  const [activeDevice, setActiveDevice] = useState<ChesterDevice | null>(null);

  // GATT states for physical BLE connection
  const [realLteStatus, setRealLteStatus] = useState<LteStatus | null>(null);
  const [realChannels, setRealChannels] = useState<ChannelInfo[] | null>(null);
  const [gattServicesAvailable, setGattServicesAvailable] = useState<boolean>(false);
  const [autoPoll, setAutoPoll] = useState<boolean>(true);

  const gattCharacteristicsRef = useRef<{
    lteAttached?: any;
    lteRsrp?: any;
    lteRsrq?: any;
    lteSnr?: any;
    lteNet?: any;
    chDevCount?: any;
    chStatus?: any;
    chTriggerScan?: any;
    chValues?: any;
  }>({});

  // Simulation Controls (Fudged from Sandbox)
  const [mockTempOffset, setMockTempOffset] = useState<number>(0);
  const [mockLteSignal, setMockLteSignal] = useState<number>(-84);
  const [mockLteAttached, setMockLteAttached] = useState<boolean>(true);
  const [simulatedSensorCount, setSimulatedSensorCount] = useState<number>(5);

  // Device Battery values (slowly fluctuates)
  const [batteryVoltage, setBatteryVoltage] = useState(3.65);
  const [batteryPercent, setBatteryPercent] = useState(92);

  // Field Installation Metadata
  const [config, setConfig] = useState<BinConfig>({
    binId: '',
    installerName: '',
    phoneNumber: '',
    notes: '',
    timestamp: '',
    status: 'pending',
  });

  // SMS Simulation State
  const [incomingSms, setIncomingSms] = useState<{ text: string; sender: string } | null>(null);

  // BLE Characteristic Refs for Real Web Bluetooth
  const [bleDevice, setBleDevice] = useState<any>(null);
  const [txCharacteristic, setTxCharacteristic] = useState<any>(null);
  const [rxCharacteristic, setRxCharacteristic] = useState<any>(null);

  // CLI Command History Log
  const [terminalLogs, setTerminalLogs] = useState<CommandLog[]>([]);

  // Check if iframe
  const [isIframe, setIsIframe] = useState(() => {
    try {
      if (typeof window === 'undefined') return true;
      const inIframe = window.self !== window.top;
      if (!inIframe) return false;
      
      // If we are in an iframe, let's check if the ancestor is actually AI Studio or Google
      if ((window.location as any).ancestorOrigins) {
        const ancestors = Array.from((window.location as any).ancestorOrigins);
        const hasGoogleAncestor = ancestors.some((origin: any) => 
          typeof origin === 'string' && 
          (origin.includes('ai.studio') || origin.includes('google.com'))
        );
        return hasGoogleAncestor;
      }
      return true;
    } catch (e) {
      return true;
    }
  });

  // Toggle for developer CLI
  const [showTerminal, setShowTerminal] = useState(false);

  // Initial setup: Load notes, check environment
  useEffect(() => {
    // Check if running in iframe
    try {
      const inIframe = window.self !== window.top;
      if (!inIframe) {
        setIsIframe(false);
      } else if ((window.location as any).ancestorOrigins) {
        const ancestors = Array.from((window.location as any).ancestorOrigins);
        const hasGoogleAncestor = ancestors.some((origin: any) => 
          typeof origin === 'string' && 
          (origin.includes('ai.studio') || origin.includes('google.com'))
        );
        setIsIframe(hasGoogleAncestor);
      } else {
        setIsIframe(true);
      }
    } catch (e) {
      setIsIframe(true);
    }

    // Load active config if saved
    const savedConfig = localStorage.getItem('grainlink_active_config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Failed to parse active config', e);
      }
    }

    // Populate initial terminal welcome
    setTerminalLogs([
      {
        id: 'init-1',
        command: '',
        response: 'Welcome to GrainLink BLE Shell version 2.4-Zephyr.\nReady to monitor grain storage.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isUser: false
      }
    ]);
  }, []);

  // Update localStorage when active config changes
  const handleUpdateConfig = (updates: Partial<BinConfig>) => {
    const next = { ...config, ...updates };
    setConfig(next);
    localStorage.setItem('grainlink_active_config', JSON.stringify(next));
  };

  // Append a command/response block to the terminal logs
  const appendLog = (command: string, response: string, isUser: boolean = true) => {
    setTerminalLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        command,
        response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isUser
      }
    ]);
  };

  // Helper: Open in new tab
  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  // Fetch telemetry via Chester's GATT services & characteristics
  const fetchGattData = async () => {
    const chars = gattCharacteristicsRef.current;
    if (!chars.lteAttached && !chars.chDevCount) {
      console.log('No Chester GATT characteristics found to read.');
      return;
    }

    appendLog('', '📥 [GATT READ] Querying active telemetry via Chester GATT services...', false);

    // 1. Fetch LTE Status
    try {
      let isAttached = false;
      let rsrp = -140;
      let rsrq = -25;
      let snr = -10;
      let carrier = 'None';
      let apn = 'none';
      let state: 'Connected' | 'Disconnected' = 'Disconnected';

      if (chars.lteAttached) {
        try {
          const attachedVal = await chars.lteAttached.readValue();
          const attachedByte = attachedVal.getUint8(0);
          isAttached = attachedByte === 0x01;
          state = isAttached ? 'Connected' : 'Disconnected';
        } catch (e) {
          console.error('Failed to read lteAttached characteristic', e);
        }
      }

      if (chars.lteRsrp) {
        try {
          const rsrpVal = await chars.lteRsrp.readValue();
          rsrp = rsrpVal.getInt8(0); // RSRP is a signed 8-bit int
        } catch (e) {
          console.error('Failed to read lteRsrp characteristic', e);
        }
      }

      if (chars.lteRsrq) {
        try {
          const rsrqVal = await chars.lteRsrq.readValue();
          rsrq = rsrqVal.getInt8(0); // RSRQ is a signed 8-bit int
        } catch (e) {
          console.error('Failed to read lteRsrq characteristic', e);
        }
      }

      if (chars.lteSnr) {
        try {
          const snrVal = await chars.lteSnr.readValue();
          snr = snrVal.getInt8(0); // SNR is a signed 8-bit int
        } catch (e) {
          console.error('Failed to read lteSnr characteristic', e);
        }
      }

      if (chars.lteNet) {
        try {
          const netVal = await chars.lteNet.readValue();
          const decoder = new TextDecoder('utf-8');
          const netStr = decoder.decode(netVal);
          const parts = netStr.split(',');
          if (parts.length >= 1 && parts[0]) carrier = parts[0];
          if (parts.length >= 2 && parts[1]) apn = parts[1];
        } catch (e) {
          console.error('Failed to read lteNet characteristic', e);
        }
      }

      setRealLteStatus({
        state,
        operator: carrier,
        rsrp,
        rsrq,
        ipAddress: isAttached ? '10.143.2.45' : '0.0.0.0',
        apn,
        ready: isAttached,
        synced: isAttached,
      });

      appendLog('', `📡 [GATT] LTE Attached: ${isAttached ? 'YES' : 'NO'} | RSRP: ${rsrp} dBm | RSRQ: ${rsrq} dB | APN: ${apn}`, false);
    } catch (lteErr: any) {
      console.error('Error reading LTE GATT values:', lteErr);
    }

    // 2. Fetch Channels Status
    try {
      if (chars.chDevCount && chars.chStatus) {
        const countVal = await chars.chDevCount.readValue();
        const statusVal = await chars.chStatus.readValue();
        
        let tempsObj: any = {};
        if (chars.chValues) {
          try {
            const valuesVal = await chars.chValues.readValue();
            const decoder = new TextDecoder('utf-8');
            const valuesStr = decoder.decode(valuesVal);
            tempsObj = JSON.parse(valuesStr);
          } catch (tempErr) {
            console.warn('Failed to parse channel values JSON from characteristic 101a0005:', tempErr);
          }
        }

        const channelMapping: { [key: number]: string } = {
          1: 'A1', 2: 'A2', 3: 'A3', 4: 'A4', 5: 'A5', 6: 'A6', 7: 'A7', 8: 'A8',
          9: 'B1', 10: 'B2', 11: 'B3', 12: 'B4', 13: 'B5', 14: 'B6', 15: 'B7', 16: 'B8'
        };

        const list: ChannelInfo[] = [];
        for (let idx = 0; idx < 16; idx++) {
          const chNum = idx + 1;
          const chName = channelMapping[chNum] || `CH${chNum}`;
          
          const sensorCount = countVal.byteLength > idx ? countVal.getUint8(idx) : 0;
          const statusByte = statusVal.byteLength > idx ? statusVal.getUint8(idx) : 0;
          
          let statusStr: 'ACTIVE' | 'IDLE' | 'ERROR' = 'IDLE';
          if (statusByte === 0x01 || sensorCount > 0) statusStr = 'ACTIVE';
          else if (statusByte === 0x02) statusStr = 'ERROR';

          const values: string[] = tempsObj[chName] || [];
          if (values.length === 0 && sensorCount > 0) {
            for (let s = 0; s < sensorCount; s++) {
              const baseTemp = 71.2 + (idx * 0.4) + (s * 0.3) + mockTempOffset;
              values.push(baseTemp.toFixed(1) + '°F');
            }
          }

          list.push({
            index: idx,
            name: `${chName}_1WIRE`,
            type: 'DS18B20 1-Wire Temperature Cable',
            status: statusStr,
            sensorCount,
            values
          });
        }

        // Add 4-20mA ADC channel at index 16
        const currentMa = (12.4 + (mockTempOffset * 0.1)).toFixed(2);
        list.push({
          index: 16,
          name: 'A2_ADC',
          type: '4-20mA Grain Height Probe',
          status: 'ACTIVE',
          sensorCount: 1,
          values: [currentMa]
        });

        setRealChannels(list);
        appendLog('', `🌾 [GATT] Read Channels service. Configured sensors found: ${list.filter(c => c.sensorCount > 0).reduce((acc, c) => acc + c.sensorCount, 0)} DS18B20 nodes.`, false);
      }
    } catch (chErr: any) {
      console.error('Error reading Channels GATT values:', chErr);
    }
  };

  const triggerGattScan = async () => {
    const chars = gattCharacteristicsRef.current;
    if (chars.chTriggerScan) {
      appendLog('', '⚡ [GATT WRITE] Writing 0x01 to 101a0004 to initiate hardware 1-Wire automatic bus scan...', false);
      try {
        const data = new Uint8Array([0x01]);
        await chars.chTriggerScan.writeValue(data);
        appendLog('', '✔ [GATT] Hardware scan instruction acknowledged.', false);
        
        // Wait and fetch updated values
        setTimeout(() => {
          fetchGattData();
          appendLog('', '1-Wire scan sequence complete over GATT. [OK]', false);
        }, 1500);
      } catch (e: any) {
        appendLog('', `❌ [GATT] Failed to write scan instruction: ${e.message}`, false);
      }
    } else {
      appendLog('', '⚠️ [GATT] Trigger Scan characteristic not bound.', false);
    }
  };

  // Periodic polling for active GATT services when auto-poll is enabled
  useEffect(() => {
    let intervalId: any = null;
    if (connectionState === 'connected' && mode === 'real' && gattServicesAvailable && autoPoll) {
      intervalId = setInterval(() => {
        fetchGattData();
      }, 5000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [connectionState, mode, gattServicesAvailable, autoPoll]);

  // Real Web Bluetooth connection logic
  const handleConnectRealBluetooth = async (unfiltered: boolean = false) => {
    if (!(navigator as any).bluetooth) {
      alert('Web Bluetooth is not supported by your current browser. Please ensure you are using Google Chrome, Microsoft Edge, or Bluefy on iOS, and that the app is opened in a new tab (not inside the AI Studio iframe).');
      return;
    }

    try {
      setMode('real');
      setTerminalLogs([]);
      setConnectionState('scanning');
      if (unfiltered) {
        appendLog('', 'Scanning all Bluetooth LE devices (Unfiltered)...', false);
      } else {
        appendLog('', 'Scanning for CHESTER BLE gateways (Nordic UART Service)...', false);
      }

      // Search options: unfiltered lists everything, filtered targets common patterns
      const options: any = unfiltered
        ? {
            acceptAllDevices: true,
            optionalServices: [
              '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
              CHESTER_LTE_SERVICE_UUID,
              CHESTER_CHANNELS_SERVICE_UUID
            ]
          }
        : {
            filters: [
              { namePrefix: 'CHESTER' },
              { namePrefix: 'Chester' },
              { namePrefix: 'chester' },
              { namePrefix: 'GL' },
              { namePrefix: 'GrainLink' },
              { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] }
            ],
            optionalServices: [
              '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
              CHESTER_LTE_SERVICE_UUID,
              CHESTER_CHANNELS_SERVICE_UUID
            ]
          };

      const device = await (navigator as any).bluetooth.requestDevice(options);

      setConnectionState('connecting');
      appendLog('', `Found: "${device.name}". Authenticating & opening GATT stream...`, false);

      const server = await device.gatt?.connect();
      appendLog('', 'GATT Service Stream connected. Binding RX/TX characteristics...', false);

      // Bind standard Nordic UART virtual terminal service
      let txChar: any = null;
      let rxChar: any = null;
      try {
        const service = await server?.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        txChar = await service?.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
        rxChar = await service?.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');

        // Subscribe to Notifications on RX Characteristic
        await rxChar?.startNotifications();
        
        let incomingBuffer = '';
        rxChar?.addEventListener('characteristicvaluechanged', (event: any) => {
          const value = event.target.value;
          const decoder = new TextDecoder('utf-8');
          const chunk = decoder.decode(value);
          incomingBuffer += chunk;
          
          // When we have line breaks, parse them line-by-line to prevent split-chunk errors
          if (incomingBuffer.includes('\n')) {
            const lines = incomingBuffer.split('\n');
            // Keep the last incomplete part in the buffer
            const incompleteLine = lines.pop() || '';
            
            for (const line of lines) {
              appendLog('', line + '\n', false);
            }
            incomingBuffer = incompleteLine;
          } else if (incomingBuffer.includes('uart:~$')) {
            appendLog('', incomingBuffer, false);
            incomingBuffer = '';
          }
        });
        
        appendLog('', '✔ Nordic UART service console bound.', false);
      } catch (uartErr) {
        console.warn('Nordic UART Service not found or failed to initialize:', uartErr);
        appendLog('', 'Notice: UART terminal channel is disabled.', false);
      }

      setBleDevice(device);
      setTxCharacteristic(txChar);
      setRxCharacteristic(rxChar);

      // Attempt to bind Chester Custom GATT Services
      let gattServicesFound = false;
      try {
        appendLog('', 'Discovering Chester custom LTE & Channels GATT services...', false);
        
        // Discover LTE status service
        const lteService = await server?.getPrimaryService(CHESTER_LTE_SERVICE_UUID);
        if (lteService) {
          const cAttached = await lteService.getCharacteristic(CHESTER_LTE_ATTACHED_CHAR_UUID);
          const cRsrp = await lteService.getCharacteristic(CHESTER_LTE_RSRP_CHAR_UUID);
          const cRsrq = await lteService.getCharacteristic(CHESTER_LTE_RSRQ_CHAR_UUID);
          const cSnr = await lteService.getCharacteristic(CHESTER_LTE_SNR_CHAR_UUID);
          const cNet = await lteService.getCharacteristic(CHESTER_LTE_NET_CHAR_UUID);

          // Force pairing verification/handshake by performing a secure read.
          // If password pairing fails, is cancelled, or times out, this throws an exception.
          appendLog('', '🔒 Authenticating BLE connection security...', false);
          await cAttached.readValue();

          gattCharacteristicsRef.current.lteAttached = cAttached;
          gattCharacteristicsRef.current.lteRsrp = cRsrp;
          gattCharacteristicsRef.current.lteRsrq = cRsrq;
          gattCharacteristicsRef.current.lteSnr = cSnr;
          gattCharacteristicsRef.current.lteNet = cNet;

          appendLog('', '✔ Chester LTE Status GATT Service bound and authenticated.', false);
          gattServicesFound = true;
        }
      } catch (e: any) {
        console.warn('LTE Status GATT service authentication failed:', e);
        const errStr = (e.message || '').toLowerCase();
        if (e.name === 'SecurityError' || errStr.includes('security') || errStr.includes('authentication') || errStr.includes('pairing') || errStr.includes('insufficient') || errStr.includes('denied')) {
          appendLog('', '❌ Security Error: Bluetooth pairing or password verification was rejected.', false);
          try {
            device.gatt?.disconnect();
          } catch (disErr) {}
          throw new Error('Pairing failed: Correct Bluetooth password is required.');
        }
        appendLog('', 'LTE Status GATT Service not found or restricted. Falling back to CLI emulation.', false);
      }

      try {
        // Discover Channels service
        const chService = await server?.getPrimaryService(CHESTER_CHANNELS_SERVICE_UUID);
        if (chService) {
          const cDevCount = await chService.getCharacteristic(CHESTER_CH_DEV_COUNT_CHAR_UUID);
          const cStatus = await chService.getCharacteristic(CHESTER_CH_STATUS_CHAR_UUID);
          const cTriggerScan = await chService.getCharacteristic(CHESTER_CH_TRIGGER_SCAN_CHAR_UUID);
          const cValues = await chService.getCharacteristic(CHESTER_CH_VALUES_CHAR_UUID);

          // Perform another verification read if not done yet
          if (!gattServicesFound) {
            appendLog('', '🔒 Verifying secure channels access...', false);
            await cDevCount.readValue();
          }

          gattCharacteristicsRef.current.chDevCount = cDevCount;
          gattCharacteristicsRef.current.chStatus = cStatus;
          gattCharacteristicsRef.current.chTriggerScan = cTriggerScan;
          gattCharacteristicsRef.current.chValues = cValues;

          appendLog('', '✔ Chester 1-Wire Channels GATT Service bound.', false);
          gattServicesFound = true;
        }
      } catch (e: any) {
        console.warn('Channels GATT service authentication failed:', e);
        const errStr = (e.message || '').toLowerCase();
        if (e.name === 'SecurityError' || errStr.includes('security') || errStr.includes('authentication') || errStr.includes('pairing') || errStr.includes('insufficient') || errStr.includes('denied')) {
          appendLog('', '❌ Security Error: Bluetooth pairing or password verification was rejected.', false);
          try {
            device.gatt?.disconnect();
          } catch (disErr) {}
          throw new Error('Pairing failed: Correct Bluetooth password is required.');
        }
        appendLog('', 'Channels GATT Service not found or restricted. Falling back to CLI emulation.', false);
      }

      setGattServicesAvailable(gattServicesFound);
      
      // Set device detail states
      setActiveDevice({
        name: device.name || 'CHESTER Gateway',
        id: device.id.substring(0, 8).toUpperCase(),
        batteryVoltage: 3.65,
        batteryPercent: 92,
        signalStrength: -68
      });

      setConnectionState('connected');
      appendLog('', 'Bluetooth stream linked! Handshake established.', false);

      // Fetch initial data if GATT services exist
      if (gattServicesFound) {
        setTimeout(() => {
          fetchGattData();
        }, 1000);
      }

      // Handle disconnection
      device.addEventListener('gattserverdisconnected', () => {
        setConnectionState('disconnected');
        setActiveDevice(null);
        setTxCharacteristic(null);
        setRealLteStatus(null);
        setRealChannels(null);
        setGattServicesAvailable(false);
        gattCharacteristicsRef.current = {};
        appendLog('', 'BLE Gateway GATT disconnected.', false);
      });

    } catch (err: any) {
      console.error(err);
      setConnectionState('disconnected');
      appendLog('', `BLE Connection failed: ${err.message || err}`, false);
    }
  };

  // Simulated connection logic (for secure Iframe previews & instant testing)
  const handleConnectSimulator = () => {
    setMode('simulator');
    setTerminalLogs([]);
    setConnectionState('scanning');
    
    setTimeout(() => {
      setConnectionState('connecting');
      
      setTimeout(() => {
        setActiveDevice({
          name: '2161112345',
          id: '2161112345',
          batteryVoltage: 3.65,
          batteryPercent: 92,
          signalStrength: -72
        });
        setConnectionState('connected');
        appendLog('', 'CONNECTED TO SIMULATED GRAINLINK GATEWAY (2161112345)\nFirmware: GrainLink-Chester-v2.12\nHardware: HW v3.0\nType "help" for interactive command lists.', false);
      }, 800);
    }, 600);
  };

  const handleDisconnect = () => {
    if (mode === 'real' && bleDevice) {
      bleDevice.gatt?.disconnect();
    }
    setConnectionState('disconnected');
    setActiveDevice(null);
    setTxCharacteristic(null);
    appendLog('', 'BLE connection terminated by installer.', false);
  };

  // Trigger BLE commands or simulate responses
  const handleSendCommand = async (commandStr: string) => {
    if (connectionState !== 'connected') {
      appendLog(commandStr, 'Error: No Chester BLE connection established. Please connect first.', true);
      return;
    }

    // 1. If REAL mode, write actual bytes over GATT stream
    if (mode === 'real') {
      const cmd = commandStr.toLowerCase().trim();
      
      // Intercept and trigger GATT service operations if available
      if (gattServicesAvailable) {
        if (cmd === 'scan') {
          triggerGattScan();
        } else if (cmd === 'channels' || cmd === 'lte state') {
          fetchGattData();
        }
      }

      if (txCharacteristic) {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(commandStr + '\r\n');
          await txCharacteristic.writeValue(data);
          appendLog(commandStr, 'Command transmitted...', true);
        } catch (e: any) {
          appendLog(commandStr, `BLE Transmission error: ${e.message}`, true);
        }
      } else {
        appendLog(commandStr, 'Command executed via GATT direct services.', true);
      }
      return;
    }

    // 2. If SIMULATED mode, generate high-fidelity mock Zephyr Shell CLI feedback
    const cmd = commandStr.toLowerCase().trim();
    let reply = '';

    if (cmd === 'help') {
      reply = `Zephyr Shell commands available:
- channels           : Show connected 1-wire sensors and their status/temperatures
- scan               : Scans the 1-wire bus for DS18B20 temperature probes
- lte state          : Display active cellular modem parameters, signal and carrier info
- system             : Show system diagnostics, battery voltage and line voltage
- config show        : Show all configuration state
- kernel reboot cold : Reboot Chester
- clear              : Flush console terminal history`;
    } 
    else if (cmd === 'channels') {
      const distribution = Array(16).fill(0);
      for (let i = 0; i < simulatedSensorCount; i++) {
        distribution[i % 8]++;
      }
      
      let mappingLines = '';
      distribution.forEach((count, idx) => {
        const channelNum = idx + 1;
        const state = count > 0 ? 'State2' : 'State0';
        const fault = count > 0 ? 'Fault 2' : 'Fault 2';
        mappingLines += `Channel ${channelNum} ------ ${count} Devices -- ${state}  ${fault}\n`;
      });
      
      reply = `Channels Device Mappings:\n${mappingLines}[OK] Channel status mapping completed.`;
    } 
    else if (cmd === 'scan') {
      const logId = Math.random().toString();
      setTerminalLogs((prev) => [
        ...prev,
        {
          id: logId,
          command: commandStr,
          response: 'Initializing background 1-Wire automatic channel scan...\nProgress: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% | Scanning Channel A1...',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          isUser: true
        }
      ]);

      const distribution = Array(8).fill(0);
      for (let i = 0; i < simulatedSensorCount; i++) {
        distribution[i % 8]++;
      }

      const lines: string[] = [];
      distribution.forEach((count, idx) => {
        const channelName = `A${idx + 1}`;
        if (count > 0) {
          lines.push(`Scanning Channel ${channelName}... Found ${count} sensors.`);
        } else {
          lines.push(`Scanning Channel ${channelName}... Found 0 sensors. (No device responded)`);
        }
      });

      const channelFinishTimes: number[] = [];
      let runningSum = 0;
      distribution.forEach((count) => {
        const channelDelay = count === 0 ? 30 : (30 + count * 30);
        runningSum += channelDelay;
        channelFinishTimes.push(runningSum);
      });
      const totalDuration = runningSum;
      const startTime = Date.now();

      const intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressFraction = Math.min(elapsed / totalDuration, 1.0);
        const percent = Math.round(progressFraction * 100);

        const barWidth = 30;
        const filled = Math.floor(progressFraction * barWidth);
        const empty = barWidth - filled;
        const barStr = '█'.repeat(filled) + '░'.repeat(empty);

        const completedLines: string[] = [];
        channelFinishTimes.forEach((finishTime, idx) => {
          if (elapsed >= finishTime) {
            completedLines.push(lines[idx]);
          }
        });

        let activeChannelIndex = 0;
        while (activeChannelIndex < 8 && elapsed >= channelFinishTimes[activeChannelIndex]) {
          activeChannelIndex++;
        }

        let statusText = '';
        if (elapsed >= totalDuration) {
          statusText = 'Scan Complete!';
        } else if (activeChannelIndex < 8) {
          statusText = `Scanning Channel A${activeChannelIndex + 1}...`;
        }

        let newResponse = 'Initializing background 1-Wire automatic channel scan...\n';
        newResponse += `Progress: [${barStr}] ${percent}% | ${statusText}\n`;
        newResponse += `----------------------------------------------\n`;

        if (completedLines.length > 0) {
          newResponse += completedLines.join('\n') + '\n';
        }

        if (elapsed >= totalDuration) {
          newResponse += `\n[OK] 1-Wire scan sequence complete.`;
          clearInterval(intervalId);
          setTimeout(() => {
            handleSendCommand('channels');
          }, 800);
        }

        setTerminalLogs((prev) =>
          prev.map((log) => {
            if (log.id === logId) {
              return {
                ...log,
                response: newResponse
              };
            }
            return log;
          })
        );
      }, 40);

      return;
    } 
    else if (cmd === 'lte state') {
      const isLteConnected = mode === 'real' ? (realLteStatus ? realLteStatus.state === 'Connected' : false) : mockLteAttached;
      const lteRsrpVal = mode === 'real' ? (realLteStatus ? realLteStatus.rsrp : -140) : (mockLteAttached ? mockLteSignal : -140);
      const lteRsrqVal = mode === 'real' ? (realLteStatus ? realLteStatus.rsrq : -25) : (mockLteAttached ? -9 : -20);
      const lteSnrVal = isLteConnected ? 13 : -10;
      const lteOperatorVal = mode === 'real' ? (realLteStatus ? realLteStatus.operator : 'None') : (mockLteAttached ? 'Verizon (Agri-Net)' : 'None');

      reply = `attached: ${isLteConnected ? 'yes' : 'no'}
cereg: ${isLteConnected ? (lteOperatorVal.includes('Verizon') || lteOperatorVal.includes('Agri-Net') ? 'registered roaming' : 'registered') : 'searching'}
mode: lte-m
eest: ${isLteConnected ? '7' : '0'}
ecl: ${isLteConnected ? '0' : '2'}
rsrp: ${lteRsrpVal}
rsrq: ${lteRsrqVal}
snr: ${lteSnrVal}
plmn: ${isLteConnected ? '302610' : '000000'}
cid: ${isLteConnected ? '29019660' : '0'}
band: 12
earfcn: ${isLteConnected ? '5145' : '0'}
state: ${isLteConnected ? 'gnss' : 'off'}
command succeeded`;
    } 
    else if (cmd === 'system') {
      reply = `CTR X1b present     : 0
CTR Z present       : 0
CTR 2/3 present     : 1
CTR X2(B) present   : 0
CTR X12(B) present  : 0
CTR X10 present     : 1
CTR U1 present      : 1
Line present        : 0
Line voltage        : 0.00 V
Battery voltage      : 4.09 V
System voltage rest : 3.83 V
System voltage load : 3.79 V
System current load : 37.0 mA
Channels            : 8
Orientation         : 2
int temperature     : 26.19 C
button R            : 0
button L            : 0
time since send     : 2793
Cloud initialized   : 1`;
    }
    else if (cmd === 'config show') {
      const isLteConnected = mode === 'real' ? (realLteStatus ? realLteStatus.state === 'Connected' : false) : mockLteAttached;
      const lteApnVal = mode === 'real' ? (realLteStatus ? realLteStatus.apn : 'none') : (mockLteAttached ? 'm2m.grainlink.iot' : 'none');
      const lteTechVal = isLteConnected ? 'LTE-M' : 'None (Offline - No SIM)';

      reply = `==================================================
GRAINLINK CHESTER CURRENT SYSTEM CONFIGURATION
==================================================
device.id        : ${config.binId || '2161112345'}
device.installer : ${config.installerName || 'Nat'} (${config.phoneNumber || 'nat@grainlink.com'})
bin.id           : ${config.binId || '2161112345'}
bin.cable_type   : DS18B20 1-Wire
bin.height_probe : 4-20mA ADC
modem.apn        : ${lteApnVal}
modem.tech       : ${lteTechVal}
modem.interval   : 15 minutes
power.source     : USB/Line Power
sensors.scan_int : 5 seconds
==================================================
[OK] Config retrieval complete.`;
    }
    else if (cmd === 'kernel reboot cold') {
      reply = `*** Booting Zephyr OS build v3.4.0 ***
[INFO] Initiating cold reboot sequence...
[INFO] Synchronizing filesystem logs...
[INFO] Powering down peripheral rails...
[INFO] Resetting Cortex-M33 MCU...
[OK] Cold reboot sequence complete. System restarted successfully.`;
    }
    else if (cmd === 'send') {
      reply = `[INFO] Requesting immediate manual cloud payload transmission...
[INFO] Packaging data from 8 active 1-Wire sensors...
[INFO] Initializing LTE-M network uplink...
[INFO] Data transmitted successfully to GrainLink Cloud.
[OK] Cloud send sequence complete.`;
    }
    else if (cmd === 'clear') {
      setTerminalLogs([]);
      return;
    } 
    else {
      reply = `Shell error: Command "${commandStr}" not found.
Type "help" to list valid installer commands.`;
    }

    appendLog(commandStr, reply, true);
  };

  // Helper arrays for live render matching simulated data
  const getSimulatedChannels = (): ChannelInfo[] => {
    const distribution = Array(8).fill(0);
    for (let i = 0; i < simulatedSensorCount; i++) {
      distribution[i % 8]++;
    }

    const channelsList: ChannelInfo[] = [];
    distribution.forEach((count, idx) => {
      const channelName = `A${idx + 1}`;
      if (count > 0) {
        const values: string[] = [];
        for (let s = 0; s < count; s++) {
          const baseTemp = 71.2 + (idx * 0.4) + (s * 0.3) + mockTempOffset;
          values.push(baseTemp.toFixed(1) + '°F');
        }
        channelsList.push({
          index: idx,
          name: `${channelName}_1WIRE`,
          type: 'DS18B20 1-Wire Temperature Cable',
          status: 'ACTIVE',
          sensorCount: count,
          values: values
        });
      } else {
        channelsList.push({
          index: idx,
          name: `${channelName}_1WIRE`,
          type: 'DS18B20 1-Wire Temperature Cable',
          status: 'IDLE',
          sensorCount: 0,
          values: []
        });
      }
    });

    const currentMa = (12.4 + (mockTempOffset * 0.1)).toFixed(2);
    channelsList.push({
      index: 8,
      name: 'A2_ADC',
      type: '4-20mA Grain Height Probe',
      status: 'ACTIVE',
      sensorCount: 1,
      values: [currentMa]
    });

    return channelsList;
  };

  const getSimulatedLte = (): LteStatus => {
    return {
      state: mockLteAttached ? 'Connected' : 'Disconnected',
      operator: mockLteAttached ? 'Verizon (Agri-Net)' : 'None',
      rsrp: mockLteAttached ? mockLteSignal : -140,
      rsrq: mockLteAttached ? -12 : -25,
      ipAddress: mockLteAttached ? '10.143.2.45' : '0.0.0.0',
      apn: mockLteAttached ? 'm2m.grainlink.iot' : 'none',
      ready: mockLteAttached,
      synced: mockLteAttached,
    };
  };

  return (
    <MobileFrame
      mockTempOffset={mockTempOffset}
      onSetMockTempOffset={setMockTempOffset}
      mockLteSignal={mockLteSignal}
      onSetMockLteSignal={setMockLteSignal}
      mockLteAttached={mode === 'real' ? (realLteStatus ? realLteStatus.state === 'Connected' : false) : mockLteAttached}
      onOpenInNewTab={handleOpenInNewTab}
      isIframe={isIframe}
    >
      <div className="flex-1 flex flex-col bg-zinc-50">
        {connectionState !== 'connected' ? (
          <ScanList
            connectionState={connectionState}
            mode={mode}
            onToggleMode={() => {
              handleDisconnect();
              setMode(mode === 'real' ? 'simulator' : 'real');
            }}
            onConnectReal={handleConnectRealBluetooth}
            onConnectSimulated={(device) => {
              setMode('simulator');
              setTerminalLogs([]);
              setConnectionState('connecting');
              setTimeout(() => {
                setActiveDevice(device);
                setConnectionState('connected');
                appendLog('', `CONNECTED TO SIMULATED GRAINLINK GATEWAY (${device.name})\nFirmware: GrainLink-Chester-v2.12\nHardware: HW v3.0\nType "help" for interactive command lists.`, false);
              }, 800);
            }}
            onDisconnect={handleDisconnect}
            activeDevice={activeDevice}
            isIframe={isIframe}
          />
        ) : (
          <div className="flex-1 flex flex-col justify-start">
            {/* Active Link Connected Header */}
            <div className="bg-white border-b border-zinc-100 px-5 py-4 flex items-center justify-between select-none">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-xl border border-blue-100">
                  <Bluetooth className="w-4.5 h-4.5 animate-pulse text-blue-600" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block leading-none">CONNECTED TO</span>
                  <span className="font-display font-extrabold text-xs text-black mt-1 block">
                    🔗 {activeDevice?.name ? activeDevice.name.replace(/Chester\s*/gi, '').trim() : '2161112345'}
                  </span>
                </div>
              </div>
              <button
                id="active-disconnect-btn"
                onClick={handleDisconnect}
                className="bg-black hover:bg-zinc-950 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer active:scale-95"
              >
                Disconnect
              </button>
            </div>

            {/* Core Diagnostic Dashboard - Unified Tabbed Command Panel */}
            <div className="flex-1 p-5 overflow-y-auto">
              <CommandPanel
                onRunCommand={handleSendCommand}
                channels={mode === 'real' && realChannels ? realChannels : getSimulatedChannels()}
                lte={mode === 'real' ? (realLteStatus || { state: 'Disconnected', operator: 'None', rsrp: -140, rsrq: -25, ipAddress: '0.0.0.0', apn: 'none', ready: false, synced: false }) : getSimulatedLte()}
                batteryVoltage={batteryVoltage}
                batteryPercent={batteryPercent}
                config={config}
                onUpdateConfig={handleUpdateConfig}
                incomingSms={incomingSms}
                onClearIncoming={() => setIncomingSms(null)}
                onDisconnect={handleDisconnect}
                mode={mode}
                terminalLogs={terminalLogs}
                simulatedSensorCount={simulatedSensorCount}
                onUpdateSensorCount={setSimulatedSensorCount}
                mockLteSignal={mockLteSignal}
                onSetMockLteSignal={setMockLteSignal}
                mockLteAttached={mockLteAttached}
                onSetMockLteAttached={setMockLteAttached}
                autoPoll={autoPoll}
                onToggleAutoPoll={() => setAutoPoll(prev => !prev)}
              />
            </div>
          </div>
        )}
      </div>
    </MobileFrame>
  );
}
