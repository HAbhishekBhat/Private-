/**
 * Core transport contracts for AED Event Capture System.
 * Agnostic of underlying physical hardware (USB-C OTG, Apple MFi ExternalAccessory, BLE, or Mock).
 */

export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'SEARCHING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DETACHED_RETRYING'
  | 'ERROR';

export type TransportType = 'ANDROID_USB_SERIAL' | 'IOS_EXTERNAL_ACCESSORY' | 'IOS_BLE_FALLBACK' | 'MOCK_SIMULATOR';

export interface TransportMetadata {
  type: TransportType;
  deviceName: string;
  vendorId?: number | string;
  productId?: number | string;
  serialNumber?: string;
  protocolString?: string;
  baudRate?: number;
  isMFiCertified?: boolean;
}

export type DataListener = (chunk: Uint8Array) => void;
export type StatusListener = (status: ConnectionStatus, metadata?: TransportMetadata) => void;
export type ErrorListener = (error: Error) => void;

export interface ITransportService {
  /**
   * Initializes the transport and begins listening for accessory attach/detach events.
   */
  initialize(): Promise<void>;

  /**
   * Explicitly initiates connection to detected hardware.
   */
  connect(): Promise<void>;

  /**
   * Disconnects and releases active hardware resources.
   */
  disconnect(): Promise<void>;

  /**
   * Writes raw bytes to the accessory if bidirectional handshake/acknowledgement is supported.
   */
  send(data: Uint8Array): Promise<void>;

  /**
   * Returns the current connection status.
   */
  getStatus(): ConnectionStatus;

  /**
   * Returns active device metadata if connected.
   */
  getMetadata(): TransportMetadata | null;

  /**
   * Registers a listener for raw incoming binary chunks.
   * Returns an unsubscription callback.
   */
  onData(listener: DataListener): () => void;

  /**
   * Registers a listener for hardware state transitions.
   * Returns an unsubscription callback.
   */
  onStatusChange(listener: StatusListener): () => void;

  /**
   * Registers a listener for hardware transport errors.
   * Returns an unsubscription callback.
   */
  onError(listener: ErrorListener): () => void;
}
