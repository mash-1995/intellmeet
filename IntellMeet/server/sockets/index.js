const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const Message = require('../models/Message');

// roomId -> Map(socketId -> { userId, name })
const rooms = new Map();

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const { id } = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
      const user = await User.findById(id).select('name email');
      if (!user) return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId }) => {
      if (!roomId) return;
      socket.join(roomId);
      socket.roomId = roomId;

      if (!rooms.has(roomId)) rooms.set(roomId, new Map());
      const room = rooms.get(roomId);
      const existing = [...room.entries()].map(([socketId, u]) => ({ socketId, ...u }));
      room.set(socket.id, { userId: socket.user.id, name: socket.user.name });

      socket.emit('room-users', existing);
      socket.to(roomId).emit('user-joined', { socketId: socket.id, name: socket.user.name });
    });

    // WebRTC signaling relay (offer / answer / ICE candidates)
    socket.on('signal', ({ to, data }) => {
      if (!socket.roomId || !to) return;
      io.to(to).emit('signal', { from: socket.id, name: socket.user.name, data });
    });

    socket.on('media-state', (state) => {
      if (!socket.roomId) return;
      socket.to(socket.roomId).emit('media-state', {
        socketId: socket.id,
        micOn: !!state.micOn,
        camOn: !!state.camOn,
        sharing: !!state.sharing,
      });
    });

    socket.on('chat-message', async ({ text }) => {
      const clean = (text || '').toString().trim().slice(0, 2000);
      if (!socket.roomId || !clean) return;
      try {
        const msg = await Message.create({
          roomId: socket.roomId,
          sender: socket.user.id,
          senderName: socket.user.name,
          text: clean,
        });
        io.to(socket.roomId).emit('chat-message', msg);
      } catch (e) {
        console.error('chat save failed', e.message);
      }
    });

    socket.on('transcript', async ({ text }) => {
      const clean = (text || '').toString().trim().slice(0, 1000);
      if (!socket.roomId || !clean) return;
      const entry = { speaker: socket.user.id, speakerName: socket.user.name, text: clean, at: new Date() };
      io.to(socket.roomId).emit('transcript', entry);
      try {
        await Meeting.updateOne({ roomId: socket.roomId }, { $push: { transcript: entry } });
      } catch (e) {
        console.error('transcript save failed', e.message);
      }
    });

    const leave = () => {
      const { roomId } = socket;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) rooms.delete(roomId);
      }
      socket.to(roomId).emit('user-left', { socketId: socket.id });
      socket.leave(roomId);
      socket.roomId = null;
    };

    socket.on('leave-room', leave);
    socket.on('disconnect', leave);
  });
};
