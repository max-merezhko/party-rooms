/**
 * Rooms: list public rooms, create, join (password for private), leave.
 */

const express = require('express');
const bcrypt = require('bcrypt');
const { requireAuth } = require('../middleware/auth');
const { getSupabaseAdmin, getSupabaseAnon } = require('../lib/supabase');

const router = express.Router();

function notifyRoomMembersChanged(req, roomId) {
  try {
    const io = req.app && req.app.get('io');
    if (io) io.to(`room:${roomId}`).emit('members:refresh', { roomId });
  } catch (_) {
    /* ignore */
  }
}

/** Membership list + repair: creators always appear even if room_members row was missing. */
async function listMyRooms(req, res) {
  try {
    const uid = req.user.id;

    const { data: memberships, error: mErr } = await req.db
      .from('room_members')
      .select('room_id')
      .eq('user_id', uid);

    if (mErr) return res.status(400).json({ error: mErr.message });

    const idSet = new Set((memberships || []).map((m) => m.room_id));

    const { data: createdRooms, error: cErr } = await req.db
      .from('rooms')
      .select('id')
      .eq('created_by', uid);

    if (cErr) return res.status(400).json({ error: cErr.message });

    for (const row of createdRooms || []) {
      if (!idSet.has(row.id)) {
        const { error: fixErr } = await req.db.from('room_members').upsert(
          { room_id: row.id, user_id: uid },
          { onConflict: 'room_id,user_id' },
        );
        if (!fixErr) idSet.add(row.id);
      }
    }

    const ids = [...idSet];
    if (!ids.length) return res.json({ rooms: [] });

    const { data: roomRows, error: rErr } = await req.db
      .from('rooms')
      .select('id, name, is_public, created_at, created_by')
      .in('id', ids);

    if (rErr) return res.status(400).json({ error: rErr.message });

    const merged = roomRows || [];

    merged.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });

    return res.json({ rooms: merged });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to list your rooms' });
  }
}

function publicRoomsClient() {
  const admin = getSupabaseAdmin();
  return admin || getSupabaseAnon();
}

/** List public rooms (no auth). */
router.get('/', async (req, res) => {
  try {
    const client = publicRoomsClient();
    const { data, error } = await client
      .from('rooms')
      .select('id, name, is_public, created_at, created_by')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ rooms: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to list rooms' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const name = (req.body?.name || '').trim();
    const isPublic = !!req.body?.is_public;
    const password = req.body?.password;

    if (!name || name.length > 100) {
      return res.status(400).json({ error: 'name is required (max 100 chars)' });
    }

    let storedPassword = null;
    if (!isPublic) {
      if (!password || String(password).length < 4) {
        return res.status(400).json({ error: 'Private rooms require a password (min 4 characters)' });
      }
      storedPassword = await bcrypt.hash(String(password), 10);
    }

    const { data, error } = await req.db
      .from('rooms')
      .insert({
        name,
        is_public: isPublic,
        password: storedPassword,
        created_by: req.user.id,
      })
      .select('id, name, is_public, created_at, created_by')
      .single();

    if (error) return res.status(400).json({ error: error.message });

    const { error: memberErr } = await req.db.from('room_members').insert({
      room_id: data.id,
      user_id: req.user.id,
    });

    if (memberErr) {
      await req.db.from('rooms').delete().eq('id', data.id);
      return res.status(400).json({ error: memberErr.message });
    }

    return res.status(201).json({ room: data });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to create room' });
  }
});

/**
 * Rooms you belong to (memberships + rooms you created).
 * Register these literal paths before GET /:roomId.
 */
router.get('/memberships', requireAuth, listMyRooms);
router.get('/joined', requireAuth, listMyRooms);

/** Member list for a room (must be before GET /:roomId). */
router.get('/:roomId/members', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;

    const { data: selfRow, error: selfErr } = await req.db
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (selfErr) return res.status(400).json({ error: selfErr.message });
    if (!selfRow) return res.status(403).json({ error: 'Not a member of this room' });

    const { data: rows, error } = await req.db
      .from('room_members')
      .select('user_id, joined_at')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    const admin = getSupabaseAdmin();
    const members = await Promise.all(
      (rows || []).map(async (row) => {
        let email = null;
        if (admin) {
          const { data: authData } = await admin.auth.admin.getUserById(row.user_id);
          email = authData?.user?.email ?? null;
        }
        return {
          user_id: row.user_id,
          joined_at: row.joined_at ?? null,
          email,
        };
      }),
    );

    return res.json({ members });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to list members' });
  }
});

/** Room metadata for UI (members only). */
router.get('/:roomId', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;

    const { data: member, error: memErr } = await req.db
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (memErr) return res.status(400).json({ error: memErr.message });
    if (!member) {
      return res.status(403).json({ error: 'You must join this room before viewing details' });
    }

    const { data: room, error } = await req.db
      .from('rooms')
      .select('id, name, is_public')
      .eq('id', roomId)
      .single();

    if (error || !room) return res.status(404).json({ error: 'Room not found' });

    return res.json({ room });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load room' });
  }
});

router.post('/:roomId/join', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const joinPassword = req.body?.password;

    const { data: room, error: roomErr } = await req.db
      .from('rooms')
      .select('id, is_public, password')
      .eq('id', roomId)
      .single();

    if (roomErr || !room) return res.status(404).json({ error: 'Room not found' });

    const { data: alreadyMember } = await req.db
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (alreadyMember) {
      return res.json({ ok: true, roomId: room.id });
    }

    if (!room.is_public) {
      if (!joinPassword) {
        return res.status(400).json({ error: 'Password required for private room' });
      }
      const stored = room.password;
      if (!stored) return res.status(500).json({ error: 'Room misconfigured' });
      const ok = await bcrypt.compare(String(joinPassword), stored);
      if (!ok) return res.status(403).json({ error: 'Invalid password' });
    }

    const { error: memberErr } = await req.db.from('room_members').upsert(
      {
        room_id: room.id,
        user_id: req.user.id,
      },
      { onConflict: 'room_id,user_id' },
    );

    if (memberErr) return res.status(400).json({ error: memberErr.message });

    notifyRoomMembersChanged(req, room.id);
    return res.json({ ok: true, roomId: room.id });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to join room' });
  }
});

router.delete('/:roomId/leave', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;

    const { error } = await req.db
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    notifyRoomMembersChanged(req, roomId);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to leave room' });
  }
});

/** Delete room forever (creator only). Cascades queue, members, likes if FKs set. */
router.delete('/:roomId', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;

    const { data: room, error: fetchErr } = await req.db
      .from('rooms')
      .select('id, created_by')
      .eq('id', roomId)
      .single();

    if (fetchErr || !room) return res.status(404).json({ error: 'Room not found' });

    if (room.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the room creator can delete it' });
    }

    const { error: delErr } = await req.db.from('rooms').delete().eq('id', roomId);

    if (delErr) return res.status(400).json({ error: delErr.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to delete room' });
  }
});

module.exports = router;
