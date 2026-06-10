param(
  [Parameter(Mandatory = $true)]
  [string]$Keys,

  [string]$ProcessName = "StarCitizen",
  [string]$WindowTitle = "Star Citizen",
  [int]$HoldMs = 35
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName Microsoft.VisualBasic

$target = Get-Process |
  Where-Object {
    $_.MainWindowHandle -ne 0 -and
    (
      $_.ProcessName -like "*$ProcessName*" -or
      $_.MainWindowTitle -like "*$WindowTitle*"
    )
  } |
  Select-Object -First 1

if (-not $target) {
  throw "Target window not found. Start Star Citizen or update bridge/keybinds.json target."
}

[Microsoft.VisualBasic.Interaction]::AppActivate([int]$target.Id) | Out-Null
Start-Sleep -Milliseconds 140

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class KeyboardSender {
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public uint type;
    public KEYBDINPUT ki;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public UIntPtr dwExtraInfo;
  }

  [DllImport("user32.dll", SetLastError = true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

  public const uint INPUT_KEYBOARD = 1;
  public const uint KEYEVENTF_KEYUP = 0x0002;

  public static void SendKey(ushort vk, bool up) {
    INPUT[] inputs = new INPUT[1];
    inputs[0].type = INPUT_KEYBOARD;
    inputs[0].ki.wVk = vk;
    inputs[0].ki.wScan = 0;
    inputs[0].ki.dwFlags = up ? KEYEVENTF_KEYUP : 0;
    inputs[0].ki.time = 0;
    inputs[0].ki.dwExtraInfo = UIntPtr.Zero;
    SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
  }
}
"@

$vk = @{
  "A" = 0x41; "B" = 0x42; "C" = 0x43; "D" = 0x44; "E" = 0x45; "F" = 0x46
  "G" = 0x47; "H" = 0x48; "I" = 0x49; "J" = 0x4A; "K" = 0x4B; "L" = 0x4C
  "M" = 0x4D; "N" = 0x4E; "O" = 0x4F; "P" = 0x50; "Q" = 0x51; "R" = 0x52
  "S" = 0x53; "T" = 0x54; "U" = 0x55; "V" = 0x56; "W" = 0x57; "X" = 0x58
  "Y" = 0x59; "Z" = 0x5A
  "0" = 0x30; "1" = 0x31; "2" = 0x32; "3" = 0x33; "4" = 0x34
  "5" = 0x35; "6" = 0x36; "7" = 0x37; "8" = 0x38; "9" = 0x39
  "TAB" = 0x09; "SPACE" = 0x20; "ENTER" = 0x0D; "ESC" = 0x1B
  "SHIFT" = 0x10; "LSHIFT" = 0xA0; "RSHIFT" = 0xA1
  "CTRL" = 0x11; "LCTRL" = 0xA2; "RCTRL" = 0xA3
  "ALT" = 0x12; "LALT" = 0xA4; "RALT" = 0xA5
  "F1" = 0x70; "F2" = 0x71; "F3" = 0x72; "F4" = 0x73; "F5" = 0x74; "F6" = 0x75
  "F7" = 0x76; "F8" = 0x77; "F9" = 0x78; "F10" = 0x79; "F11" = 0x7A; "F12" = 0x7B
  "UP" = 0x26; "DOWN" = 0x28; "LEFT" = 0x25; "RIGHT" = 0x27
}

function Get-VirtualKey([string]$name) {
  $key = $name.Trim().ToUpperInvariant()
  if (-not $vk.ContainsKey($key)) {
    throw "Unsupported key '$name'. Add it to bridge/send-keys.ps1 if needed."
  }
  return [ushort]$vk[$key]
}

function Send-Chord([string]$chord) {
  [array]$parts = $chord.Split("+") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  if ($parts.Count -eq 0) {
    return
  }

  [array]$keysToSend = $parts | ForEach-Object { Get-VirtualKey $_ }
  $modifiers = @()
  if ($keysToSend.Count -gt 1) {
    $modifiers = $keysToSend[0..($keysToSend.Count - 2)]
  }
  $mainKey = $keysToSend[$keysToSend.Count - 1]

  foreach ($modifier in $modifiers) {
    [KeyboardSender]::SendKey($modifier, $false)
    Start-Sleep -Milliseconds 18
  }

  [KeyboardSender]::SendKey($mainKey, $false)
  Start-Sleep -Milliseconds ([Math]::Max(20, $HoldMs))
  [KeyboardSender]::SendKey($mainKey, $true)

  [array]::Reverse($modifiers)
  foreach ($modifier in $modifiers) {
    Start-Sleep -Milliseconds 18
    [KeyboardSender]::SendKey($modifier, $true)
  }
}

$Keys.Split(",") | ForEach-Object {
  Send-Chord $_
  Start-Sleep -Milliseconds 35
}
