/**
 * Proxies YouTube Data API search so the API key stays on the server.
 */

const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY is not configured' });

    const { data } = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        type: 'video',
        maxResults: 15,
        q,
        key,
      },
    });

    const items = (data.items || []).map((item) => ({
      videoId: item.id?.videoId,
      title: item.snippet?.title,
      description: item.snippet?.description,
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      channelTitle: item.snippet?.channelTitle,
    }));

    return res.json({ items });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message || 'YouTube search failed';
    return res.status(502).json({ error: msg });
  }
});

module.exports = router;
