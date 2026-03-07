const Status = require('../models/Status');
const User = require('../models/User');

exports.createStatus = async (req, res) => {
  try {
    const { type, content, backgroundColor } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content required.' });
    const status = await Status.create({
      userId: req.user._id,
      type: type || 'text',
      content: content.trim(),
      backgroundColor: backgroundColor || '#005c4b'
    });
    await status.populate('userId', '_id username displayName profilePicture');
    res.status(201).json(status);
  } catch { res.status(500).json({ message: 'Failed to create status.' }); }
};

exports.getStatuses = async (req, res) => {
  try {
    const statuses = await Status.find({ expiresAt: { $gt: new Date() } })
      .populate('userId', '_id username displayName profilePicture')
      .populate('viewers', '_id username displayName profilePicture')
      .sort({ createdAt: -1 });
    res.json(statuses);
  } catch { res.status(500).json({ message: 'Failed to get statuses.' }); }
};

exports.viewStatus = async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ message: 'Status not found.' });
    const alreadyViewed = status.viewers.map(v => v.toString()).includes(req.user._id.toString());
    if (!alreadyViewed) {
      status.viewers.push(req.user._id);
      await status.save();
    }
    // Return populated status
    await status.populate('viewers', '_id username displayName profilePicture');
    res.json(status);
  } catch { res.status(500).json({ message: 'Failed.' }); }
};

exports.deleteStatus = async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ message: 'Status not found.' });
    if (status.userId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your status.' });
    await status.deleteOne();
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Failed.' }); }
};
