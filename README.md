# NumberFree V6 — Round 2 (Bug Fixes)

## 3 Bugs Fixed

### Bug 1 — Wrong password shows 404 and redirects to blank page
**Root cause:** The axios 401 interceptor was calling `window.location.href = '/login'` even
when you were already ON the login page. This caused a page reload which showed a 404
(Vercel can't find the route on reload without proper SPA redirect config).

**Fix:** `client/src/services/api.js` — interceptor now checks if you're already on
`/login` or `/register` before redirecting. If you are, it just lets the error pass
through normally so your toast ("Wrong password") shows up correctly.

---

### Bug 2 — Delete chat reappears after page refresh
**Root cause:** The server's `conversationController.getAll` was fetching ALL conversations
the user is part of — it never checked the user's `deletedChats` list.

**Fix:** `server/controllers/conversationController.js` — `getAll` now loads the user's
`deletedChats` array and excludes those IDs from the query using `$nin`.

---

### Bug 3 — Can't delete chat on mobile (only works on PC)
**Root cause:** The chat list items only had `onContextMenu` (right-click), which doesn't
fire on mobile touchscreens.

**Fix:** `client/src/pages/Home.jsx` — added `onTouchStart` / `onTouchEnd` / `onTouchMove`
long-press handlers (500ms hold) to every chat list item, same as the message long-press.
On mobile: **hold finger for 0.5 seconds** → menu appears with Pin / Mute / Delete.

---

## Files to Replace (only 3 files this time)

```
client/src/services/api.js
client/src/pages/Home.jsx
server/controllers/conversationController.js
```

## Deploy

1. Copy the 3 files into your `D:\numberfree` folder (let Windows replace them)
2. Then:
```
cd D:\numberfree
git add .
git commit -m "r2 bugfixes - 404 login, delete reappear, mobile delete"
git push
```
3. Wait ~2 min for Render + Vercel to deploy
4. Test:
   - Login with wrong password → should show red toast, NOT redirect to blank page ✅
   - Delete a chat → refresh the page → chat should stay deleted ✅
   - On mobile, hold a chat for 0.5s → menu should appear ✅
