# Star Citizen Local Bridge

Run the panel and the keyboard bridge together:

```powershell
npm.cmd run dev:game
```

The web panel calls `http://127.0.0.1:8787/command`, and the bridge sends the configured keyboard shortcut to the Star Citizen window.

Edit `bridge/keybinds.json` if your in-game keybinds are different.

Important notes:

- Star Citizen must be running.
- If Star Citizen runs as administrator, run this project as administrator too.
- Borderless/windowed mode is usually more reliable than exclusive fullscreen.
- The bridge focuses the Star Citizen window before sending keys.
- Browser-only pages cannot send global game keys without this local bridge.
