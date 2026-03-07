const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.searchUser = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username?.trim()) return res.json([]);
    const users = await User.find({
      $or: [
        { username: { $regex: username.trim(), $options: 'i' } },
        { displayName: { $regex: username.trim(), $options: 'i' } },
      ],
      _id: { $ne: req.user._id },
      isDeleted: { $ne: true },
    }).select('_id username displayName profilePicture bio customStatus isOnline lastSeen privacy').limit(20);
    res.json(users);
  } catch { res.status(500).json({ message: 'Search failed.' }); }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('_id username displayName profilePicture bio customStatus isOnline lastSeen createdAt blockedUsers privacy isDeleted');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    // Respect privacy: hide online/lastSeen if user has hideOnlineStatus
    const result = user.toObject();
    if (user.privacy?.hideOnlineStatus) {
      result.isOnline = false;
      result.lastSeen = null;
    }
    res.json(result);
  } catch { res.status(500).json({ message: 'Failed to get user.' }); }
};

exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const me = await User.findById(req.user._id);
    const isBlocked = me.blockedUsers.map(id => id.toString()).includes(userId);
    if (isBlocked) {
      me.blockedUsers = me.blockedUsers.filter(id => id.toString() !== userId);
    } else {
      me.blockedUsers.push(userId);
    }
    await me.save();
    res.json({ blocked: !isBlocked, message: isBlocked ? 'User unblocked.' : 'User blocked.' });
  } catch { res.status(500).json({ message: 'Failed to block/unblock user.' }); }
};

exports.saveContact = async (req, res) => {
  try {
    const { userId, nickname } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId required.' });
    const targetUser = await User.findById(userId).select('_id username displayName profilePicture bio customStatus isOnline lastSeen');
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });
    const me = await User.findById(req.user._id);
    const existingIdx = me.contacts.findIndex(c => c.user.toString() === userId);
    if (existingIdx > -1) {
      me.contacts[existingIdx].nickname = nickname || '';
    } else {
      me.contacts.push({ user: userId, nickname: nickname || '' });
    }
    await me.save();
    res.json({ message: 'Contact saved.', contact: { user: targetUser, nickname: nickname || '' } });
  } catch { res.status(500).json({ message: 'Failed to save contact.' }); }
};

exports.getContacts = async (req, res) => {
  try {
    const me = await User.findById(req.user._id)
      .populate('contacts.user', '_id username displayName profilePicture bio customStatus isOnline lastSeen privacy isDeleted');
    // Filter out deleted users gracefully
    const contacts = (me.contacts || []).filter(c => c.user != null);
    res.json(contacts);
  } catch { res.status(500).json({ message: 'Failed to get contacts.' }); }
};

exports.checkBlocked = async (req, res) => {
  try {
    const { userId } = req.params;
    const me = await User.findById(req.user._id).select('blockedUsers');
    const iBlockedThem = me.blockedUsers.map(id => id.toString()).includes(userId);
    const them = await User.findById(userId).select('blockedUsers');
    const theyBlockedMe = them ? them.blockedUsers.map(id => id.toString()).includes(req.user._id.toString()) : false;
    res.json({ iBlockedThem, theyBlockedMe, blocked: iBlockedThem || theyBlockedMe });
  } catch { res.status(500).json({ message: 'Failed.' }); }
};

// ── PIN CHAT ──────────────────────────────────────────────────────────────────
exports.pinChat = async (req, res) => {
  try {
    const { chatId } = req.body;
    const me = await User.findById(req.user._id);
    if (!me.pinnedChats.includes(chatId)) {
      if (me.pinnedChats.length >= 3) return res.status(400).json({ message: 'Maximum 3 chats can be pinned.' });
      me.pinnedChats.push(chatId);
    } else {
      me.pinnedChats = me.pinnedChats.filter(id => id !== chatId);
    }
    await me.save();
    res.json({ pinnedChats: me.pinnedChats });
  } catch { res.status(500).json({ message: 'Failed to pin chat.' }); }
};

// ── MUTE CHAT ─────────────────────────────────────────────────────────────────
exports.muteChat = async (req, res) => {
  try {
    const { chatId, duration } = req.body; // duration: '8h' | '1w' | 'always' | 'unmute'
    const me = await User.findById(req.user._id);
    if (duration === 'unmute') {
      me.mutedChats.delete(chatId);
    } else {
      let unmuteAt = null;
      if (duration === '8h') unmuteAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
      else if (duration === '1w') unmuteAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      else if (duration === 'always') unmuteAt = null; // null means always muted
      me.mutedChats.set(chatId, { unmuteAt, duration });
    }
    await me.save();
    res.json({ mutedChats: Object.fromEntries(me.mutedChats) });
  } catch { res.status(500).json({ message: 'Failed to mute chat.' }); }
};

// ── DELETE CHAT (for me only) ─────────────────────────────────────────────────
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.body;
    const me = await User.findById(req.user._id);
    if (!me.deletedChats.includes(chatId)) me.deletedChats.push(chatId);
    // Also unpin
    me.pinnedChats = me.pinnedChats.filter(id => id !== chatId);
    await me.save();
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to delete chat.' }); }
};

// ── LOCK CHAT WITH PIN ────────────────────────────────────────────────────────
exports.lockChat = async (req, res) => {
  try {
    const { chatId, pin } = req.body;
    const me = await User.findById(req.user._id).select('+chatPin');

    if (!me.chatPin && pin) {
      // Set PIN for first time
      me.chatPin = await bcrypt.hash(pin, 10);
    } else if (pin && me.chatPin) {
      // Verify PIN
      const valid = await bcrypt.compare(pin, me.chatPin);
      if (!valid) return res.status(401).json({ message: 'Wrong PIN.' });
    }

    if (me.lockedChats.includes(chatId)) {
      me.lockedChats = me.lockedChats.filter(id => id !== chatId);
    } else {
      me.lockedChats.push(chatId);
    }
    await me.save();
    res.json({ lockedChats: me.lockedChats });
  } catch { res.status(500).json({ message: 'Failed to lock chat.' }); }
};

exports.verifyPin = async (req, res) => {
  try {
    const { pin } = req.body;
    const me = await User.findById(req.user._id).select('+chatPin');
    if (!me.chatPin) return res.status(400).json({ message: 'No PIN set.' });
    const valid = await bcrypt.compare(pin, me.chatPin);
    res.json({ valid });
  } catch { res.status(500).json({ message: 'Failed to verify PIN.' }); }
};

exports.updatePrivacy = async (req, res) => {
  try {
    const { hideOnlineStatus, hideReadReceipts, statusVisibility } = req.body;
    const updates = { privacy: {} };
    if (hideOnlineStatus !== undefined) updates.privacy.hideOnlineStatus = hideOnlineStatus;
    if (hideReadReceipts !== undefined) updates.privacy.hideReadReceipts = hideReadReceipts;
    if (statusVisibility !== undefined) updates.privacy.statusVisibility = statusVisibility;
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ privacy: user.privacy });
  } catch { res.status(500).json({ message: 'Failed to update privacy.' }); }
};
