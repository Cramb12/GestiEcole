// Auth controller — login and current-user lookup.
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { signToken } from '../utils/jwt.js';

// POST /api/auth/login  { email, password }
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Basic validation (French messages).
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "L'email et le mot de passe sont obligatoires." });
    }

    const { rows } = await query(
      'SELECT id, nom, postnom, email, password, role, actif FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }
    if (!user.actif) {
      return res.status(403).json({ message: 'Ce compte est désactivé.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const payload = {
      id: user.id,
      role: user.role,
      nom: user.nom,
      postnom: user.postnom,
      email: user.email,
    };

    const token = signToken(payload);

    res.json({ token, user: payload });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me  (requires auth) — returns the current user from the token.
export async function me(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT id, nom, postnom, email, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
}
