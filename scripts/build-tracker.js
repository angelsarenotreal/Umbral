const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const resourcesDir = path.join(__dirname, '..', 'resources')
const outExe = path.join(resourcesDir, 'riot_tracker.exe')
const csFile = path.join(resourcesDir, 'RiotTracker.cs')

const csSource = `
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class RiotTracker {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);
    [DllImport("user32.dll")] public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll")] public static extern bool SetProcessWindowStation(IntPtr hWinSta);
    [DllImport("user32.dll")] public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll")] public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    public struct RECT { public int Left, Top, Right, Bottom; }

    static IntPtr cachedRiotHwnd = IntPtr.Zero;
    static uint cachedRiotPid = 0;

    public static void Main(string[] args) {
        long overlayHwndVal = args.Length > 0 ? long.Parse(args[0]) : 0;

        IntPtr hStation = OpenWindowStation("winsta0", false, 0x037F);
        if (hStation != IntPtr.Zero) SetProcessWindowStation(hStation);
        IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        int lastX = -99999, lastY = -99999, lastW = -99999, lastH = -99999;
        bool lastFg = false, lastVisible = false;

        while (true) {
            if (cachedRiotHwnd == IntPtr.Zero || !IsWindowVisible(cachedRiotHwnd)) {
                cachedRiotHwnd = IntPtr.Zero;
                cachedRiotPid = 0;
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
                    try { pName = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName.ToLower(); } catch {}
                    if (pName.Contains("umbral") || pName.Contains("antigravity") || pName.Contains("electron")) return true;

                    StringBuilder t = new StringBuilder(256);
                    GetWindowText(hWnd, t, 256);
                    string title = t.ToString();
                    StringBuilder cls = new StringBuilder(256);
                    GetClassName(hWnd, cls, 256);

                    if ((pName == "riot client" || pName == "riotclientux" || pName == "leagueclient" || pName == "leagueclientux" || title == "Riot Client") && cls.ToString() == "Chrome_WidgetWin_1") {
                        cachedRiotHwnd = hWnd;
                        cachedRiotPid = pid;
                        return false;
                    }
                    return true;
                }, IntPtr.Zero);
            }

            if (cachedRiotHwnd != IntPtr.Zero) {
                bool isMin = IsIconic(cachedRiotHwnd);
                bool isVis = IsWindowVisible(cachedRiotHwnd) && !isMin;
                RECT r;
                GetWindowRect(cachedRiotHwnd, out r);
                int winW = r.Right - r.Left;
                int winH = r.Bottom - r.Top;
                IntPtr fg = GetForegroundWindow();

                uint fgPid = 0;
                if (fg != IntPtr.Zero) GetWindowThreadProcessId(fg, out fgPid);

                bool isFg = isVis && (
                    fg == cachedRiotHwnd ||
                    (cachedRiotPid != 0 && fgPid == cachedRiotPid) ||
                    (overlayHwndVal != 0 && fg.ToInt64() == overlayHwndVal)
                );

                if (r.Left != lastX || r.Top != lastY || winW != lastW || winH != lastH || isFg != lastFg || isVis != lastVisible) {
                    lastX = r.Left; lastY = r.Top; lastW = winW; lastH = winH; lastFg = isFg; lastVisible = isVis;
                    Console.WriteLine(string.Format("UPDATE:{0}:{1}:{2}:{3}:{4}:{5}:{6}",
                        cachedRiotHwnd.ToInt64(), r.Left, r.Top, winW, winH, isFg, isVis));
                }
            } else {
                if (lastVisible) {
                    lastVisible = false;
                    lastFg = false;
                    Console.WriteLine("CLOSED");
                }
            }

            Thread.Sleep(8); // 120fps ultra-smooth tracking
        }
    }
}
`

if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true })
}

fs.writeFileSync(csFile, csSource.trim(), 'utf8')

try {
  execSync('taskkill /F /IM riot_tracker.exe', { stdio: 'ignore' })
} catch {}

const csc = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'
execSync(`"${csc}" /target:exe /out:"${outExe}" /nologo "${csFile}"`, { stdio: 'ignore' })
if (fs.existsSync(csFile)) fs.unlinkSync(csFile)

console.log('Successfully recompiled pure tracker!')
