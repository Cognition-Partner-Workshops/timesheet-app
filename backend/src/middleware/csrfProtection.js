/**
 * CSRF Protection Middleware
 * 
 * Prevents cross-site request forgery by requiring that state-changing
 * requests (POST, PUT, PATCH, DELETE) include a Content-Type: application/json
 * header. HTML forms cannot send this content type cross-origin, so this
 * effectively blocks CSRF attacks from malicious websites.
 */
function requireJsonContentType(req, res, next) {
  const stateMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (stateMethods.includes(req.method)) {
    const contentType = req.headers['content-type'];
    
    // Allow requests with no body (e.g., DELETE with no payload)
    if (req.headers['content-length'] === '0' || (!contentType && !req.body)) {
      return next();
    }
    
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({
        error: 'Unsupported Media Type. Content-Type must be application/json for state-changing requests.'
      });
    }
  }
  
  next();
}

module.exports = {
  requireJsonContentType
};
