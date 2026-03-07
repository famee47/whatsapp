const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['text','image'], default: 'text' },
  content: { type: String, required: true },
  backgroundColor: { type: String, default: '#005c4b' },
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24*60*60*1000) },
}, { timestamps: true });

statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
statusSchema.index({ userId: 1 });

module.exports = mongoose.model('Status', statusSchema);
