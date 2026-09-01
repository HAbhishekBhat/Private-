import Foundation
import ExternalAccessory
import React

/**
 * Native iOS External Accessory Bridge for MFi AED Optical IR Dongles.
 * Implements EASession, stream reading runloop, and didConnect / didDisconnect notifications.
 */
@objc(ExternalAccessoryBridge)
class ExternalAccessoryBridge: RCTEventEmitter, StreamDelegate {

    private var activeSession: EASession?
    private var activeAccessory: EAAccessory?
    private let protocolString = "com.medical.aed.optical-ir"
    private var inputStream: InputStream?
    private var outputStream: OutputStream?
    private let readBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 1024)

    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override func supportedEvents() -> [String]! {
        return ["onAccessoryData", "onAccessoryAttached", "onAccessoryDetached"]
    }

    override init() {
        super.init()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(accessoryDidConnect(_:)),
            name: .EAAccessoryDidConnect,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(accessoryDidDisconnect(_:)),
            name: .EAAccessoryDidDisconnect,
            object: nil
        )
        EAAccessoryManager.shared().registerForLocalNotifications()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        readBuffer.deallocate()
    }

    @objc(connectAccessory:rejecter:)
    func connectAccessory(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        let accessories = EAAccessoryManager.shared().connectedAccessories
        guard let accessory = accessories.first(where: { $0.protocolStrings.contains(protocolString) }) else {
            reject("ACCESSORY_NOT_FOUND", "No MFi AED IR Receiver found with protocol \(protocolString)", nil)
            return
        }

        activeAccessory = accessory
        activeSession = EASession(accessory: accessory, forProtocol: protocolString)

        if let session = activeSession {
            inputStream = session.inputStream
            inputStream?.delegate = self
            inputStream?.schedule(in: .current, forMode: .default)
            inputStream?.open()

            outputStream = session.outputStream
            outputStream?.open()

            resolve([
                "name": accessory.name,
                "manufacturer": accessory.manufacturer,
                "modelNumber": accessory.modelNumber,
                "serialNumber": accessory.serialNumber,
                "protocolString": protocolString
            ])
        } else {
            reject("SESSION_FAILED", "Failed to create EASession with MFi accessory.", nil)
        }
    }

    @objc func accessoryDidConnect(_ notification: Notification) {
        if let accessory = notification.userInfo?[EAAccessoryKey] as? EAAccessory {
            if accessory.protocolStrings.contains(protocolString) {
                sendEvent(withName: "onAccessoryAttached", body: [
                    "name": accessory.name,
                    "serialNumber": accessory.serialNumber
                ])
            }
        }
    }

    @objc func accessoryDidDisconnect(_ notification: Notification) {
        if let accessory = notification.userInfo?[EAAccessoryKey] as? EAAccessory {
            if accessory == activeAccessory {
                inputStream?.close()
                outputStream?.close()
                activeSession = nil
                activeAccessory = nil
                sendEvent(withName: "onAccessoryDetached", body: nil)
            }
        }
    }

    func stream(_ aStream: Stream, handle eventCode: Stream.Event) {
        if eventCode == .hasBytesAvailable {
            if let stream = aStream as? InputStream {
                let bytesRead = stream.read(readBuffer, maxLength: 1024)
                if bytesRead > 0 {
                    let data = Data(bytes: readBuffer, count: bytesRead)
                    let hexString = data.map { String(format: "%02hhX", $0) }.joined(separator: " ")
                    sendEvent(withName: "onAccessoryData", body: ["hex": hexString, "byteLength": bytesRead])
                }
            }
        }
    }
}
