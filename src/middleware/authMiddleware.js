const { verifyJwtToken } = require("@/services/jwt.service");

const middleware = (req, res, next) => {

  const apiKey = req.headers['api_key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized: api_key missing' });
  }
  const expectedApiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized: api_key missing' });
  }
  if (apiKey !== expectedApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid api_key' });
  }

  next();
};

module.exports = middleware;