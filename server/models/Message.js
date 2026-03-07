const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  messageText: { type: String, trim: true, maxlength: 4000 },
  messageType: { type: String, enum: ['text','image','voice','file','video','system'], default: 'text' },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  fileSize: { type: Number, default: null },
  fileMimeType: { type: String, default: null },
  duration: { type: Number, default: null }, // voice/video duration
  thumbnail: { type: String, default: null }, // video thumbnail
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // if forwarded
  isForwarded: { type: Boolean, default: false },
  reactions: [reactionSchema],
  starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // delete for me
  status: { type: String, enum: ['sent','delivered','seen'], default: 'sent' },
  seenAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false }, // delete for everyone
  isEdited: { type: Boolean, default: false },
  isScheduled: { type: Boolean, default: false },
  scheduledAt: { type: Date, default: null }, // when to send
  disappearsAt: { type: Date, default: null }, // auto delete at this time
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ scheduledAt: 1, isScheduled: 1 });
messageSchema.index({ disappearsAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
