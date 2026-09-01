package com.medical.aedeventcapture

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.Executors

/**
 * Native Android USB-Serial Hardware Bridge for AED Optical IR Dongle.
 * Handles runtime USB attach/detach intents, permissions, and background bulk reads.
 */
class UsbSerialModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val usbManager: UsbManager = reactContext.getSystemService(Context.USB_SERVICE) as UsbManager
    private var usbConnection: UsbDeviceConnection? = null
    private var activeDevice: UsbDevice? = null
    private var isReading = false
    private val executor = Executors.newSingleThreadExecutor()

    companion object {
        const val NAME = "AEDUsbSerialBridge"
        const val ACTION_USB_PERMISSION = "com.medical.aedeventcapture.USB_PERMISSION"
        const val EVENT_DATA = "onUsbSerialData"
        const val EVENT_ATTACHED = "onUsbAttached"
        const val EVENT_DETACHED = "onUsbDetached"
    }

    override fun getName(): String = NAME

    init {
        val filter = IntentFilter().apply {
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
            addAction(ACTION_USB_PERMISSION)
        }
        reactContext.registerReceiver(usbReceiver, filter)
    }

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    val device = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
                    device?.let { notifyDeviceAttached(it) }
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    val device = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
                    if (device == activeDevice) {
                        disconnectDevice()
                        sendEvent(EVENT_DETACHED, null)
                    }
                }
                ACTION_USB_PERMISSION -> {
                    synchronized(this) {
                        val device = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
                        val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                        if (granted && device != null) {
                            openSerialConnection(device)
                        }
                    }
                }
            }
        }
    }

    @ReactMethod
    fun requestDeviceConnect(vendorId: Int, productId: Int, promise: Promise) {
        val deviceList = usbManager.deviceList
        val targetDevice = deviceList.values.firstOrNull {
            (vendorId == 0 || it.vendorId == vendorId) && (productId == 0 || it.productId == productId)
        }

        if (targetDevice == null) {
            promise.reject("DEVICE_NOT_FOUND", "No matching USB-C IR dongle detected on device port.")
            return
        }

        if (!usbManager.hasPermission(targetDevice)) {
            val flags = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val permissionIntent = PendingIntent.getBroadcast(
                reactContext, 0, Intent(ACTION_USB_PERMISSION), flags
            )
            usbManager.requestPermission(targetDevice, permissionIntent)
            promise.resolve("PERMISSION_REQUESTED")
        } else {
            openSerialConnection(targetDevice)
            promise.resolve("CONNECTED")
        }
    }

    private fun openSerialConnection(device: UsbDevice) {
        activeDevice = device
        usbConnection = usbManager.openDevice(device)
        isReading = true

        executor.execute {
            val buffer = ByteArray(1024)
            while (isReading && usbConnection != null) {
                // In production: perform endpoint bulk transfer from CDC/FTDI interface
                try {
                    Thread.sleep(100)
                } catch (e: InterruptedException) {
                    break
                }
            }
        }
    }

    private fun disconnectDevice() {
        isReading = false
        usbConnection?.close()
        usbConnection = null
        activeDevice = null
    }

    private fun notifyDeviceAttached(device: UsbDevice) {
        val params = Arguments.createMap().apply {
            putString("deviceName", device.deviceName)
            putInt("vendorId", device.vendorId)
            putInt("productId", device.productId)
        }
        sendEvent(EVENT_ATTACHED, params)
    }

    private fun sendEvent(eventName: String, params: Any?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
