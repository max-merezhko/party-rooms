/**
 * Aggregated stats for "most liked" and "top rated this week" (likes in last 7 days).
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/** GET /api/leaderboard/most-liked */
router.get('/most-liked', requireAuth, async (req, res) => {
  try {
    const { data: likesRows, error: likesErr } = await req.db.from('likes').select('queue_id');
    if (likesErr) return res.status(400).json({ error: likesErr.message });

    const counts = new Map();
    for (const row of likesRows || []) {
      const qid = row.queue_id;
      counts.set(qid, (counts.get(qid) || 0) + 1);
    }

    const sortedIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([id]) => id);

    if (sortedIds.length === 0) {
      return res.json({ items: [] });
    }

    const { data: queueRows, error: qErr } = await req.db
      .from('queue')
      .select('id, youtube_video_id, title, thumbnail')
      .in('id', sortedIds);

    if (qErr) return res.status(400).json({ error: qErr.message });

    const byId = new Map((queueRows || []).map((q) => [q.id, q]));
    const items = sortedIds
      .map((id) => {
        const q = byId.get(id);
        if (!q) return null;
        return {
          queueId: q.id,
          youtube_video_id: q.youtube_video_id,
          title: q.title,
          thumbnail: q.thumbnail,
          likeCount: counts.get(id) || 0,
        };
      })
      .filter(Boolean);

    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Leaderboard failed' });
  }
});

/** GET /api/leaderboard/top-week */
router.get('/top-week', requireAuth, async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: likesRows, error: likesErr } = await req.db
      .from('likes')
      .select('queue_id, created_at')
      .gte('created_at', since);

    if (likesErr) return res.status(400).json({ error: likesErr.message });

    const counts = new Map();
    for (const row of likesRows || []) {
      const qid = row.queue_id;
      counts.set(qid, (counts.get(qid) || 0) + 1);
    }

    const sortedIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([id]) => id);

    if (sortedIds.length === 0) {
      return res.json({ items: [] });
    }

    const { data: queueRows, error: qErr } = await req.db
      .from('queue')
      .select('id, youtube_video_id, title, thumbnail')
      .in('id', sortedIds);

    if (qErr) return res.status(400).json({ error: qErr.message });

    const byId = new Map((queueRows || []).map((q) => [q.id, q]));
    const items = sortedIds
      .map((id) => {
        const q = byId.get(id);
        if (!q) return null;
        return {
          queueId: q.id,
          youtube_video_id: q.youtube_video_id,
          title: q.title,
          thumbnail: q.thumbnail,
          likeCount: counts.get(id) || 0,
        };
      })
      .filter(Boolean);

    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Top week failed' });
  }
});

module.exports = router;
