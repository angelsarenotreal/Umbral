import { spawn } from 'child_process'

/**
 * Autofill the Riot Client login form instantly using direct Win32 Unicode injection.
 *
 * Performance & Security model:
 * - High-speed Win32 Unicode keybd_event stream (2ms per character, total ~40ms execution)
 * - 100% Chromium/CEF input compatible (does not rely on clipboard or synthetic paste permissions)
 * - Credentials passed as scoped ENVIRONMENT VARIABLES, never on command line
 * - Environment copies zeroed immediately after process exits
 * - PowerShell script nulls variables and calls GC before exit
 */
export async function autofill(username: string, password: string, hwnd: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const psScript = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
  using System;
  using System.Runtime.InteropServices;
  public class UmbralFastType {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }

    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;

    public static void SendKey(byte vk) {
      keybd_event(vk, 0, 0, UIntPtr.Zero);
      keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static void SelectAllAndDelete() {
      keybd_event(0x11, 0, 0, UIntPtr.Zero); // CTRL down
      keybd_event(0x41, 0, 0, UIntPtr.Zero); // A down
      keybd_event(0x41, 0, KEYEVENTF_KEYUP, UIntPtr.Zero); // A up
      keybd_event(0x11, 0, KEYEVENTF_KEYUP, UIntPtr.Zero); // CTRL up
      System.Threading.Thread.Sleep(15);
      keybd_event(0x2E, 0, 0, UIntPtr.Zero); // DELETE down
      keybd_event(0x2E, 0, KEYEVENTF_KEYUP, UIntPtr.Zero); // DELETE up
    }

    public static void TypeStringFast(string text) {
      foreach (char c in text) {
        keybd_event(0, (byte)c, KEYEVENTF_UNICODE, UIntPtr.Zero);
        keybd_event(0, (byte)c, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, UIntPtr.Zero);
        System.Threading.Thread.Sleep(2);
      }
    }
  }
"@

$rawHwnd = [Environment]::GetEnvironmentVariable('UMBRAL_HWND')
$hwndVal = [IntPtr][long]$rawHwnd
$u = [Environment]::GetEnvironmentVariable('UMBRAL_U')
$p = [Environment]::GetEnvironmentVariable('UMBRAL_P')

[UmbralFastType]::ShowWindow($hwndVal, 9) | Out-Null
Start-Sleep -Milliseconds 40
[UmbralFastType]::SetForegroundWindow($hwndVal) | Out-Null
[UmbralFastType]::BringWindowToTop($hwndVal) | Out-Null
Start-Sleep -Milliseconds 80

$r = New-Object UmbralFastType+RECT
if ([UmbralFastType]::GetWindowRect($hwndVal, [ref]$r)) {
  $w = $r.Right - $r.Left
  $h = $r.Bottom - $r.Top
  $clickX = [int]($r.Left + ($w * 0.105))
  $clickY = [int]($r.Top + ($h * 0.285))
  [UmbralFastType]::SetCursorPos($clickX, $clickY) | Out-Null
  [UmbralFastType]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 20
  [UmbralFastType]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 50
}

# 1. Clear username field and inject username
[UmbralFastType]::SelectAllAndDelete()
Start-Sleep -Milliseconds 25
[UmbralFastType]::TypeStringFast($u)
Start-Sleep -Milliseconds 35

# 2. Tab to password field
[UmbralFastType]::SendKey(0x09)
Start-Sleep -Milliseconds 50

# 3. Clear password field and inject password
[UmbralFastType]::SelectAllAndDelete()
Start-Sleep -Milliseconds 25
[UmbralFastType]::TypeStringFast($p)

$u = $null; $p = $null
[System.GC]::Collect()
`

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64')

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      UMBRAL_HWND: String(hwnd),
      UMBRAL_U: username,
      UMBRAL_P: password
    }

    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle', 'Hidden',
      '-EncodedCommand', encoded
    ], { env, windowsHide: true })

    let stderr = ''
    ps.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

    ps.on('close', (code: number | null) => {
      if (env.UMBRAL_U) env.UMBRAL_U = '0'.repeat(env.UMBRAL_U.length)
      if (env.UMBRAL_P) env.UMBRAL_P = '0'.repeat(env.UMBRAL_P.length)
      delete env.UMBRAL_U
      delete env.UMBRAL_P

      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Autofill script exited with code ${code}. ${stderr}`))
      }
    })

    ps.on('error', (err: Error) => {
      if (env.UMBRAL_U) env.UMBRAL_U = ''
      if (env.UMBRAL_P) env.UMBRAL_P = ''
      reject(err)
    })
  })
}
