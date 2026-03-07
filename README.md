# NumberFree V6 — Round 3 (Bug Fixes + Round 2 Features)

## Bug Fixes in this release

### Fix 1 — Delete chat still reappears on refresh
Root cause: The `$nin` query used ObjectId comparison but `deletedChats` stores strings.
Fix: `conversationController.js` now casts stored IDs to ObjectId before the query.

### Fix 2 — When deleted user messages you, old messages show but chat missing from list
Root cause: When a `newMessage` socket event arrived for a conversation not in the local state
(because user had deleted it), it was silently ignored.
Fix: `Home.jsx` socket handler now detects when the conversation is missing from local state
and re-fetches all conversations from the server to restore it.

### Fix 3 — Mobile can't delete chat (long press not working reliably)
Root cause: Previous fix used `onTouchMove` to cancel timer, but it fired too aggressively
and cancelled the timer even for tiny finger wobbles.
Fix: Now tracks start position and only cancels if finger moves MORE than 8px — so
accidental micro-movements don't cancel the long press.

---

## Round 2 Features

### 🔒 Lock Chat with PIN
- Right-click (PC) or long-press (mobile) any chat → **Lock Chat**
- Enter a 4-digit PIN → chat shows 🔒 in list
- Opens with PIN prompt → enter PIN → unlocks for the session
- PIN is hashed on the server (bcrypt)

### 👁️ Privacy Settings (Settings ⚙️ → Privacy tab)
- **Hide Online Status** — others won't see your green dot
- **Hide Last Seen** — others won't see "last seen today at 5:30"
- **Hide Read Receipts** — blue ticks won't appear when you read messages
- **Status Visibility** — Everyone / Contacts / Nobody

### 📱 Active Sessions (Settings ⚙️ → Sessions tab)
- See all devices where you're logged in
- Revoke individual sessions
- "Log Out All Devices" button

---

## Files to Replace (6 files)

```
client/src/pages/Home.jsx
client/src/services/api.js
server/models/User.js
server/controllers/conversationController.js
server/controllers/userController.js
server/routes/userRoutes.js
```

## Deploy

1. Copy all 6 files into `D:\numberfree` (let Windows replace them)
2. Push to GitHub:
```
cd D:\numberfree
git add .
git commit -m "r3 bugfixes + round 2 privacy pin sessions"
git push
```
3. Wait ~2 min for Render + Vercel

## Test
- Delete a chat → refresh → should stay deleted ✅
- Long-press a chat on mobile → menu should appear ✅  
- Lock a chat → 🔒 shows → tap it → PIN prompt ✅
- Settings → Privacy → toggle hide online → save ✅
- Settings → Sessions → see logged in devices ✅
