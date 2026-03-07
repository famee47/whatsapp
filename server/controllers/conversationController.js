const Conversation = require('../models/Conversation');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.createOrGet = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user._id;
    if (!receiverId) return res.status(400).json({ message: 'receiverId required.' });
    if (receiverId === senderId.toString()) return res.status(400).json({ message: 'Cannot chat with yourself.' });
    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ message: 'User not found.' });

    let conv = await Conversation.findOne({ participants: { $all: [senderId, receiverId], $size: 2 } });
    if (!conv) conv = await Conversation.create({ participants: [senderId, receiverId] });

    // If user had previously deleted this chat, un-delete it so it shows again
    await User.updateOne(
      { _id: senderId },
      { $pull: { deletedChats: conv._id.toString() } }
    );

    await conv.populate('participants', '_id username displayName profilePicture bio isOnline lastSeen');
    await conv.populate({ path: 'lastMessage', populate: { path: 'senderId', select: '_id username' } });
    res.status(200).json(conv);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Failed to create conversation.' }); }
};

exports.getAll = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('deletedChats');
    // Cast stored string IDs to ObjectId for proper $nin comparison
    const deletedIds = (me?.deletedChats || []).map(id => {
      try { return new mongoose.Types.ObjectId(id); } catch { return null; }
    }).filter(Boolean);

    const convs = await Conversation.find({
      participants: req.user._id,
      _id: { $nin: deletedIds }
    })
      .populate('participants', '_id username displayName profilePicture bio isOnline lastSeen')
      .populate({ path: 'lastMessage', populate: { path: 'senderId', select: '_id username' } })
      .sort({ updatedAt: -1 });
    res.json(convs);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Failed to get conversations.' }); }
};
