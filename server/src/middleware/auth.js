// Authentication & authorization middleware.
import { verifyToken } from '../utils/jwt.js';

// Verifies the JWT and attaches the decoded user to req.user.
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Accès refusé : token manquant.' });
  }

  try {
    req.user = verifyToken(token); // { id, role, nom, email }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expirée ou token invalide.' });
  }
}

// Restricts a route to specific roles. Usage: authorize('super_admin')
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Vous n'avez pas l'autorisation d'accéder à cette ressource." });
    }
    next();
  };
}
