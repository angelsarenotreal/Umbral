import { app, BrowserWindow, screen } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'

const RIOT_PROCESS_NAMES = [
  'Riot Client',
  'RiotClientServices',
  'RiotClientUx',
  'LeagueClient',
  'LeagueClientUx'
]

// Calibrated for top-left of Riot Client thumbnail artwork image
const OVERLAY_WIDTH = 280
const OVERLAY_HEIGHT = 370
const DEFAULT_OFFSET_X = 0.280 // ~28.0% from left of Riot Client window (higher & slightly right inside artwork)
const DEFAULT_OFFSET_Y = 0.038 // ~3.8% from top of Riot Client window (top aligned with artwork header)

let trackerProcess: ChildProcess | null = null
let monitorInterval: NodeJS.Timeout | null = null
let testTimeout: NodeJS.Timeout | null = null
let lastRiotHwnd: number | null = null
let isTestModeActive = false

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface RiotState {
  running: boolean
  focused: boolean
  bounds: WindowBounds | null
  hwnd: number | null
  title?: string
  processName?: string
}

let currentRiotState: RiotState = {
  running: false,
  focused: false,
  bounds: null,
  hwnd: null
}

export function getCurrentRiotState(): RiotState {
  return { ...currentRiotState }
}

function getTrackerExePath(): string {
  const unpackedPath = join(app.getAppPath().replace('app.asar', 'app.asar.unpacked'), 'resources', 'riot_tracker.exe')
  const resourcesPath = join(process.resourcesPath || '', 'resources', 'riot_tracker.exe')
  const resourcesRootPath = join(process.resourcesPath || '', 'riot_tracker.exe')
  const devPath = join(__dirname, '../../resources/riot_tracker.exe')
  const cwdPath = join(process.cwd(), 'resources', 'riot_tracker.exe')

  const possiblePaths = [unpackedPath, resourcesPath, resourcesRootPath, devPath, cwdPath]
  for (const p of possiblePaths) {
    if (p && !p.includes('app.asar\\') && !p.includes('app.asar/') && existsSync(p)) {
      return p
    }
  }
  return ''
}

function runPowerShellEncoded(script: string): Promise<string> {
  return new Promise((resolve) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const ps = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded],
      { windowsHide: true }
    )

    let stdout = ''
    ps.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    ps.on('close', () => {
      resolve(stdout.trim())
    })
    ps.on('error', () => {
      resolve('')
    })
    setTimeout(() => {
      try {
        ps.kill()
      } catch {}
      resolve(stdout.trim())
    }, 3000)
  })
}

/**
 * Searches for Riot Client by interactive desktop windows via Win32 API (fallback).
 */
async function getRiotWindowInfo(overlayHwnd = 0): Promise<RiotState> {
  const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class UmbralRiotHunter {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);
  [DllImport("user32.dll")] public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);
  [DllImport("user32.dll")] public static extern bool SetProcessWindowStation(IntPtr hWinSta);
  [DllImport("user32.dll")] public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
  [DllImport("user32.dll")] public static extern bool SetThreadDesktop(IntPtr hDesktop);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }

  public static string FindRiot(long overlayHwndVal) {
    IntPtr hStation = OpenWindowStation("winsta0", false, 0x037F);
    if (hStation != IntPtr.Zero) SetProcessWindowStation(hStation);
    IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
    if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

    IntPtr fg = GetForegroundWindow();
    IntPtr foundHwnd = IntPtr.Zero;
    RECT foundRect = new RECT();
    string foundTitle = "";
    string foundProc = "";
    bool isFg = false;
    int maxArea = 0;

    EnumDesktopWindows(hDesk, (hWnd, lParam) => {
      if (!IsWindowVisible(hWnd)) return true;
      RECT r;
      GetWindowRect(hWnd, out r);
      int w = r.Right - r.Left;
      int h = r.Bottom - r.Top;
      if (w < 400 || h < 300) return true;

      uint pid = 0;
      GetWindowThreadProcessId(hWnd, out pid);
      string pName = "";
      try {
        pName = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName;
      } catch {}

      string pLower = pName.ToLower();
      if (pLower == "antigravity" || pLower == "electron" || pLower == "code" || pLower.Contains("umbral")) return true;

      StringBuilder t = new StringBuilder(256);
      GetWindowText(hWnd, t, 256);
      string title = t.ToString();

      StringBuilder cls = new StringBuilder(256);
      GetClassName(hWnd, cls, 256);
      string className = cls.ToString();

      bool isRiotProc = (pLower == "riot client" || pLower == "riotclientservices" || pLower == "riotclientux" || pLower == "leagueclient" || pLower == "leagueclientux");
      bool isRiotTitle = (title.Equals("Riot Client", StringComparison.OrdinalIgnoreCase) || title.StartsWith("League of Legends", StringComparison.OrdinalIgnoreCase));

      if ((isRiotProc || isRiotTitle) && className == "Chrome_WidgetWin_1") {
        int area = w * h;
        if (area > maxArea) {
          maxArea = area;
          foundHwnd = hWnd;
          foundRect = r;
          foundTitle = title;
          foundProc = pName;
          isFg = (fg == hWnd || (overlayHwndVal != 0 && fg.ToInt64() == overlayHwndVal));
        }
      }
      return true;
    }, IntPtr.Zero);

    if (foundHwnd == IntPtr.Zero) return "NOT_RUNNING";
    int winW = foundRect.Right - foundRect.Left;
    int winH = foundRect.Bottom - foundRect.Top;
    return string.Format("RUNNING,{0},{1},{2},{3},{4},{5},{6}",
      foundHwnd.ToInt64(), foundRect.Left, foundRect.Top, winW, winH, isFg, foundProc, foundTitle);
  }
}
"@ -ErrorAction SilentlyContinue

[UmbralRiotHunter]::FindRiot(${overlayHwnd})
`

  try {
    const stdout = await runPowerShellEncoded(psScript)
    const line =
      stdout
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('RUNNING') || l === 'NOT_RUNNING') || ''

    if (!line || line === 'NOT_RUNNING') {
      return { running: false, focused: false, bounds: null, hwnd: null }
    }

    const parts = line.split(',')
    if (parts[0] !== 'RUNNING' || parts.length < 7) {
      return { running: false, focused: false, bounds: null, hwnd: null }
    }

    const [, hwndStr, xStr, yStr, wStr, hStr, focusedStr, procName, title] = parts
    return {
      running: true,
      focused: focusedStr?.toLowerCase().includes('true') ?? false,
      bounds: {
        x: parseInt(xStr),
        y: parseInt(yStr),
        width: parseInt(wStr),
        height: parseInt(hStr)
      },
      hwnd: parseInt(hwndStr),
      processName: procName || 'Riot Client',
      title: title || 'Riot Client'
    }
  } catch {
    return { running: false, focused: false, bounds: null, hwnd: null }
  }
}

/**
 * Calculates overlay position taking into account screen DPI scaling.
 */
export function calculateOverlayPosition(
  riotBounds: WindowBounds,
  offsetXPc = DEFAULT_OFFSET_X,
  offsetYPc = DEFAULT_OFFSET_Y,
  overlayW = OVERLAY_WIDTH,
  overlayH = OVERLAY_HEIGHT
): { x: number; y: number; width: number; height: number } {
  const display = screen.getDisplayMatching(riotBounds)
  const scale = display.scaleFactor || 1

  const dipRiotBounds = {
    x: Math.round(riotBounds.x / scale),
    y: Math.round(riotBounds.y / scale),
    width: Math.round(riotBounds.width / scale),
    height: Math.round(riotBounds.height / scale)
  }

  const fieldLeftX = dipRiotBounds.x + dipRiotBounds.width * offsetXPc
  const fieldTopY = dipRiotBounds.y + dipRiotBounds.height * offsetYPc

  return {
    x: Math.round(fieldLeftX),
    y: Math.round(fieldTopY),
    width: overlayW,
    height: overlayH
  }
}

/**
 * Positions and displays the overlay window.
 */
export function showOverlayAtRiot(overlayWindow: BrowserWindow, riotBounds: WindowBounds): void {
  if (overlayWindow.isDestroyed()) return
  const pos = calculateOverlayPosition(riotBounds)
  overlayWindow.setBounds(pos)
  if (!overlayWindow.isVisible()) {
    overlayWindow.showInactive()
  }
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
}

/**
 * Force test-trigger the overlay for testing.
 */
export function testOverlay(overlayWindow: BrowserWindow, durationMs = 10000): void {
  if (overlayWindow.isDestroyed()) return

  if (testTimeout) {
    clearTimeout(testTimeout)
    testTimeout = null
  }

  isTestModeActive = true
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)

  const pos = {
    x: display.bounds.x + Math.round((display.bounds.width - OVERLAY_WIDTH) / 2),
    y: display.bounds.y + Math.round((display.bounds.height - OVERLAY_HEIGHT) / 2.5),
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT
  }

  overlayWindow.setBounds(pos)
  overlayWindow.show()
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.focus()

  testTimeout = setTimeout(() => {
    isTestModeActive = false
    if (!overlayWindow.isDestroyed()) {
      overlayWindow.hide()
    }
  }, durationMs)
}

/**
 * Toggle overlay manually (for global shortcut Ctrl+Shift+O).
 */
export function toggleOverlay(overlayWindow: BrowserWindow): boolean {
  if (overlayWindow.isDestroyed()) return false

  if (overlayWindow.isVisible()) {
    overlayWindow.hide()
    isTestModeActive = false
    if (testTimeout) clearTimeout(testTimeout)
    return false
  } else {
    testOverlay(overlayWindow, 15000)
    return true
  }
}

/**
 * Start real-time 60fps tracking for Riot Client window.
 */
export function startProcessMonitor(
  overlayWindow: BrowserWindow,
  onStateChange: (state: RiotState) => void
): void {
  stopProcessMonitor()

  let overlayHwndVal = 0
  try {
    if (!overlayWindow.isDestroyed()) {
      const handleBuf = overlayWindow.getNativeWindowHandle()
      overlayHwndVal = Number(handleBuf.readBigInt64LE(0))
    }
  } catch {}

  const trackerExe = getTrackerExePath()

  if (trackerExe && existsSync(trackerExe)) {
    console.log(`[Umbral WindowManager] Starting native 60fps tracker: ${trackerExe}`)
    try {
      trackerProcess = spawn(
        trackerExe,
        [
          String(overlayHwndVal),
          String(DEFAULT_OFFSET_X),
          String(DEFAULT_OFFSET_Y),
          String(OVERLAY_WIDTH),
          String(OVERLAY_HEIGHT)
        ],
        {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'ignore']
        }
      )

      trackerProcess.on('error', (err) => {
        console.warn('[Umbral WindowManager] Native tracker process error, using fallback:', err)
        trackerProcess = null
      })

      let buffer = ''
      trackerProcess.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8')
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line) continue

          if (line.startsWith('UPDATE:')) {
            const parts = line.split(':')
            if (parts.length >= 8) {
              const [, hwndStr, xStr, yStr, wStr, hStr, isFgStr, isVisStr] = parts
              const hwnd = parseInt(hwndStr)
              const x = parseInt(xStr)
              const y = parseInt(yStr)
              const width = parseInt(wStr)
              const height = parseInt(hStr)
              const isFg = isFgStr.toLowerCase() === 'true'
              const isVis = isVisStr.toLowerCase() === 'true'

              lastRiotHwnd = hwnd
              currentRiotState = {
                running: isVis,
                focused: isFg,
                bounds: { x, y, width, height },
                hwnd,
                processName: 'Riot Client',
                title: 'Riot Client'
              }

              onStateChange(currentRiotState)

              if (!isTestModeActive) {
                if (isFg && isVis) {
                  showOverlayAtRiot(overlayWindow, { x, y, width, height })
                } else {
                  if (!overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
                    overlayWindow.hide()
                  }
                }
              }
            }
          } else if (line === 'CLOSED') {
            currentRiotState = { running: false, focused: false, bounds: null, hwnd: null }
            onStateChange(currentRiotState)
            if (!overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
              overlayWindow.hide()
            }
          }
        }
      })

      trackerProcess.on('exit', () => {
        trackerProcess = null
      })

      return
    } catch (e: any) {
      console.warn('[Umbral WindowManager] Failed to launch native tracker, falling back to polling:', e)
    }
  }

  // Fallback Poller if exe is missing
  console.log('[Umbral WindowManager] Starting fallback polling monitor (200ms)...')
  const poll = async () => {
    const state = await getRiotWindowInfo(overlayHwndVal)
    currentRiotState = state
    onStateChange(state)

    if (!isTestModeActive) {
      if (state.running && state.focused && state.bounds) {
        lastRiotHwnd = state.hwnd
        showOverlayAtRiot(overlayWindow, state.bounds)
      } else {
        if (!overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
          overlayWindow.hide()
        }
      }
    }
  }

  poll()
  monitorInterval = setInterval(poll, 250)
}

export function stopProcessMonitor(): void {
  if (trackerProcess) {
    try {
      trackerProcess.kill()
    } catch {}
    trackerProcess = null
  }
  if (monitorInterval) {
    clearInterval(monitorInterval)
    monitorInterval = null
  }
  if (testTimeout) {
    clearTimeout(testTimeout)
    testTimeout = null
  }
}

export function getLastRiotHwnd(): number | null {
  return lastRiotHwnd
}
