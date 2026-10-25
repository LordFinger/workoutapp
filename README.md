# Gym Tracker

Offline-first workout, nutrition and body-measurement log for iPhone. No account, no server:
all data is stored on the device (localStorage) and can be exported to a JSON backup.

## Put it online once (HTTPS is required for offline mode)
Upload this folder to any static host, for example Netlify Drop (drag the folder or the zip to
https://app.netlify.com/drop) or GitHub Pages.

## Install on iPhone
1. Open the site in Safari (once, with internet).
2. Share button -> Add to Home Screen.
3. Open it from the home screen icon. It now works without internet.

## Files
- `index.html`, `styles.css`, `app.js`: the app
- `program.js`: the training program (edit exercises, sets, reps here)
- `sw.js`: offline cache. Bump `CACHE_VERSION` after changing any file so phones update
- `manifest.webmanifest`, `icons/`, `fonts/`: home-screen install assets

## Units
Exercise weights are in lb, body weight in kg, measurements in cm.

## Backups
Program tab -> Export backup. Import restores it. Do this every couple of weeks and before
deleting the app: removing the icon removes the data.
