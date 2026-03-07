const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const User = require('../models/User');

const populateMsg = async (msg) => {
  await msg.populate('senderId', '_id username displayName profilePicture');
  await msg.populate({
    path: 'replyTo',
    select: '_id messageText messageType senderId fileUrl',
    populate: { path: 'senderId', select: '_id username displayName profilePicture' }
  });
  if (msg.forwardedFrom) await msg.populate('forwardedFrom', '_id username displayName');
  return msg;
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, groupId, messageText, messageType = 'text', fileUrl, fileName, fileSize, fileMimeType, duration, thumbnail, replyTo, isForwarded, forwardedFrom, isScheduled, scheduledAt, disappearsAt } = req.body;
    const senderId = req.user._id;

    if (!conversationId && !groupId) return res.status(400).json({ message: 'conversationId or groupId required.' });
    if (!messageText && !fileUrl) return res.status(400).json({ message: 'Message cannot be empty.' });

    let receiverId = null;
    if (conversationId) {
      const conv = await Conversation.findById(conversationId);
      if (!conv) return res.status(404).json({ message: 'Conversation not found.' });
      if (!conv.participants.some(p => p.toString() === senderId.toString())) return res.status(403).json({ message: 'Access denied.' });
      receiverId = conv.participants.find(p => p.toString() !== senderId.toString());
    }

    // Check announcement mode for groups
    if (groupId) {
      const group = await Group.findById(groupId);
      if (group?.announcementMode) {
        const isAdmin = group.admins.some(a => a.toString() === senderId.toString()) || group.admin.toString() === senderId.toString();
        if (!isAdmin) return res.status(403).json({ message: 'Only admins can send messages in announcement mode.' });
      }
    }

    const msgData = {
      conversationId: conversationId || null,
      groupId: groupId || null,
      senderId, receiverId,
      messageText: messageText?.trim() || null,
      messageType, fileUrl, fileName, fileSize, fileMimeType, duration, thumbnail,
      replyTo: replyTo || null,
      isForwarded: !!isForwarded,
      forwardedFrom: forwardedFrom || null,
      status: 'sent',
    };

    if (isScheduled && scheduledAt) {
      msgData.isScheduled = true;
      msgData.scheduledAt = new Date(scheduledAt);
    }
    if (disappearsAt) {
      msgData.disappearsAt = new Date(disappearsAt);
    }

    const message = await Message.create(msgData);

    // Don't update lastMessage for scheduled messages
    if (!isScheduled) {
      if (conversationId) {
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id, updatedAt: new Date(),
          $inc: { [`unreadCount.${receiverId}`]: 1 }
        });
      }
      if (groupId) {
        await Group.findByIdAndUpdate(groupId, { lastMessage: message._id, updatedAt: new Date() });
      }
    }

    await populateMsg(message);
    res.status(201).json(message);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Failed to send message.' }); }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    const messages = await Message.find({
      conversationId,
      deletedFor: { $ne: userId }, // exclude messages deleted for this user
      isScheduled: { $ne: true },  // exclude scheduled messages
    })
      .populate('senderId', '_id username displayName profilePicture')
      .populate({ path: 'replyTo', select: '_id messageText messageType senderId fileUrl', populate: { path: 'senderId', select: '_id username displayName profilePicture' } })
      .populate('forwardedFrom', '_id username displayName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json(messages.reverse());
  } catch (e) { console.error(e); res.status(500).json({ message: 'Failed to get messages.' }); }
};

exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    const messages = await Message.find({
      groupId,
      deletedFor: { $ne: userId },
      isScheduled: { $ne: true },
    })
      .populate('senderId', '_id username displayName profilePicture')
      .populate({ path: 'replyTo', select: '_id messageText messageType senderId fileUrl', populate: { path: 'senderId', select: '_id username displayName profilePicture' } })
      .populate('forwardedFrom', '_id username displayName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json(messages.reverse());
  } catch (e) { console.error(e); res.status(500).json({ message: 'Failed to get group messages.' }); }
};

exports.markSeen = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    await Message.updateMany(
      { conversationId, senderId: { $ne: userId }, status: { $ne: 'seen' } },
      { status: 'seen', seenAt: new Date() }
    );
    // Reset unread count for this user
    await Conversation.findByIdAndUpdate(conversationId, { [`unreadCount.${userId}`]: 0 });

    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to mark seen.' }); }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { forEveryone } = req.body;
    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ message: 'Message not found.' });

    if (forEveryone && (msg.senderId.toString() === req.user._id.toString())) {
      // Delete for everyone
      msg.isDeleted = true;
      msg.messageText = null;
      msg.fileUrl = null;
      await msg.save();
    } else {
      // Delete for me only
      if (!msg.deletedFor.includes(req.user._id)) {
        msg.deletedFor.push(req.user._id);
        await msg.save();
      }
    }
    res.json({ ok: true, forEveryone: !!forEveryone });
  } catch { res.status(500).json({ message: 'Failed to delete message.' }); }
};

exports.editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { messageText } = req.body;
    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ message: 'Message not found.' });
    if (msg.senderId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your message.' });
    msg.messageText = messageText;
    msg.isEdited = true;
    await msg.save();
    await populateMsg(msg);
    res.json(msg);
  } catch { res.status(500).json({ message: 'Failed to edit message.' }); }
};

exports.reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;
    const user = req.user;

    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ message: 'Message not found.' });

    const existing = msg.reactions.find(r => r.userId.toString() === userId.toString());
    if (existing) {
      if (existing.emoji === emoji) {
        // Remove reaction
        msg.reactions = msg.reactions.filter(r => r.userId.toString() !== userId.toString());
      } else {
        existing.emoji = emoji;
        existing.username = user.username;
      }
    } else {
      msg.reactions.push({ emoji, userId, username: user.username });
    }
    await msg.save();
    await populateMsg(msg);
    res.json(msg);
  } catch { res.status(500).json({ message: 'Failed to react.' }); }
};

exports.starMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ message: 'Message not found.' });
    const isStarred = msg.starredBy.some(u => u.toString() === userId.toString());
    if (isStarred) {
      msg.starredBy = msg.starredBy.filter(u => u.toString() !== userId.toString());
    } else {
      msg.starredBy.push(userId);
    }
    await msg.save();
    res.json({ starred: !isStarred });
  } catch { res.status(500).json({ message: 'Failed to star.' }); }
};

exports.getStarredMessages = async (req, res) => {
  try {
    const msgs = await Message.find({ starredBy: req.user._id, isDeleted: false })
      .populate('senderId', '_id username displayName profilePicture')
      .sort({ createdAt: -1 }).limit(100);
    res.json(msgs);
  } catch { res.status(500).json({ message: 'Failed to get starred.' }); }
};

exports.searchMessages = async (req, res) => {
  try {
    const { q, conversationId, groupId } = req.query;
    if (!q?.trim()) return res.json([]);
    const filter = {
      messageText: { $regex: q.trim(), $options: 'i' },
      isDeleted: false,
      deletedFor: { $ne: req.user._id },
    };
    if (conversationId) filter.conversationId = conversationId;
    if (groupId) filter.groupId = groupId;

    const msgs = await Message.find(filter)
      .populate('senderId', '_id username displayName profilePicture')
      .sort({ createdAt: -1 }).limit(30);
    res.json(msgs);
  } catch { res.status(500).json({ message: 'Failed to search.' }); }
};

exports.clearChatHistory = async (req, res) => {
  try {
    const { conversationId, groupId } = req.body;
    const userId = req.user._id;
    const filter = conversationId ? { conversationId } : { groupId };

    // Add current user to deletedFor for all messages
    await Message.updateMany(
      { ...filter, deletedFor: { $ne: userId } },
      { $push: { deletedFor: userId } }
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to clear chat.' }); }
};

// Scheduled message processor - called by a cron job or on message fetch
exports.processScheduled = async () => {
  try {
    const now = new Date();
    const scheduled = await Message.find({ isScheduled: true, scheduledAt: { $lte: now } });
    for (const msg of scheduled) {
      msg.isScheduled = false;
      msg.scheduledAt = null;
      await msg.save();
      // Update lastMessage
      if (msg.conversationId) {
        await Conversation.findByIdAndUpdate(msg.conversationId, { lastMessage: msg._id, updatedAt: now });
      }
      if (msg.groupId) {
        await Group.findByIdAndUpdate(msg.groupId, { lastMessage: msg._id, updatedAt: now });
      }
    }
    return scheduled;
  } catch (e) { console.error('processScheduled error:', e); }
};
