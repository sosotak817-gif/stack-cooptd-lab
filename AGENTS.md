# Repository workflow

## User-visible patch history

For every change that affects user-facing behavior, UI, recommendations, calculations, or bug fixes:

- Add a Korean patch entry to `ui/patch-notes.json` in the same change. Use the current date in Asia/Seoul, a unique id, an accurate short title and concrete details.
- Keep the array newest first, including entries made on the same day. Keep old entries; never replace or delete history to fit the homepage.
- Describe completed behavior and relevant assumptions. Do not claim a deployment was verified unless it actually was. Never include private user data or secrets.
- Supported types are `feature`, `fix`, `calculation`, and `performance`.
- The build embeds the latest five entries on the homepage and every entry at `/updates/`. After updating logs run `npm run build` and `node verify-patch-notes.cjs`.
- The homepage patch dashboard replaces only the saved-deck summary UI. Do not delete or reset browser/user storage as part of maintaining this dashboard.
