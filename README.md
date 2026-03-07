# NumberFree V6 — Round 1 Update

## What's New in Round 1

### 🐛 Bug Fixes
- ✅ Delete chat (for me only) — right-click any chat in list
- ✅ Performance improvements (loading skeletons, lazy loading)
- ✅ Fixed contacts crash

### 🔐 Auth
- ✅ Login with **email OR username** — both work now
- ✅ Username permanent (can't change)
- ✅ JWT expiry extended to 30 days (auto-logout every 30 days, not 7)

### 💬 Messaging
- ✅ Forward message (right-click → Forward, or select messages)
- ✅ Copy message text (right-click → Copy)
- ✅ Message info (exact seen time, delivery time, reactions)
- ✅ Jump to latest ↓ button with unread count badge
- ✅ Select multiple messages (long-press or right-click → Select) then delete/forward
- ✅ Delete for me / delete for everyone (separate options)
- ✅ Video send (max 50MB, play direct, fullscreen player)
- ✅ File send (all types, max 50MB, shows file name & size)
- ✅ Fullscreen image and video viewer (click to open, Esc to close)
- ✅ Draft messages (auto-saved when switching chats — shows in red in chat list)
- ✅ Upload progress bar for files/videos
- ✅ Search messages inside any chat (🔍 button in header)

### 📌 Chat List
- ✅ Pin chats (max 3) — right-click → Pin
- ✅ Mute per chat (8h / 1 week / always) — right-click → Mute
- ✅ Delete chat for me — right-click → Delete chat
- ✅ Pinned chats shown at top with 📌
- ✅ Muted chats shown with 🔇

### 👥 Groups
- ✅ Delete group (creator only) — group settings → Delete Group
- ✅ Leave group — group settings → Leave Group
- ✅ Group settings panel (⋮ button in header)
- ✅ Clear chat history (for me only)
- ✅ Admins array (multiple admins supported)
- ✅ Forward messages supported in groups

### ⚙️ Settings
- ✅ **Settings button** in header (⚙️ icon)
- ✅ Change profile (name, bio, custom status)
- ✅ Change password (current + new + confirm)
- ✅ Delete account (password confirmation, shows "Deleted Account")
- ✅ Custom status text ("Busy", "At work", etc.)

### 🎨 UI
- ✅ Loading skeletons (WhatsApp style) while chats load
- ✅ Attach menu with Image / Video / File options
- ✅ Forwarded message label (↗️ Forwarded)
- ✅ Video / File message bubbles with proper UI
- ✅ Right-click context menu on chat list (pin, mute, delete)

---

## How to Deploy

### Files Changed (replace these in your GitHub repo):

**Server:**
```
server/models/User.js          ← NEW FIELDS (pinnedChats, mutedChats, etc.)
server/models/Message.js       ← NEW FIELDS (video, file, forwarded, etc.)
server/models/Conversation.js  ← minor update
server/models/Group.js         ← admins[], announcementMode, invite link
server/controllers/authController.js  ← login with username, changePassword, deleteAccount
server/controllers/messageController.js ← video, file, deleteForMe, forward, search
server/controllers/userController.js   ← pinChat, muteChat, deleteChat
server/controllers/groupController.js  ← delete, leave, makeAdmin, inviteLink
server/routes/authRoutes.js    ← new routes
server/routes/userRoutes.js    ← new routes
server/routes/messageRoutes.js ← new routes
server/routes/groupRoutes.js   ← new routes
```

**Client:**
```
client/src/pages/Home.jsx      ← ENTIRE app UI (all new features)
client/src/pages/Login.jsx     ← username OR email login
client/src/services/api.js     ← all new API endpoints
```

---

## Step by Step

1. **Download this ZIP** and extract it

2. **Replace files** in your `D:\numberfree` folder:
   - Copy `server/` files to your `server/` folder
   - Copy `client/src/pages/Home.jsx` to your client
   - Copy `client/src/pages/Login.jsx` to your client
   - Copy `client/src/services/api.js` to your client

3. **Push to GitHub:**
   ```
   cd D:\numberfree
   git add .
   git commit -m "v6 round 1 - video file forward pin mute delete settings"
   git push
   ```

4. **Render** auto-deploys from GitHub (wait 2-3 minutes)

5. **Vercel** auto-deploys from GitHub (wait 1-2 minutes)

6. **Test:**
   - Login with username (not just email)
   - Send a video file
   - Send a document/file
   - Right-click a message to see new options
   - Right-click a chat to pin/mute/delete
   - Open Settings ⚙️ → change password

---

## Known: Cloudinary must support video uploads
In your Cloudinary settings, make sure your upload preset allows:
- Resource type: Auto (not just Image)
- File size: Allow up to 50MB

If videos fail to upload, go to Cloudinary → Settings → Upload → Edit your preset → 
set "Resource type" to **Auto** and "Max file size" to **52428800** (50MB)

---

## Round 2 will include (after Round 1 is stable):
- PIN locked chats
- Online/offline toggle
- Read receipts toggle
- Active sessions list
- Profile views counter
- Status privacy settings
- Auto logout after 1 month
