/**
 * Socket.io: authenticated connections, room channels, chat, player sync.
 * Client should pass access_token in handshake: io(url, { auth: { token } })
 */

const { getSupabaseAnon, getDbClient } = require('../lib/supabase');

/** Last known playback state per room (for late joiners). */
const playbackByRoom = new Map();

async function verifyRoomMembership(accessToken, roomId, userId) {
  const db = getDbClient(accessToken);
  const { data, error } = await db
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
}

function register(io) {
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();

      if (!token) {
        return next(new Error('Unauthorized: missing token'));
      }

      const supabase = getSupabaseAnon();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        return next(new Error('Unauthorized: invalid token'));
      }

      socket.user = user;
      socket.accessToken = token;
      return next();
    } catch (e) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    /** roomId -> Set of socket ids (for debugging; Socket.io rooms handle fan-out) */
    socket.on('room:join', async (payload, ack) => {
      try {
        const roomId = payload?.roomId;
        if (!roomId) {
          ack?.({ ok: false, error: 'roomId required' });
          return;
        }

        const ok = await verifyRoomMembership(socket.accessToken, roomId, socket.user.id);
        if (!ok) {
          ack?.({ ok: false, error: 'Join the room via HTTP before connecting here' });
          return;
        }

        await socket.join(`room:${roomId}`);
        const playback = playbackByRoom.get(roomId) || null;
        ack?.({ ok: true, roomId, playback });
      } catch (e) {
        ack?.({ ok: false, error: e.message });
      }
    });

    socket.on('room:leave', async (payload, ack) => {
      try {
        const roomId = payload?.roomId;
        if (!roomId) {
          ack?.({ ok: false, error: 'roomId required' });
          return;
        }
        await socket.leave(`room:${roomId}`);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: e.message });
      }
    });

    socket.on('chat:message', async (payload, ack) => {
      try {
        const roomId = payload?.roomId;
        const text = (payload?.text || '').trim();
        if (!roomId || !text) {
          ack?.({ ok: false, error: 'roomId and text required' });
          return;
        }

        const ok = await verifyRoomMembership(socket.accessToken, roomId, socket.user.id);
        if (!ok) {
          ack?.({ ok: false, error: 'Not a member of this room' });
          return;
        }

        const message = {
          roomId,
          userId: socket.user.id,
          email: socket.user.email,
          text: text.slice(0, 2000),
          ts: Date.now(),
        };

        socket.to(`room:${roomId}`).emit('chat:message', message);
        socket.emit('chat:message', message);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: e.message });
      }
    });

    /**
     * Host/clients broadcast playback state. Others apply in the YouTube player.
     * payload: { roomId, videoId?, isPlaying?, currentTime? }
     */
    socket.on('player:sync', async (payload, ack) => {
      try {
        const roomId = payload?.roomId;
        if (!roomId) {
          ack?.({ ok: false, error: 'roomId required' });
          return;
        }

        const ok = await verifyRoomMembership(socket.accessToken, roomId, socket.user.id);
        if (!ok) {
          ack?.({ ok: false, error: 'Not a member of this room' });
          return;
        }

        const state = {
          roomId,
          videoId: payload.videoId ?? null,
          isPlaying: !!payload.isPlaying,
          currentTime: typeof payload.currentTime === 'number' ? payload.currentTime : null,
          ts: Date.now(),
        };

        playbackByRoom.set(roomId, state);
        socket.to(`room:${roomId}`).emit('player:sync', state);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: e.message });
      }
    });

    /** Notify room that queue changed (after REST mutations). Client can refetch or patch UI. */
    socket.on('queue:refresh', async (payload, ack) => {
      try {
        const roomId = payload?.roomId;
        if (!roomId) {
          ack?.({ ok: false, error: 'roomId required' });
          return;
        }

        const ok = await verifyRoomMembership(socket.accessToken, roomId, socket.user.id);
        if (!ok) {
          ack?.({ ok: false, error: 'Not a member of this room' });
          return;
        }

        io.to(`room:${roomId}`).emit('queue:refresh', { roomId });
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: e.message });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', socket.id, reason);
    });
  });
}

module.exports = { register, playbackByRoom };
