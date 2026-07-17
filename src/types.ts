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

export interface ChesterLiveConfig {
  app_gnss_interval: number;
  app_measurement_interval: number;
  app_report_interval: number;
  app_scan_interval: number;
  app_poll_interval: number;
  app_cloud_timeout: number;
  app_powersave: boolean;
  app_tracking_mode: boolean;
  app_mode: string;
  ble_passkey: string;
  tag_enabled: boolean;
  tag_scan_interval: number;
  tag_scan_duration: number;
  tag_devices_addr: number;
  lte_test: boolean;
  lte_antenna: string;
  lte_mode: string;
  lte_bands: string;
  lte_network: string;
  lte_apn: string;
  lte_auth: string;
  lte_username: string;
  lte_password: string;
  lte_addr: string;
  lte_modemtrace: boolean;
}
