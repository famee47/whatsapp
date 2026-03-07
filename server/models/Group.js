const mongoose = require('mongoose');
const crypto = require('crypto');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 300 },
  groupPicture: { type: String, default: '' },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // original creator
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // all admins including creator
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  unreadCount: { type: Map, of: Number, default: {} },
  // Announcement mode - only admins can send
  announcementMode: { type: Boolean, default: false },
  // Invite link
  inviteLink: { type: String, default: null, unique: true, sparse: true },
  inviteLinkEnabled: { type: Boolean, default: false },
  // Pending join requests from invite link
  joinRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

groupSchema.index({ members: 1 });

groupSchema.methods.generateInviteLink = function() {
  this.inviteLink = crypto.randomBytes(16).toString('hex');
  this.inviteLinkEnabled = true;
  return this.inviteLink;
};

module.exports = mongoose.model('Group', groupSchema);
