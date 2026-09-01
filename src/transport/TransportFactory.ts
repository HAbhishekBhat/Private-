/**
 * TransportFactory: Decouples higher layers from platform-specific hardware transports.
 * Higher layers never branch on Platform.OS directly.
 */

import { ITransportService, TransportType } from '../core/types/transport';
import { AndroidUsbSerialTransport } from './AndroidUsbSerialTransport';
import { IosExternalAccessoryTransport } from './IosExternalAccessoryTransport';
import { IosBleFallbackTransport } from './IosBleFallbackTransport';
import { MockSimulatorTransport } from './MockSimulatorTransport';

export interface TransportFactoryConfig {
  preferredType?: TransportType;
  iosUseMFi?: boolean; // true = ExternalAccessory, false = BLE Fallback
  androidBaudRate?: number;
  iosMFiProtocol?: string;
}

export class TransportFactory {
  /**
   * Creates and configures the active transport service instance.
   */
  public static createTransport(config: TransportFactoryConfig = {}, platformOs: string = 'simulator'): ITransportService {
    if (config.preferredType === 'MOCK_SIMULATOR' || platformOs === 'simulator' || platformOs === 'web') {
      return new MockSimulatorTransport();
    }

    if (platformOs === 'android') {
      return new AndroidUsbSerialTransport({
        baudRate: config.androidBaudRate || 9600,
      });
    }

    if (platformOs === 'ios') {
      if (config.iosUseMFi) {
        return new IosExternalAccessoryTransport({
          protocolString: config.iosMFiProtocol || 'com.medical.aed.optical-ir',
        });
      } else {
        return new IosBleFallbackTransport();
      }
    }

    // Default fallback to Simulator for safety and deterministic test execution
    return new MockSimulatorTransport();
  }
}
