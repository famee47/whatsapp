const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const onlineUsers = new Map(); // userId -> socketId
let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || origin === 'http://localhost:5173' || (origin && origin.endsWith('.vercel.app')) || origin === process.env.CLIENT_URL) return cb(null, true);
        cb(new Error('CORS'));
      },
      methods: ['GET','POST'], credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Auth required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch { next(new Error('Invalid token')); }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`🟢 ${socket.user.username} connected (${socket.id})`);

    // Register online
    onlineUsers.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true });

    // Broadcast online to everyone
    io.emit('userStatusChanged', { userId, isOnline: true });

    // Send current online list to new user
    socket.emit('onlineUsers', Array.from(onlineUsers.keys()));

    // Join personal room
    socket.join(userId);

    // Join group rooms
    socket.on('joinGroups', (groupIds) => {
      if (Array.isArray(groupIds)) groupIds.forEach(id => socket.join(`group:${id}`));
    });

    // ── SEND DIRECT MESSAGE ──────────────────────────────────────────────────
    // This is the key fix: immediately emit to receiver AND confirm to sender
    socket.on('sendMessage', (message) => {
      const receiverId = message.receiverId?.toString() || message.receiverId;
      
      // Always confirm back to sender immediately (fixes sender not seeing own msg)
      socket.emit('messageSent', message);

      if (receiverId && onlineUsers.has(receiverId)) {
        // Deliver to receiver
        io.to(receiverId).emit('newMessage', message);
        // Auto-notify sender that message was delivered (receiver is online)
        io.to(userId).emit('messageDelivered', { 
          messageId: message._id, 
          conversationId: message.conversationId 
        });
      }
      // If receiver offline - stays as 'sent' (1 tick)
    });

    // ── SEND GROUP MESSAGE ───────────────────────────────────────────────────
    socket.on('sendGroupMessage', (message) => {
      socket.to(`group:${message.groupId}`).emit('newGroupMessage', message);
    });

    // ── TYPING ───────────────────────────────────────────────────────────────
    socket.on('typing', ({ conversationId, receiverId, groupId, isTyping }) => {
      if (groupId) {
        socket.to(`group:${groupId}`).emit('userTyping', { 
          conversationId: groupId, senderId: userId, 
          username: socket.user.username, isTyping, isGroup: true 
        });
      } else if (receiverId && onlineUsers.has(receiverId.toString())) {
        io.to(receiverId.toString()).emit('userTyping', { 
          conversationId, senderId: userId, isTyping 
        });
      }
    });

    // ── MESSAGE SEEN ─────────────────────────────────────────────────────────
    socket.on('messageSeen', ({ conversationId, senderId }) => {
      if (senderId && onlineUsers.has(senderId.toString())) {
        io.to(senderId.toString()).emit('messagesSeenByReceiver', { 
          conversationId, seenBy: userId 
        });
      }
    });

    // ── DELETE MESSAGE ───────────────────────────────────────────────────────
    socket.on('messageDeleted', ({ messageId, conversationId, receiverId, groupId }) => {
      if (groupId) {
        socket.to(`group:${groupId}`).emit('messageDeleted', { messageId, groupId });
      } else if (receiverId && onlineUsers.has(receiverId.toString())) {
        io.to(receiverId.toString()).emit('messageDeleted', { messageId, conversationId });
      }
    });

    // ── EDIT MESSAGE ─────────────────────────────────────────────────────────
    socket.on('messageEdited', ({ message, receiverId, groupId }) => {
      if (groupId) {
        socket.to(`group:${groupId}`).emit('messageEdited', { message });
      } else if (receiverId && onlineUsers.has(receiverId.toString())) {
        io.to(receiverId.toString()).emit('messageEdited', { message });
      }
    });

    // ── REACTION ─────────────────────────────────────────────────────────────
    socket.on('messageReaction', ({ message, receiverId, groupId }) => {
      if (groupId) {
        socket.to(`group:${groupId}`).emit('messageReaction', { message });
      } else if (receiverId && onlineUsers.has(receiverId.toString())) {
        io.to(receiverId.toString()).emit('messageReaction', { message });
      }
    });

    // ── STATUS ───────────────────────────────────────────────────────────────
    socket.on('newStatus', (status) => {
      socket.broadcast.emit('newStatus', status);
    });

    // ── DISCONNECT ───────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔴 ${socket.user.username} disconnected`);
      onlineUsers.delete(userId);
      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
      io.emit('userStatusChanged', { userId, isOnline: false, lastSeen });
    });
  });

  console.log('⚡ Socket.io v5.1 initialized');
  return io;
};

const getIO = () => { if (!io) throw new Error('Socket not initialized'); return io; };
const isOnline = (userId) => onlineUsers.has(userId.toString());

module.exports = { initSocket, getIO, isOnline, onlineUsers };
