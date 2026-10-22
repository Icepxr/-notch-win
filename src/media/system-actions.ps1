param([switch]$Once, [int]$PollMs = 120)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

# Reads OS state only: no audio/brightness setters and no keyboard hook.
Add-Type -ReferencedAssemblies System.Management -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Management;
using System.Threading;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class IsletDeviceEnumerator {}
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IsletEnumerator {
    int EnumAudioEndpoints(int flow, uint mask, out IntPtr devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IsletDevice device);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IsletDevice {
    [PreserveSig] int Activate(ref Guid iid, uint context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object instance);
    int OpenPropertyStore(uint access, out IntPtr properties);
    [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
}
[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IsletEndpoint {
    int RegisterControlChangeNotify(IntPtr callback);
    int UnregisterControlChangeNotify(IntPtr callback);
    int GetChannelCount(out uint count);
    int SetMasterVolumeLevel(float level, IntPtr context);
    int SetMasterVolumeLevelScalar(float level, IntPtr context);
    [PreserveSig] int GetMasterVolumeLevel(out float level);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
    int SetChannelVolumeLevel(uint channel, float level, IntPtr context);
    int SetChannelVolumeLevelScalar(uint channel, float level, IntPtr context);
    int GetChannelVolumeLevel(uint channel, out float level);
    int GetChannelVolumeLevelScalar(uint channel, out float level);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool muted, IntPtr context);
    [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool muted);
}
public class IsletHardwareSnapshot {
    public int? Volume;
    public bool? Muted;
    public int? Brightness;
    public long BrightnessSerial;
    public bool CapsLock;
}
public class IsletHardware : IDisposable {
    [DllImport("user32.dll")] static extern short GetKeyState(int key);
    IsletEnumerator enumerator;
    IsletEndpoint endpoint;
    string endpointId;
    DateTime nextDeviceCheck = DateTime.MinValue;
    ManagementEventWatcher brightnessWatcher;
    readonly object brightnessLock = new object();
    int? brightness;
    long brightnessSerial;
    public IsletHardware(bool watch) {
        try { enumerator = (IsletEnumerator)new IsletDeviceEnumerator(); } catch {}
        try {
            using (var search = new ManagementObjectSearcher("root\\wmi", "SELECT CurrentBrightness FROM WmiMonitorBrightness WHERE Active=TRUE"))
            using (var results = search.Get()) {
                foreach (ManagementObject monitor in results) { brightness = Convert.ToInt32(monitor["CurrentBrightness"]); monitor.Dispose(); break; }
            }
        } catch {}
        if (watch) try {
            brightnessWatcher = new ManagementEventWatcher("root\\wmi", "SELECT * FROM WmiMonitorBrightnessEvent");
            brightnessWatcher.EventArrived += (sender, args) => {
                try { lock (brightnessLock) { brightness = Convert.ToInt32(args.NewEvent["Brightness"]); brightnessSerial++; } } catch {}
            };
            brightnessWatcher.Start();
        } catch { if (brightnessWatcher != null) brightnessWatcher.Dispose(); brightnessWatcher = null; }
    }
    void CheckDevice() {
        IsletDevice device = null;
        try {
            if (enumerator == null) enumerator = (IsletEnumerator)new IsletDeviceEnumerator();
            Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
            string id; Marshal.ThrowExceptionForHR(device.GetId(out id));
            if (endpoint == null || id != endpointId) {
                if (endpoint != null) Marshal.ReleaseComObject(endpoint);
                endpoint = null; endpointId = id;
                var iid = typeof(IsletEndpoint).GUID;
                object instance;
                Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23, IntPtr.Zero, out instance));
                endpoint = (IsletEndpoint)instance;
            }
        } catch {
            if (endpoint != null) Marshal.ReleaseComObject(endpoint);
            endpoint = null; endpointId = null;
        } finally { if (device != null) Marshal.ReleaseComObject(device); }
    }
    public IsletHardwareSnapshot Read() {
        if (DateTime.UtcNow >= nextDeviceCheck) { CheckDevice(); nextDeviceCheck = DateTime.UtcNow.AddSeconds(2); }
        var result = new IsletHardwareSnapshot();
        try {
            if (endpoint != null) {
                float level; bool muted;
                Marshal.ThrowExceptionForHR(endpoint.GetMasterVolumeLevelScalar(out level));
                Marshal.ThrowExceptionForHR(endpoint.GetMute(out muted));
                result.Volume = (int)Math.Round(level * 100); result.Muted = muted;
            }
        } catch { nextDeviceCheck = DateTime.MinValue; }
        lock (brightnessLock) { result.Brightness = brightness; result.BrightnessSerial = brightnessSerial; }
        result.CapsLock = (GetKeyState(0x14) & 1) != 0;
        return result;
    }
    public void Dispose() {
        if (brightnessWatcher != null) { try { brightnessWatcher.Stop(); } catch {} brightnessWatcher.Dispose(); }
        if (endpoint != null) Marshal.ReleaseComObject(endpoint);
        if (enumerator != null) Marshal.ReleaseComObject(enumerator);
    }
}
'@

$hardware = New-Object IsletHardware(-not $Once)
try {
    # Console.In is a synchronized TextReader on Windows PowerShell 5; its
    # ReadLineAsync can block before returning. A real StreamReader does not.
    $stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8)
    $shutdown = $stdin.ReadLineAsync()
    do {
        $sample = $hardware.Read()
        @{ type = 'system-actions'; volume = $sample.Volume; muted = $sample.Muted;
           brightness = $sample.Brightness; brightnessSerial = $sample.BrightnessSerial;
           capsLock = $sample.CapsLock } | ConvertTo-Json -Compress | ForEach-Object { [Console]::WriteLine($_) }
        if ($Once) { break }
        Start-Sleep -Milliseconds ([Math]::Max(80, $PollMs))
    } while (-not $shutdown.IsCompleted)
} finally { $hardware.Dispose() }
