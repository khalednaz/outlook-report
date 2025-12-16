# Brixeon Outlook Add-in (Report Phishing)

This add-in replicates your Gmail add-on behavior for Outlook using Office.js:

- Reads the opened message body (HTML + Text)
- Resolves a report URL using the same priority:
  1) `BRIXEON_REPORT_URL:` or `BRIXEON_REPORT_URL=`
  2) any URL containing `/report?rid=`
  3) extract `rid=` + base domain from any rid-link, then build `<base>/report?rid=<rid>`
- Calls `GET <base>/report?rid=...`
- Shows a success/fail notification

## Files
- `manifest.xml` (upload/sideload this into Outlook)
- `commands.html` (loads Office.js + commands.js)
- `commands.js` (core logic)
- `taskpane.html` (simple read view pane; required by manifest)
- `assets/` icons (placeholders)

## Setup
1. Host this folder on HTTPS (ngrok is fine). Example URL:
   `https://abcd1234.ngrok.app`
2. Edit `manifest.xml` and replace:
   `https://YOUR_ADDIN_HOST`
   with your real HTTPS host.
3. Sideload `manifest.xml` in Outlook:
   - Outlook Web: Settings -> Mail -> Customize actions -> Add-ins -> Add a custom add-in -> From file
   - Outlook Desktop: File -> Manage Add-ins (opens web UI) then same steps

## Email template marker
Add this to the email template (recommended):
`BRIXEON_REPORT_URL:{{.URL}}/report?rid={{.RId}}`

GUID (Add-in Id) used in this package:
96726257-12df-4ef1-b166-e35f5188b87a
