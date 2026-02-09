// ============================================
// SCALE PROVIDER INTERFACE
// This abstraction allows any scale integration
// to be plugged in without changing application code
// ============================================

export interface WeightReading {
  weight: number;
  unit: 'lbs' | 'kg';
  stable: boolean;
  timestamp: Date;
  scaleId?: string;
}

export enum ScaleStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  CONNECTING = 'connecting'
}

export interface IScaleProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): ScaleStatus;
  getCurrentWeight(): Promise<WeightReading | null>;
  captureStableWeight(timeout?: number, stabilityThreshold?: number): Promise<WeightReading>;
  onWeightUpdate(callback: (reading: WeightReading) => void): () => void;
  onStatusChange(callback: (status: ScaleStatus) => void): () => void;
  tare(): Promise<void>;
  getMetadata(): {
    model: string;
    serialNumber?: string;
    connectionType: string;
    firmware?: string;
  };
}

export interface ScaleProviderConfig {
  type: 'manual' | 'websocket' | 'bluetooth' | 'api' | 'serial';
  manualEntry?: {
    requireConfirmation: boolean;
    defaultUnit: 'lbs' | 'kg';
  };
  websocket?: {
    endpoint: string;
    protocol?: string;
    reconnectInterval?: number;
  };
  scaleId: string;
  model?: string;
  serialNumber?: string;
}

export class ScaleProviderFactory {
  static create(config: ScaleProviderConfig): IScaleProvider {
    switch (config.type) {
      case 'manual':
        return new ManualEntryProvider(config);
      default:
        throw new Error(`Scale provider type '${config.type}' not yet implemented. Use 'manual' for now.`);
    }
  }
}

// Manual Entry Provider (V1 - Current)
export class ManualEntryProvider implements IScaleProvider {
  private status: ScaleStatus = ScaleStatus.DISCONNECTED;
  private config: ScaleProviderConfig;
  private currentWeight: WeightReading | null = null;
  private statusListeners: Array<(status: ScaleStatus) => void> = [];
  private weightListeners: Array<(reading: WeightReading) => void> = [];
  private manualWeightResolver: ((weight: WeightReading) => void) | null = null;

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

  async captureStableWeight(timeout?: number): Promise<WeightReading> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Manual entry timeout - no weight entered'));
      }, timeout || 30000);

      this.manualWeightResolver = (weight: WeightReading) => {
        clearTimeout(timeoutId);
        resolve(weight);
      };
    });
  }

  setManualWeight(weight: number, unit: 'lbs' | 'kg' = 'lbs'): void {
    const reading: WeightReading = {
      weight,
      unit,
      stable: true,
      timestamp: new Date(),
      scaleId: this.config.scaleId,
    };

    this.currentWeight = reading;
    this.notifyWeightUpdate(reading);

    if (this.manualWeightResolver) {
      this.manualWeightResolver(reading);
      this.manualWeightResolver = null;
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
      connectionType: 'manual',
    };
  }

  private notifyWeightUpdate(reading: WeightReading): void {
    this.weightListeners.forEach(cb => cb(reading));
  }

  private notifyStatusChange(): void {
    this.statusListeners.forEach(cb => cb(this.status));
  }
}
