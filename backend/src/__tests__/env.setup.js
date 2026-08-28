// Set environment variables for testing before any modules are loaded
process.env.JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
