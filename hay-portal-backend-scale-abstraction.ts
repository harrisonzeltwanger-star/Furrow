// ============================================
// SCALE PROVIDER INTERFACE
// This abstraction allows any scale integration
// to be plugged in without changing application code
// ============================================

/**
 * Weight reading from a scale
 */
export interface WeightReading {
  weight: number;           // Weight value
  unit: 'lbs' | 'kg';      // Unit of measurement
  stable: boolean;          // Is the weight stable/locked?
  timestamp: Date;          // When was this reading taken
  scaleId?: string;         // Optional: which scale provided this
}

/**
 * Scale connection status
 */
export enum ScaleStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  CONNECTING = 'connecting'
}

/**
 * Scale provider interface - all scale implementations must conform to this
 */
export interface IScaleProvider {
  /**
   * Initialize connection to the scale
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the scale
   */
  disconnect(): Promise<void>;

  /**
   * Get current scale status
   */
  getStatus(): ScaleStatus;

  /**
   * Get the current weight reading (may not be stable)
   * @returns Current weight or null if no reading available
   */
  getCurrentWeight(): Promise<WeightReading | null>;

  /**
   * Wait for a stable weight reading
   * @param timeout - Maximum time to wait in milliseconds (default: 30000)
   * @param stabilityThreshold - How long weight must be stable in ms (default: 3000)
   * @returns Stable weight reading
   * @throws Error if timeout reached or connection lost
   */
  captureStableWeight(timeout?: number, stabilityThreshold?: number): Promise<WeightReading>;

  /**
   * Subscribe to weight updates (for real-time display)
   * @param callback - Function called with each new weight reading
   * @returns Unsubscribe function
   */
  onWeightUpdate(callback: (reading: WeightReading) => void): () => void;

  /**
   * Subscribe to status changes
   * @param callback - Function called when status changes
   * @returns Unsubscribe function
   */
  onStatusChange(callback: (status: ScaleStatus) => void): () => void;

  /**
   * Tare the scale (zero it out)
   */
  tare(): Promise<void>;

  /**
   * Get scale metadata (model, serial number, etc.)
   */
  getMetadata(): {
    model: string;
    serialNumber?: string;
    connectionType: string;
    firmware?: string;
  };
}

/**
 * Configuration for scale providers
 */
export interface ScaleProviderConfig {
  type: 'manual' | 'websocket' | 'bluetooth' | 'api' | 'serial';
  
  // Manual entry config
  manualEntry?: {
    requireConfirmation: boolean;
    defaultUnit: 'lbs' | 'kg';
  };
  
  // WebSocket config (for serial-to-WiFi adapters)
  websocket?: {
    endpoint: string;        // ws://192.168.1.100:8080
    protocol?: string;       // Optional WebSocket sub-protocol
    reconnectInterval?: number; // ms between reconnection attempts
  };
  
  // Bluetooth config
  bluetooth?: {
    deviceId: string;        // MAC address or device identifier
    serviceUUID: string;     // Bluetooth service UUID
    characteristicUUID: string; // Characteristic UUID for weight data
  };
  
  // API config (for scales with REST APIs)
  api?: {
    endpoint: string;        // https://scale.local/api
    apiKey?: string;
    pollInterval?: number;   // ms between polling (default: 500)
  };
  
  // Serial port config (for direct connection - Node.js only)
  serial?: {
    port: string;            // COM3, /dev/ttyUSB0, etc.
    baudRate: number;        // 9600, 19200, etc.
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: 'none' | 'even' | 'odd';
  };
  
  // Common settings
  scaleId: string;           // Unique identifier for this scale
  model?: string;            // Scale model/make
  serialNumber?: string;     // Scale serial number
}

/**
 * Factory for creating scale providers
 */
export class ScaleProviderFactory {
  /**
   * Create a scale provider based on configuration
   */
  static create(config: ScaleProviderConfig): IScaleProvider {
    switch (config.type) {
      case 'manual':
        return new ManualEntryProvider(config);
      
      case 'websocket':
        if (!config.websocket) {
          throw new Error('WebSocket configuration required');
        }
        return new WebSocketScaleProvider(config);
      
      case 'bluetooth':
        if (!config.bluetooth) {
          throw new Error('Bluetooth configuration required');
        }
        return new BluetoothScaleProvider(config);
      
      case 'api':
        if (!config.api) {
          throw new Error('API configuration required');
        }
        return new APIScaleProvider(config);
      
      case 'serial':
        if (!config.serial) {
          throw new Error('Serial configuration required');
        }
        return new SerialScaleProvider(config);
      
      default:
        throw new Error(`Unknown scale provider type: ${config.type}`);
    }
  }
}

// ============================================
// MANUAL ENTRY PROVIDER (V1 - Current)
// ============================================

/**
 * Manual entry provider - user types in weights
 * This is the default/fallback provider
 */
export class ManualEntryProvider implements IScaleProvider {
  private status: ScaleStatus = ScaleStatus.DISCONNECTED;
  private config: ScaleProviderConfig;
  private currentWeight: WeightReading | null = null;
  private statusListeners: Array<(status: ScaleStatus) => void> = [];
  private weightListeners: Array<(reading: WeightReading) => void> = [];

  constructor(config: ScaleProviderConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.status = ScaleStatus.CONNECTED;
    this.notifyStatusChange();
  }

  async disconnect(): Promise<void> {
    this.status = ScaleStatus.DISCONNECTED;
    this.notifyStatusChange();
  }

  getStatus(): ScaleStatus {
    return this.status;
  }

  async getCurrentWeight(): Promise<WeightReading | null> {
    return this.currentWeight;
  }

  /**
   * For manual entry, this is called by the UI when user enters weight
   */
  async captureStableWeight(timeout?: number, stabilityThreshold?: number): Promise<WeightReading> {
    // Return a promise that will be resolved by setManualWeight()
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Manual entry timeout - no weight entered'));
      }, timeout || 30000);

      // Store the resolver so setManualWeight can call it
      (this as any)._manualWeightResolver = (weight: WeightReading) => {
        clearTimeout(timeoutId);
        resolve(weight);
      };
    });
  }

  /**
   * Called by UI when user manually enters a weight
   */
  setManualWeight(weight: number, unit: 'lbs' | 'kg' = 'lbs'): void {
    const reading: WeightReading = {
      weight,
      unit,
      stable: true,
      timestamp: new Date(),
      scaleId: this.config.scaleId
    };

    this.currentWeight = reading;
    this.notifyWeightUpdate(reading);

    // Resolve any pending captureStableWeight promise
    if ((this as any)._manualWeightResolver) {
      (this as any)._manualWeightResolver(reading);
      delete (this as any)._manualWeightResolver;
    }
  }

  onWeightUpdate(callback: (reading: WeightReading) => void): () => void {
    this.weightListeners.push(callback);
    return () => {
      this.weightListeners = this.weightListeners.filter(cb => cb !== callback);
    };
  }

  onStatusChange(callback: (status: ScaleStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  async tare(): Promise<void> {
    // No-op for manual entry
  }

  getMetadata() {
    return {
      model: this.config.model || 'Manual Entry',
      serialNumber: this.config.serialNumber,
      connectionType: 'manual'
    };
  }

  private notifyWeightUpdate(reading: WeightReading): void {
    this.weightListeners.forEach(cb => cb(reading));
  }

  private notifyStatusChange(): void {
    this.statusListeners.forEach(cb => cb(this.status));
  }
}

// ============================================
// WEBSOCKET PROVIDER (Stub - for future)
// ============================================

/**
 * WebSocket-based scale provider
 * Used for serial-to-WiFi adapters
 */
export class WebSocketScaleProvider implements IScaleProvider {
  private status: ScaleStatus = ScaleStatus.DISCONNECTED;
  private config: ScaleProviderConfig;
  private ws: WebSocket | null = null;
  private currentWeight: WeightReading | null = null;
  private stableWeight: WeightReading | null = null;
  private statusListeners: Array<(status: ScaleStatus) => void> = [];
  private weightListeners: Array<(reading: WeightReading) => void> = [];
  private stableTimer: NodeJS.Timeout | null = null;

  constructor(config: ScaleProviderConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.websocket) {
      throw new Error('WebSocket configuration missing');
    }

    return new Promise((resolve, reject) => {
      this.status = ScaleStatus.CONNECTING;
      this.notifyStatusChange();

      this.ws = new WebSocket(this.config.websocket!.endpoint);

      this.ws.onopen = () => {
        this.status = ScaleStatus.CONNECTED;
        this.notifyStatusChange();
        resolve();
      };

      this.ws.onerror = (error) => {
        this.status = ScaleStatus.ERROR;
        this.notifyStatusChange();
        reject(error);
      };

      this.ws.onclose = () => {
        this.status = ScaleStatus.DISCONNECTED;
        this.notifyStatusChange();
        this.attemptReconnect();
      };

      this.ws.onmessage = (event) => {
        this.handleWeightData(event.data);
      };
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status = ScaleStatus.DISCONNECTED;
    this.notifyStatusChange();
  }

  getStatus(): ScaleStatus {
    return this.status;
  }

  async getCurrentWeight(): Promise<WeightReading | null> {
    return this.currentWeight;
  }

  async captureStableWeight(timeout = 30000, stabilityThreshold = 3000): Promise<WeightReading> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Weight capture timeout - scale not stabilizing'));
      }, timeout);

      const unsubscribe = this.onWeightUpdate((reading) => {
        if (reading.stable && this.stableWeight) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(reading);
        }
      });
    });
  }

  onWeightUpdate(callback: (reading: WeightReading) => void): () => void {
    this.weightListeners.push(callback);
    return () => {
      this.weightListeners = this.weightListeners.filter(cb => cb !== callback);
    };
  }

  onStatusChange(callback: (status: ScaleStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  async tare(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send tare command (format depends on scale protocol)
      this.ws.send('TARE\r\n');
    }
  }

  getMetadata() {
    return {
      model: this.config.model || 'WebSocket Scale',
      serialNumber: this.config.serialNumber,
      connectionType: 'websocket',
      firmware: undefined
    };
  }

  /**
   * Parse incoming weight data from WebSocket
   * Format varies by manufacturer - this is a generic parser
   */
  private handleWeightData(data: string): void {
    // Common format: "GS,+058420,lb\r\n" (Gross Stable, 58420 lbs)
    // or "GU,+058350,lb\r\n" (Gross Unstable)
    
    const match = data.match(/([GN][SU]),([+-]\d+),(lb|kg)/i);
    if (!match) return;

    const [_, status, weightStr, unit] = match;
    const stable = status.endsWith('S');
    const weight = parseInt(weightStr);

    const reading: WeightReading = {
      weight,
      unit: unit.toLowerCase() as 'lbs' | 'kg',
      stable,
      timestamp: new Date(),
      scaleId: this.config.scaleId
    };

    this.currentWeight = reading;

    // Check for stability over time
    if (stable) {
      if (!this.stableTimer) {
        this.stableTimer = setTimeout(() => {
          this.stableWeight = reading;
          this.notifyWeightUpdate(reading);
        }, 3000); // 3 second stability threshold
      }
    } else {
      if (this.stableTimer) {
        clearTimeout(this.stableTimer);
        this.stableTimer = null;
      }
      this.stableWeight = null;
    }

    this.notifyWeightUpdate(reading);
  }

  private attemptReconnect(): void {
    const interval = this.config.websocket?.reconnectInterval || 5000;
    setTimeout(() => {
      if (this.status === ScaleStatus.DISCONNECTED) {
        this.connect().catch(console.error);
      }
    }, interval);
  }

  private notifyWeightUpdate(reading: WeightReading): void {
    this.weightListeners.forEach(cb => cb(reading));
  }

  private notifyStatusChange(): void {
    this.statusListeners.forEach(cb => cb(this.status));
  }
}

// ============================================
// BLUETOOTH PROVIDER (Stub - for future)
// ============================================

export class BluetoothScaleProvider implements IScaleProvider {
  private config: ScaleProviderConfig;
  private status: ScaleStatus = ScaleStatus.DISCONNECTED;

  constructor(config: ScaleProviderConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    throw new Error('Bluetooth provider not yet implemented');
  }

  async disconnect(): Promise<void> {
    this.status = ScaleStatus.DISCONNECTED;
  }

  getStatus(): ScaleStatus {
    return this.status;
  }

  async getCurrentWeight(): Promise<WeightReading | null> {
    return null;
  }

  async captureStableWeight(): Promise<WeightReading> {
    throw new Error('Bluetooth provider not yet implemented');
  }

  onWeightUpdate(callback: (reading: WeightReading) => void): () => void {
    return () => {};
  }

  onStatusChange(callback: (status: ScaleStatus) => void): () => void {
    return () => {};
  }

  async tare(): Promise<void> {
    throw new Error('Bluetooth provider not yet implemented');
  }

  getMetadata() {
    return {
      model: 'Bluetooth Scale (Not Implemented)',
      connectionType: 'bluetooth'
    };
  }
}

// ============================================
// API PROVIDER (Stub - for future)
// ============================================

export class APIScaleProvider implements IScaleProvider {
  private config: ScaleProviderConfig;
  private status: ScaleStatus = ScaleStatus.DISCONNECTED;

  constructor(config: ScaleProviderConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    throw new Error('API provider not yet implemented');
  }

  async disconnect(): Promise<void> {
    this.status = ScaleStatus.DISCONNECTED;
  }

  getStatus(): ScaleStatus {
    return this.status;
  }

  async getCurrentWeight(): Promise<WeightReading | null> {
    return null;
  }

  async captureStableWeight(): Promise<WeightReading> {
    throw new Error('API provider not yet implemented');
  }

  onWeightUpdate(callback: (reading: WeightReading) => void): () => void {
    return () => {};
  }

  onStatusChange(callback: (status: ScaleStatus) => void): () => void {
    return () => {};
  }

  async tare(): Promise<void> {
    throw new Error('API provider not yet implemented');
  }

  getMetadata() {
    return {
      model: 'API Scale (Not Implemented)',
      connectionType: 'api'
    };
  }
}

// ============================================
// SERIAL PROVIDER (Stub - for future, Node.js only)
// ============================================

export class SerialScaleProvider implements IScaleProvider {
  private config: ScaleProviderConfig;
  private status: ScaleStatus = ScaleStatus.DISCONNECTED;

  constructor(config: ScaleProviderConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    throw new Error('Serial provider not yet implemented');
  }

  async disconnect(): Promise<void> {
    this.status = ScaleStatus.DISCONNECTED;
  }

  getStatus(): ScaleStatus {
    return this.status;
  }

  async getCurrentWeight(): Promise<WeightReading | null> {
    return null;
  }

  async captureStableWeight(): Promise<WeightReading> {
    throw new Error('Serial provider not yet implemented');
  }

  onWeightUpdate(callback: (reading: WeightReading) => void): () => void {
    return () => {};
  }

  onStatusChange(callback: (status: ScaleStatus) => void): () => void {
    return () => {};
  }

  async tare(): Promise<void> {
    throw new Error('Serial provider not yet implemented');
  }

  getMetadata() {
    return {
      model: 'Serial Scale (Not Implemented)',
      connectionType: 'serial'
    };
  }
}

// ============================================
// USAGE EXAMPLE
// ============================================

/*
// In your application code:

import { ScaleProviderFactory, ScaleProviderConfig } from './scaleService';

// V1: Manual entry (current)
const manualConfig: ScaleProviderConfig = {
  type: 'manual',
  scaleId: 'scale-001',
  model: 'Manual Entry',
  manualEntry: {
    requireConfirmation: true,
    defaultUnit: 'lbs'
  }
};

const scale = ScaleProviderFactory.create(manualConfig);
await scale.connect();

// Later when you get hardware:

// V2: WebSocket scale
const websocketConfig: ScaleProviderConfig = {
  type: 'websocket',
  scaleId: 'scale-001',
  model: 'Rice Lake 920i',
  serialNumber: 'RL-12345',
  websocket: {
    endpoint: 'ws://192.168.1.100:8080',
    reconnectInterval: 5000
  }
};

const scale = ScaleProviderFactory.create(websocketConfig);
await scale.connect();

// Subscribe to weight updates for UI
scale.onWeightUpdate((reading) => {
  console.log(`Current: ${reading.weight} ${reading.unit}, Stable: ${reading.stable}`);
});

// Capture a stable weight
const weight = await scale.captureStableWeight();
console.log(`Captured: ${weight.weight} ${weight.unit}`);

*/
