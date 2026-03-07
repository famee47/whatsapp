const Group = require('../models/Group');
const Message = require('../models/Message');
const User = require('../models/User');

exports.createGroup = async (req, res) => {
  try {
    const { name, members, description, groupPicture } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Group name required.' });
    const allMembers = [...new Set([req.user._id.toString(), ...(members || [])])];
    const group = await Group.create({
      name: name.trim(), description: description || '', groupPicture: groupPicture || '',
      admin: req.user._id, admins: [req.user._id], members: allMembers
    });
    await group.populate('members', '_id username displayName profilePicture isOnline');
    await group.populate('admin', '_id username displayName profilePicture');
    await group.populate('admins', '_id username displayName profilePicture');
    res.status(201).json(group);
  } catch (e) { console.error(e); res.status(500).json({ message: 'Failed to create group.' }); }
};

exports.getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('members', '_id username displayName profilePicture isOnline lastSeen')
      .populate('admin', '_id username displayName profilePicture')
      .populate('admins', '_id username displayName profilePicture')
      .populate({ path: 'lastMessage', populate: { path: 'senderId', select: '_id username' } })
      .sort({ updatedAt: -1 });
    res.json(groups);
  } catch { res.status(500).json({ message: 'Failed to get groups.' }); }
};

exports.addMember = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const isAdmin = group.admins.some(a => a.toString() === req.user._id.toString()) || group.admin.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admins can add members.' });
    const { userId } = req.body;
    if (!group.members.some(m => m.toString() === userId)) group.members.push(userId);
    await group.save();
    await group.populate('members', '_id username displayName profilePicture isOnline');
    res.json(group);
  } catch { res.status(500).json({ message: 'Failed to add member.' }); }
};

exports.removeMember = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const isAdmin = group.admins.some(a => a.toString() === req.user._id.toString()) || group.admin.toString() === req.user._id.toString();
    const isSelf = req.params.userId === req.user._id.toString();
    if (!isAdmin && !isSelf) return res.status(403).json({ message: 'Only admins can remove members.' });
    group.members = group.members.filter(m => m.toString() !== req.params.userId);
    group.admins = group.admins.filter(a => a.toString() !== req.params.userId);
    await group.save();
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to remove member.' }); }
};

exports.updateGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const isAdmin = group.admins.some(a => a.toString() === req.user._id.toString()) || group.admin.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admins can update group.' });
    const { name, description, groupPicture, announcementMode } = req.body;
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (groupPicture !== undefined) group.groupPicture = groupPicture;
    if (announcementMode !== undefined) group.announcementMode = announcementMode;
    await group.save();
    await group.populate('members', '_id username displayName profilePicture isOnline');
    await group.populate('admin', '_id username displayName profilePicture');
    await group.populate('admins', '_id username displayName profilePicture');
    res.json(group);
  } catch { res.status(500).json({ message: 'Failed to update group.' }); }
};

exports.deleteGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    if (group.admin.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only the group creator can delete the group.' });
    await Message.deleteMany({ groupId: group._id });
    await Group.findByIdAndDelete(group._id);
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to delete group.' }); }
};

exports.leaveGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    group.members = group.members.filter(m => m.toString() !== req.user._id.toString());
    group.admins = group.admins.filter(a => a.toString() !== req.user._id.toString());
    // If creator leaves and no admins left, make first member admin
    if (group.admin.toString() === req.user._id.toString() && group.members.length > 0) {
      group.admin = group.members[0];
      group.admins = [group.members[0]];
    }
    await group.save();
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to leave group.' }); }
};

exports.makeAdmin = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const isAdmin = group.admins.some(a => a.toString() === req.user._id.toString()) || group.admin.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admins can promote members.' });
    const { userId } = req.body;
    if (!group.admins.some(a => a.toString() === userId)) group.admins.push(userId);
    await group.save();
    await group.populate('members', '_id username displayName profilePicture isOnline');
    await group.populate('admins', '_id username displayName profilePicture');
    res.json(group);
  } catch { res.status(500).json({ message: 'Failed to make admin.' }); }
};

exports.removeAdmin = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    if (group.admin.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only the creator can remove admins.' });
    group.admins = group.admins.filter(a => a.toString() !== req.params.userId);
    await group.save();
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed to remove admin.' }); }
};

exports.generateInviteLink = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const isAdmin = group.admins.some(a => a.toString() === req.user._id.toString()) || group.admin.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admins can generate invite links.' });
    group.generateInviteLink();
    await group.save();
    res.json({ inviteLink: group.inviteLink });
  } catch { res.status(500).json({ message: 'Failed to generate invite link.' }); }
};

exports.joinViaLink = async (req, res) => {
  try {
    const { link } = req.params;
    const group = await Group.findOne({ inviteLink: link, inviteLinkEnabled: true });
    if (!group) return res.status(404).json({ message: 'Invalid or expired invite link.' });
    if (group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'You are already a member.' });
    }
    // Add to join requests - admin must approve
    if (!group.joinRequests.some(r => r.toString() === req.user._id.toString())) {
      group.joinRequests.push(req.user._id);
    }
    await group.save();
    res.json({ message: 'Join request sent. Waiting for admin approval.' });
  } catch { res.status(500).json({ message: 'Failed to join group.' }); }
};

exports.approveJoinRequest = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const isAdmin = group.admins.some(a => a.toString() === req.user._id.toString()) || group.admin.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admins can approve requests.' });
    const { userId, approve } = req.body;
    group.joinRequests = group.joinRequests.filter(r => r.toString() !== userId);
    if (approve && !group.members.some(m => m.toString() === userId)) {
      group.members.push(userId);
    }
    await group.save();
    await group.populate('members', '_id username displayName profilePicture isOnline');
    res.json(group);
  } catch { res.status(500).json({ message: 'Failed to process request.' }); }
};
