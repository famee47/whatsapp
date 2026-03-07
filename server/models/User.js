const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 20 },
  displayName: { type: String, default: '', maxlength: 50 },
  profilePicture: { type: String, default: '' },
  bio: { type: String, default: 'Hey there! I am using NumberFree', maxlength: 150 },
  customStatus: { type: String, default: '', maxlength: 80 },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  // Privacy settings (Round 2: added hideLastSeen)
  privacy: {
    hideOnlineStatus: { type: Boolean, default: false },
    hideReadReceipts: { type: Boolean, default: false },
    hideLastSeen: { type: Boolean, default: false },
    statusVisibility: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'contacts' },
  },
  pinnedChats: [{ type: String }],
  mutedChats: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  deletedChats: [{ type: String }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  contacts: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nickname: { type: String, default: '' }
  }],
  lockedChats: [{ type: String }],
  chatPin: { type: String, default: null, select: false },
  pushSubscription: { type: mongoose.Schema.Types.Mixed, default: null },
  theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
  sessions: [{
    token: String,
    device: String,
    ip: String,
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
