const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');

const ALLOWED = ['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','protonmail.com','live.com','msn.com','me.com','mac.com','ymail.com'];
const genToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
const safeUser = (u) => ({
  _id: u._id, email: u.email, username: u.username, displayName: u.displayName,
  profilePicture: u.profilePicture, bio: u.bio, customStatus: u.customStatus,
  isOnline: u.isOnline, lastSeen: u.lastSeen, createdAt: u.createdAt,
  privacy: u.privacy, pinnedChats: u.pinnedChats, mutedChats: u.mutedChats,
  deletedChats: u.deletedChats, lockedChats: u.lockedChats, theme: u.theme,
  isDeleted: u.isDeleted,
});

exports.register = async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password || !username) return res.status(400).json({ message: 'All fields are required.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    const domain = email.split('@')[1]?.toLowerCase();
    if (!ALLOWED.includes(domain)) return res.status(400).json({ message: 'Please use a real email (Gmail, Yahoo, Outlook, etc.).' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ message: 'Username: letters, numbers, underscores only.' });
    if (username.length < 3) return res.status(400).json({ message: 'Username must be at least 3 characters.' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'An account with this email already exists.' });
    if (await User.findOne({ username: username.toLowerCase() })) return res.status(409).json({ message: 'This username is already taken.' });
    const user = await User.create({ email: email.toLowerCase(), password, username: username.toLowerCase(), displayName: username });
    res.status(201).json({ token: genToken(user._id), user: safeUser(user) });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Registration failed. Please try again.' }); }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body; // email can be email OR username
    if (!email || !password) return res.status(400).json({ message: 'Email/username and password are required.' });

    // Try to find by email first, then by username
    const isEmail = email.includes('@');
    let user;
    if (isEmail) {
      user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    } else {
      user = await User.findOne({ username: email.toLowerCase() }).select('+password');
    }

    if (!user) return res.status(401).json({ message: isEmail ? 'No account found with this email.' : 'No account found with this username.' });
    if (user.isDeleted) return res.status(401).json({ message: 'This account has been deleted.' });
    if (!await user.comparePassword(password)) return res.status(401).json({ message: 'Wrong password. Please try again.' });

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({ token: genToken(user._id), user: safeUser(user) });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Login failed. Please try again.' }); }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(safeUser(user));
  } catch { res.status(500).json({ message: 'Failed to get profile.' }); }
};

exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isOnline: false, lastSeen: new Date() });
    res.json({ message: 'Logged out.' });
  } catch { res.status(500).json({ message: 'Logout failed.' }); }
};

exports.updateProfile = async (req, res) => {
  try {
    const { bio, displayName, profilePicture, customStatus, theme, privacy } = req.body;
    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (displayName !== undefined) updates.displayName = displayName;
    if (profilePicture !== undefined) updates.profilePicture = profilePicture;
    if (customStatus !== undefined) updates.customStatus = customStatus;
    if (theme !== undefined) updates.theme = theme;
    if (privacy !== undefined) updates.privacy = privacy;
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json(safeUser(user));
  } catch { res.status(500).json({ message: 'Failed to update profile.' }); }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords are required.' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    const user = await User.findById(req.user._id).select('+password');
    if (!await user.comparePassword(currentPassword)) return res.status(401).json({ message: 'Current password is wrong.' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch { res.status(500).json({ message: 'Failed to change password.' }); }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password is required to delete your account.' });
    const user = await User.findById(req.user._id).select('+password');
    if (!await user.comparePassword(password)) return res.status(401).json({ message: 'Wrong password.' });

    // Soft delete - keep messages but mark as deleted
    await User.findByIdAndUpdate(req.user._id, {
      isDeleted: true,
      isOnline: false,
      displayName: 'Deleted Account',
      profilePicture: '',
      bio: '',
      customStatus: '',
      email: `deleted_${user._id}@deleted.com`,
      lastSeen: new Date(),
    });

    // Remove from all groups
    await Group.updateMany({ members: req.user._id }, { $pull: { members: req.user._id } });

    res.json({ message: 'Account deleted.' });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Failed to delete account.' }); }
};
