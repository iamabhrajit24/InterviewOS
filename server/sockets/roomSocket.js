const axios = require('axios');

// In-memory room storage
// roomId -> { users: [{ id, role, socketId }], currentTopic: string }
const rooms = new Map();

module.exports = function handleRoomSocket(io) {
  const roomNamespace = io.of('/room');

  roomNamespace.on('connection', (socket) => {
    console.log(`[Socket.io Room] User connected: ${socket.id}`);

    // ── Create Room ──────────────────────────────────────────────────────────
    socket.on('create-room', ({ roomId, role }) => {
      socket.join(roomId);
      rooms.set(roomId, {
        users: [{ id: socket.id, role, socketId: socket.id }],
        currentTopic: 'Software Engineering Architecture'
      });
      console.log(`[Socket.io Room] Created room ${roomId} by ${socket.id} with role ${role}`);
      socket.emit('room-created', { roomId });
    });

    // ── Join Room ────────────────────────────────────────────────────────────
    socket.on('join-room', ({ roomId, role }) => {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: [], currentTopic: 'Software Engineering Architecture' });
      }

      const room = rooms.get(roomId);
      
      // Keep only two users in WebRTC peer connection
      if (room.users.length >= 2) {
        socket.emit('room-full');
        return;
      }

      socket.join(roomId);
      room.users.push({ id: socket.id, role, socketId: socket.id });
      console.log(`[Socket.io Room] Joined room ${roomId} - user ${socket.id} as ${role}`);

      socket.emit('room-joined', { roomId, users: room.users });
      // Notify the other peer
      socket.to(roomId).emit('peer-connected', { peerId: socket.id, role, users: room.users });
    });

    // ── WebRTC Signaling: Offer ──────────────────────────────────────────────
    socket.on('offer', ({ sdp, roomId }) => {
      console.log(`[Signaling] Offer sent by ${socket.id} in room ${roomId}`);
      socket.to(roomId).emit('offer', { sdp, peerId: socket.id });
    });

    // ── WebRTC Signaling: Answer ─────────────────────────────────────────────
    socket.on('answer', ({ sdp, roomId }) => {
      console.log(`[Signaling] Answer sent by ${socket.id} in room ${roomId}`);
      socket.to(roomId).emit('answer', { sdp, peerId: socket.id });
    });

    // ── WebRTC Signaling: ICE Candidate ──────────────────────────────────────
    socket.on('ice-candidate', ({ candidate, roomId }) => {
      console.log(`[Signaling] Candidate sent by ${socket.id} in room ${roomId}`);
      socket.to(roomId).emit('ice-candidate', { candidate, peerId: socket.id });
    });

    // ── AI Suggest Question (Groq primary, Gemini fallback) ───────────────────
    socket.on('suggest-question', async ({ roomId, topic }) => {
      console.log(`[AI Suggested Question] Request in room ${roomId} for topic ${topic}`);
      const prompt = `You are a technical interview simulator panel. 
The collaborative mock interview room is debating: "${topic}".
Generate exactly ONE relevant, challenging technical mock interview question.
Keep the question extremely concise and clear (1-2 sentences).
Do not output any introductory or conversational text, return only the question.`;

      let question = '';
      let success = false;

      // 1. Try Groq Primary
      if (process.env.GROQ_API_KEY) {
        try {
          const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 150
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            }
          });
          question = res.data?.choices?.[0]?.message?.content?.trim();
          if (question) {
            success = true;
            console.log('[AI Suggest] Succeeded with Groq');
          }
        } catch (err) {
          console.error('[AI Suggest] Groq failed, falling back to Gemini:', err.message);
        }
      }

      // 2. Try Gemini Fallback
      if (!success && process.env.GEMINI_API_KEY) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
          const res = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }]
          });
          question = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (question) {
            success = true;
            console.log('[AI Suggest] Succeeded with Gemini');
          }
        } catch (err) {
          console.error('[AI Suggest] Gemini failed:', err.message);
        }
      }

      if (!success) {
        question = "What are the architectural differences between choosing horizontal scalability over vertical scalability in this design?";
      }

      // Broadcast the question to all users in the room
      roomNamespace.to(roomId).emit('suggested-question', { question });
    });

    // ── Leave Room ───────────────────────────────────────────────────────────
    socket.on('leave-room', ({ roomId }) => {
      socket.leave(roomId);
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.users = room.users.filter(u => u.socketId !== socket.id);
        console.log(`[Socket.io Room] User ${socket.id} left room ${roomId}`);
        
        if (room.users.length === 0) {
          rooms.delete(roomId);
        } else {
          socket.to(roomId).emit('peer-disconnected', { peerId: socket.id, users: room.users });
        }
      }
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket.io Room] User disconnected: ${socket.id}`);
      for (const [roomId, room] of rooms.entries()) {
        const index = room.users.findIndex(u => u.socketId === socket.id);
        if (index !== -1) {
          room.users.splice(index, 1);
          socket.to(roomId).emit('peer-disconnected', { peerId: socket.id, users: room.users });
          console.log(`[Socket.io Room] Cleaned user ${socket.id} from room ${roomId}`);
          if (room.users.length === 0) {
            rooms.delete(roomId);
          }
        }
      }
    });
  });
};
