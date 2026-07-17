/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';

export type ConnectionMode = 'real' | 'simulator';

export interface CommandLog {
  id: string;
  command: string;
  response: string;
  timestamp: string;
  isUser: boolean;
}

export interface ChannelInfo {
  index: number;
  name: string;
  type: string;
  status: 'ACTIVE' | 'IDLE' | 'ERROR';
  sensorCount: number;
  values: string[];
}

export interface BinConfig {
  binId: string;
  installerName: string;
  phoneNumber: string;
  notes: string;
  timestamp: string;
  status: 'pending' | 'completed';
}

export interface LteStatus {
  state: 'Connected' | 'Connecting' | 'Disconnected' | 'Error';
  operator: string;
  rsrp: number; // dBm
  rsrq: number; // dB
  ipAddress: string;
  apn: string;
  ready: boolean;
  synced: boolean;
}

export interface ChesterDevice {
  name: string;
  id: string;
  batteryVoltage: number; // e.g. 3.65
  batteryPercent: number; // e.g. 92%
  signalStrength: number; // RSSI, e.g. -72 dBm
}
