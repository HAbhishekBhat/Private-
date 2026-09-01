# AED Event Capture & Logging Mobile App (Cross-Platform)

[![Tests: 14/14 Passed](https://img.shields.io/badge/Tests-14%2F14%20Passing-brightgreen)](https://github.com/)
[![React Native: 0.76.1](https://img.shields.io/badge/React%20Native-0.76.1-blue)](https://reactnative.dev/)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-5.7.2%20Strict-blue)](https://www.typescriptlang.org/)
[![License: Medical Open Standard](https://img.shields.io/badge/License-Medical%20Audit-lightgrey)](https://github.com/)

A medical-grade, cross-platform React Native mobile application for emergency-adjacent AED (Automated External Defibrillator) telemetry capture, decoding, and audit-grade persistence via a wired USB-C optical IR receiver dongle.

---

## Key Features

1. **Platform-Agnostic Transport (`ITransportService`)**:
   - **Android**: Direct wired USB-C OTG Host ingestion via `android.hardware.usb.UsbManager` with runtime attach/detach broadcast receivers.
   - **iOS (MFi Branch)**: Apple External Accessory framework (`EASession`) for MFi-certified dongles.
   - **iOS (Fallback Branch)**: Bluetooth Low Energy (BLE) GATT Nordic UART bridge fallback for non-MFi hardware.
   - **Simulator**: Deterministic cardiac arrest scenario playback engine for development, QA, and clinical testing.
2. **Deterministic Event Parser Engine**:
   - Pure TypeScript, zero native dependencies.
   - Externalized, versioned protocol lookup schema (`aed_protocol_v1.json`).
   - Monotonic timestamping, raw hex retention, and unknown opcode preservation without byte loss.
3. **Dual-Write Storage Architecture**:
   - **Target A (Raw Disk Stream)**: Append-only flat file (`.rawlog`) capturing raw binary packets exactly as received.
   - **Target B (Structured SQLite Store)**: Relational events table protected by **SQL Immutability Triggers** rejecting unauthorized `UPDATE` or `DELETE` operations.
   - **Audit Seal**: Cryptographic **SHA-256 integrity digest** computed over the entire raw log upon session completion.
4. **Medical-Grade High-Contrast UI**:
   - Persistent, unmissable sticky connection status header with detached grace recovery timer (retains session across cable dislodgements).
   - Glanceable Hero Critical Event Banner (`SHOCK_ADVISED`, `SHOCK_DELIVERED` with Joules, Amps, and Patient Impedance).
   - Auto-scrolling virtualized live event log with smart scroll lock and "Jump to Live (↓)" button.
   - Structural read-only presentation (zero edit affordances anywhere in the UI).

---

## Quick Start Guide (Fresh Clone)

### 1. Clone the Repository & Install Dependencies

```bash
git clone <repository-url>
cd aed-event-capture

# Install all JavaScript/TypeScript dependencies
npm install
```

### 2. Run Automated Test Suite (14 Tests)

Verify unit framing, event parsing, immutability triggers, and reconnect tolerance:

```bash
npm test
```

To run with coverage reporting:
```bash
npm run test:coverage
```

### 3. Run End-to-End Terminal Simulation

Execute the full 14-step sudden cardiac arrest rescue scenario with dual-write verification and SHA-256 integrity hashing:

```bash
npm run simulate
```

### 4. Run the Mobile Application (React Native CLI)

#### Start Metro Bundler:
```bash
npm start
```

#### Run on Android (Emulator or USB Connected Device):
```bash
npm run android
```
*(Requires Android SDK and Java 17)*

#### Run on iOS (macOS Simulator or Device):
```bash
# Install CocoaPods dependencies (first time only)
cd ios && pod install && cd ..

# Launch iOS Simulator
npm run ios
```

---

## Build for Production Release

### Android APK / AAB Release Build
```bash
cd android
./gradlew assembleRelease
```
*Generated APK location: `android/app/build/outputs/apk/release/app-release.apk`*

### iOS Production Archive (macOS)
Open `ios/AEDEventCapture.xcworkspace` in Xcode, select **Generic iOS Device**, and click **Product $\rightarrow$ Archive**.

---

## Project Structure

```
.
├── __tests__/                  # Automated test suites (Jest + ts-jest)
│   ├── Framer.test.ts          # Binary framing & packetization tests
│   ├── EventParser.test.ts     # Clinical code decoding & unknown frame tests
│   ├── DualWriteStorage.test.ts# Dual-write & SQL immutability trigger tests
│   └── SessionManager.test.ts  # Session lifecycle & reconnect grace tests
├── android/                    # Native Android project
│   └── app/src/main/
│       ├── AndroidManifest.xml # USB Host permissions & attach filters
│       └── java/.../
│           ├── MainActivity.kt
│           ├── MainApplication.kt
│           └── UsbSerialModule.kt # Native USB-Serial CDC/FTDI driver
├── ios/                        # Native iOS project
│   ├── Podfile                 # CocoaPods configuration
│   └── AEDEventCapture/
│       ├── Info.plist          # MFi protocol strings & background modes
│       ├── AppDelegate.mm
│       └── ExternalAccessoryBridge.swift # Native Apple MFi EASession driver
├── docs/                       # Architecture & Design documentation
│   ├── ARCHITECTURE_DECISION_RECORD.md # MFi strategy, storage schema, ADR 001
│   └── UI_DESIGN_SYSTEM.md    # Medical ergonomics & color contrast spec
├── src/
│   ├── core/
│   │   ├── parser/             # Framer.ts & EventParser.ts
│   │   ├── protocol/           # aed_protocol_v1.json (Code registry)
│   │   ├── session/            # SessionManager.ts (State machine orchestrator)
│   │   └── types/              # transport.ts & events.ts (Strict typings)
│   ├── storage/
│   │   ├── schema.ts           # SQLite DDL & immutability triggers
│   │   ├── SessionWriteRepository.ts # Write-only dual-write engine
│   │   ├── SessionReadRepository.ts  # Read-only query & export engine
│   │   └── drivers/            # Database and FileSystem storage drivers
│   ├── transport/
│   │   ├── ITransportService.ts
│   │   ├── TransportFactory.ts # Resolves Android USB / iOS MFi / BLE / Mock
│   │   ├── AndroidUsbSerialTransport.ts
│   │   ├── IosExternalAccessoryTransport.ts
│   │   ├── IosBleFallbackTransport.ts
│   │   └── MockSimulatorTransport.ts # Deterministic scenario playback engine
│   ├── ui/
│   │   ├── components/         # ConnectionStatusBar, CriticalBanner, LiveList
│   │   ├── screens/            # LiveCapture, History, Detail, Simulator
│   │   └── theme/              # WCAG AAA Dark/Light themes & typography
│   ├── App.tsx                 # Root medical UI container with tab navigation
│   ├── index.ts                # Public library exports
│   └── cli/
│       └── simulate.ts         # CLI End-to-end simulation runner
├── app.json                    # React Native app descriptor
├── index.js                    # React Native AppRegistry entry
├── metro.config.js             # Metro bundler config
└── tsconfig.json               # TypeScript strict configuration
```

---

## Canonical Protocol Event Vocabulary

| Hex Code | Semantic Label | Severity | Critical | Description |
| :---: | :--- | :---: | :---: | :--- |
| `0x01` | `AED Powered On` | `INFO` | No | Unit turned on, optical IR active |
| `0x02` | `Self-Test Passed` | `INFO` | No | Internal hardware circuitry OK |
| `0x03` | `Self-Test Failed` | `CRITICAL` | **Yes** | Internal fault, service required |
| `0x10` | `Electrode Pads Disconnected` | `WARNING` | No | Open circuit / pads off patient |
| `0x11` | `Electrode Pads Connected` | `INFO` | No | Skin contact valid (Impedance $\Omega$) |
| `0x20` | `Analyzing Heart Rhythm` | `WARNING` | No | ECG algorithm running |
| `0x30` | `Shock Advised - Stand Clear` | `CRITICAL` | **Yes** | Shockable rhythm (VF/VT) confirmed |
| `0x31` | `No Shock Advised` | `INFO` | No | Non-shockable rhythm |
| `0x32` | `Capacitor Charging` | `WARNING` | No | High voltage ramping |
| `0x33` | `Shock Armed - Press Button`| `CRITICAL` | **Yes** | Ready for discharge |
| `0x34` | `Shock Delivered` | `CRITICAL` | **Yes** | Biphasic shock discharged (Joules, Amps) |
| `0x40` | `Start CPR / Compressions` | `INFO` | No | Voice prompt to start chest compressions |
| `0x41` | `CPR Metronome Active` | `INFO` | No | Compressions pacing at 100-120 bpm |
| `0x42` | `Pause CPR - Re-evaluating` | `WARNING` | No | 2-minute cycle complete |
| `0x50` | `Low Battery Warning` | `WARNING` | No | Battery reserve < 15% |
| *Other*| `Unknown AED Telemetry Frame` | `UNKNOWN` | No | Unmapped opcode, raw payload preserved |

---

## Verification & Quality Assurance

- **100% Pass Rate**: All 14 automated test suites passing.
- **Zero Type Errors**: `npx tsc --noEmit` validated against strict TypeScript.
- **Audit Immutability Tested**: Direct SQL updates/deletes verified to be blocked by SQLite triggers.
