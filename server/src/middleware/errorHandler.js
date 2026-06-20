// Central error handler — returns French messages.
export function notFound(req, res) {
  res.status(404).json({ message: 'Ressource introuvable.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('Erreur serveur :', err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.publicMessage || 'Une erreur interne est survenue. Veuillez réessayer.',
  });
}
