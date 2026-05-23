# ALPHA Bot

  A Facebook Messenger userbot powered by [fca-unofficial](https://www.npmjs.com/package/fca-unofficial) (dongdev) with a dark mission-control web panel.

  ## Features
  - c3c JSON cookie format (appState array)
  - MQTT + HTTP Long-Poll listener with automatic fallback
  - Cookie watchdog — hot-reconnect without stopping the server
  - Admin-only message filtering
  - Hot-reloadable command system
  - Web control panel: admin management, cookie update, live logs

  ## Commands
  `/uptime` `/ping` `/help` `/info` `/addadmin` `/removeadmin`

  ## Stack
  - Node.js + Express + TypeScript
  - React + Vite + Tailwind (dark theme)
  - fca-unofficial (dongdev)
  - pnpm workspaces
  