function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(403).json({ error: 'Access denied: no role assigned' });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }

    next();
  };
}

module.exports = {
  requireRole
};
