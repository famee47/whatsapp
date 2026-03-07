const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  unreadCount: { type: Map, of: Number, default: {} },
}, { timestamps: true });

conversationSchema.index({ participants: 1 });

conversationSchema.statics.findBetweenUsers = function(u1, u2) {
  return this.findOne({ participants: { $all: [u1, u2], $size: 2 } });
};

module.exports = mongoose.model('Conversation', conversationSchema);
