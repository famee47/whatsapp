const mongoose = require('mongoose');
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  otp: { type: String, required: true },
  type: { type: String, enum: ['email_verify', 'new_device'], required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 10 * 60 * 1000) }
}, { timestamps: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('OTP', otpSchema);
