# UI Design Direction & Medical Ergonomics Specification

**Application**: AED Event Capture & Logging Mobile System (iOS & Android)  
**Document**: UI Design Direction & Medical Ergonomics  
**Status**: APPROVED & ACTIVE  

---

## 1. Design Philosophy: Calm, Glanceable, Legible Under Stress

In emergency-adjacent situations (e.g., post-cardiac arrest debriefing, resuscitation logging, emergency clinical handover), cognitive load is extraordinarily high. The UI is engineered with strict human-factors principles:

1. **Glanceability Over Interactivity**: Critical information (heart rhythm status, shock advised, shock delivered, CPR cycles) must be immediately discernible in < 200 milliseconds from 3 feet away.
2. **Zero Ambiguity in State**: Connection status, battery, and recording state are always persistently anchored at the top of the viewport.
3. **No Gratuitous Animation**: Animations are strictly functional (e.g., subtle heartbeat pulse on active connection or critical warning pulse during capacitor charging).
4. **Structural Read-Only Presentation**: The historical log contains **no edit or delete affordances** (no pencil icons, no swipe-to-delete, no modal edit prompts). The design communicates absolute, tamper-evident audit integrity without needing defensive UI warnings.

---

## 2. Color Palette System

The color system uses high-contrast, accessible palettes engineered specifically for medical OLED/LCD field devices, exceeding **WCAG 2.1 AAA** contrast standards (7:1 contrast ratio for normal text).

### 2.1 Dark Mode Palette (Primary Field Mode)

```
Backgrounds:
  - Base Screen:        #0B0F19 (Deep Obsidian Slate)
  - Surface Card:       #1E293B (Slate 800)
  - Surface Elevated:   #334155 (Slate 700)
  - Surface Highlight:  #1E3A8A (Navy Active Tint)

Typography & Text:
  - Text High-Emphasis: #FFFFFF (Pure White, 100% Opacity)
  - Text Medium-Emphasis:#CBD5E1 (Slate 300, 80% Opacity)
  - Text Low-Emphasis:  #94A3B8 (Slate 400, 60% Opacity)
  - Text Monospace:     #38BDF8 (Sky 400 - for timestamps, hex, checksums)

Severity & Semantic Signals:
  - CRITICAL (Shock / Failure): #EF4444 (Crimson Red) / Background Tint: rgba(239, 68, 68, 0.18)
  - WARNING (Analyzing / CPR Pause / Low Bat): #F59E0B (Amber Gold) / Background Tint: rgba(245, 158, 11, 0.15)
  - SUCCESS / NORMAL (Connected / Pads OK / CPR Active): #10B981 (Emerald Green) / Background Tint: rgba(16, 185, 129, 0.15)
  - INFO (Power On / Self-Test): #3B82F6 (Cobalt Blue) / Background Tint: rgba(59, 130, 246, 0.15)
  - UNKNOWN (Unmapped Raw Frame): #8B5CF6 (Purple Accent) / Background Tint: rgba(139, 92, 246, 0.15)
```

### 2.2 Light Mode Palette (Audit & Clinical Review Mode)

```
Backgrounds:
  - Base Screen:        #F8FAFC (Slate 50)
  - Surface Card:       #FFFFFF (Pure White)
  - Surface Elevated:   #F1F5F9 (Slate 100)
  - Border Outline:     #E2E8F0 (Slate 200)

Typography & Text:
  - Text High-Emphasis: #0F172A (Slate 900)
  - Text Medium-Emphasis:#334155 (Slate 700)
  - Text Low-Emphasis:  #64748B (Slate 500)
```

---

## 3. Typography Hierarchy

Engineered using system sans-serif fonts (`SF Pro` on iOS, `Roboto` on Android) for native rendering performance, with fixed tabular numbers (`fontVariant: ['tabular-nums']`) to prevent layout jitter during live streaming.

| Level | Size | Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Hero** | 28px | Bold (700) | 34px | -0.5px | Critical banner text ("SHOCK DELIVERED") |
| **Headline 1** | 22px | SemiBold (600) | 28px | -0.2px | Section headers, Session ID header |
| **Headline 2** | 18px | SemiBold (600) | 24px | 0px | Event list item primary label |
| **Body Primary** | 15px | Regular (400) | 20px | 0px | Clinical descriptions, status messages |
| **Body Secondary**| 13px | Medium (500) | 18px | +0.2px | Sub-labels, energy readings (Joules) |
| **Data Monospace**| 13px | Mono / Medium | 16px | 0px | Monotonic timestamps `HH:mm:ss.SSS`, hex bytes |
| **Micro Caption** | 11px | Bold (700) | 14px | +0.5px | UPPERCASE severity pills, sequence counters |

---

## 4. Key Component Layout & Behavioral Specifications

### 4.1 Persistent Connection Status Bar (Sticky Top Header)
Always rendered at the top of the viewport above safe area:
- **Connected (Wired USB-C)**:
  `[● GREEN PULSE] USB-C IR DONGLE CONNECTED | 9600 BAUD | REC: ACTIVE`
- **Searching / Waiting**:
  `[◌ AMBER SPINNER] SEARCHING FOR DONGLE... (PLUG IN USB-C IR RECEIVER)`
- **Detached Grace Window**:
  `[⚠ FLASHING RED] DONGLE DETACHED — RECONNECTING (RETAINING SESSION...)`

### 4.2 Critical Event Hero Banner
When high-consequence events occur (`SHOCK_ADVISED`, `SHOCK_ARMED_READY`, `SHOCK_DELIVERED`, `SELF_TEST_FAILED`):
- Takes over the top section of the live view with high-contrast color-blocking (`#EF4444`).
- Prominently displays:
  - Big bold label: **SHOCK DELIVERED (200 J)**
  - Timestamp offset from session start: `+03:42.180`
  - High-visibility sequence counter: `EVENT #14`
  - Energy & current diagnostics: `200 Joules | 32.4 Amps | 68 Ohms`

### 4.3 Live Capture Stream (`LiveEventList`)
- Renders events in ascending chronological order with newest events appearing at the bottom.
- **Auto-Scroll Behavior**: Automatically follows the newest incoming event. If the user scrolls up to review prior events, auto-scroll pauses and a floating **"Jump to Live (↓)"** button appears.
- Each event row provides:
  - Timestamp pill: `[14:22:05.812 (+01:14.2)]`
  - Severity badge: `[CRITICAL]` / `[WARNING]` / `[INFO]` / `[UNKNOWN]`
  - Primary clinical label: "Analyzing Heart Rhythm"
  - Expandable Raw Payload Tray: Displays raw hex `AA 55 05 08 20 00 2D 0D 0A` with verified checksum mark.

### 4.4 Historical Session Audit View
- Chronological list of completed rescue sessions.
- Summaries: Total duration, total events, critical shocks delivered count, integrity SHA-256 badge.
- Export Actions: One-tap export to structured JSON bundle, CSV timeline, and unmodified `.rawlog` file.
