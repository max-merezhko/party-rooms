/**
 * Auth routes backed by Supabase Auth (email/password).
 * Email confirmation is configured in the Supabase dashboard.
 */

const express = require('express');
const { getSupabaseAnon } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const supabase = getSupabaseAnon();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) return res.status(400).json({ error: error.message });

    return res.status(201).json({
      user: data.user,
      session: data.session,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const supabase = getSupabaseAnon();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return res.status(401).json({ error: error.message });

    return res.json({
      user: data.user,
      session: data.session,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  return res.json({
    user: req.user,
  });
});

module.exports = router;
