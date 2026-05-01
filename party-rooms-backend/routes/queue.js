/**
 * Per-room queue: list, add YouTube items, vote, remove, toggle like (leaderboard).
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function assertRoomMember(db, roomId, userId) {
  const { data, error } = await db
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('Not a member of this room');
    err.statusCode = 403;
    throw err;
  }
}

/** GET /api/rooms/:roomId/queue */
router.get('/rooms/:roomId/queue', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    await assertRoomMember(req.db, roomId, req.user.id);

    const { data, error } = await req.db
      .from('queue')
      .select('*')
      .eq('room_id', roomId)
      .order('votes', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ items: data || [] });
  } catch (e) {
    const code = e.statusCode || 500;
    return res.status(code).json({ error: e.message || 'Failed to load queue' });
  }
});

/** POST /api/rooms/:roomId/queue */
router.post('/rooms/:roomId/queue', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const youtube_video_id = (req.body?.youtube_video_id || '').trim();
    const title = (req.body?.title || '').trim();
    const thumbnail = (req.body?.thumbnail || '').trim() || null;

    if (!youtube_video_id || !title) {
      return res.status(400).json({ error: 'youtube_video_id and title are required' });
    }

    await assertRoomMember(req.db, roomId, req.user.id);

    const { data, error } = await req.db
      .from('queue')
      .insert({
        room_id: roomId,
        youtube_video_id,
        title: title.slice(0, 255),
        thumbnail: thumbnail ? thumbnail.slice(0, 500) : null,
        added_by: req.user.id,
        votes: 0,
      })
      .select('*')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ item: data });
  } catch (e) {
    const code = e.statusCode || 500;
    return res.status(code).json({ error: e.message || 'Failed to add song' });
  }
});

/** POST /api/queue/:queueId/vote — body: { direction: 'up' | 'down' } */
router.post('/queue/:queueId/vote', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const direction = req.body?.direction;

    const delta = direction === 'up' ? 1 : direction === 'down' ? -1 : 0;
    if (!delta) {
      return res.status(400).json({ error: 'direction must be "up" or "down"' });
    }

    const { data: row, error: fetchErr } = await req.db
      .from('queue')
      .select('id, room_id, votes')
      .eq('id', queueId)
      .single();

    if (fetchErr || !row) return res.status(404).json({ error: 'Queue item not found' });

    await assertRoomMember(req.db, row.room_id, req.user.id);

    const nextVotes = (row.votes || 0) + delta;

    const { data, error } = await req.db
      .from('queue')
      .update({ votes: nextVotes })
      .eq('id', queueId)
      .select('*')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ item: data });
  } catch (e) {
    const code = e.statusCode || 500;
    return res.status(code).json({ error: e.message || 'Vote failed' });
  }
});

/** DELETE /api/queue/:queueId — remover must be the user who added the track */
router.delete('/queue/:queueId', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;

    const { data: row, error: fetchErr } = await req.db
      .from('queue')
      .select('id, room_id, added_by')
      .eq('id', queueId)
      .single();

    if (fetchErr || !row) return res.status(404).json({ error: 'Queue item not found' });

    await assertRoomMember(req.db, row.room_id, req.user.id);

    if (row.added_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the user who added the song can remove it' });
    }

    const { error } = await req.db.from('queue').delete().eq('id', queueId);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    const code = e.statusCode || 500;
    return res.status(code).json({ error: e.message || 'Failed to remove song' });
  }
});

/** POST /api/queue/:queueId/like — toggle row in likes table */
router.post('/queue/:queueId/like', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;

    const { data: row, error: fetchErr } = await req.db
      .from('queue')
      .select('id, room_id')
      .eq('id', queueId)
      .single();

    if (fetchErr || !row) return res.status(404).json({ error: 'Queue item not found' });

    await assertRoomMember(req.db, row.room_id, req.user.id);

    const { data: existing } = await req.db
      .from('likes')
      .select('user_id')
      .eq('user_id', req.user.id)
      .eq('queue_id', queueId)
      .maybeSingle();

    if (existing) {
      const { error } = await req.db
        .from('likes')
        .delete()
        .eq('user_id', req.user.id)
        .eq('queue_id', queueId);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ liked: false });
    }

    const { error } = await req.db.from('likes').insert({
      user_id: req.user.id,
      queue_id: queueId,
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ liked: true });
  } catch (e) {
    const code = e.statusCode || 500;
    return res.status(code).json({ error: e.message || 'Like toggle failed' });
  }
});

module.exports = router;
