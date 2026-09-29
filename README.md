# Hoai VideoAi Automation

Version 1.0.0 - FULL source project

Desktop automation application built with Electron + Playwright CDP for Google Flow.

## Build on GitHub Actions
1. Upload the complete project to GitHub.
2. Push to `main`/`master` or run **Actions → Build Hoai VideoAi Automation → Run workflow**.
3. Download the artifact `Hoai-VideoAi-Automation-Windows`.

The workflow uses Node 24, checkout/setup-node v5, `npm install` (no lockfile cache requirement), and `electron-builder --publish never`, so it does not require `GH_TOKEN`.

## Notes
Google login, 2FA and CAPTCHA are performed manually by the user. The app does not store Google passwords or bypass account security.
