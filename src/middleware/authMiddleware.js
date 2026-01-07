const { verifyJwtToken } = require("@/services/jwt.service");

const middleware = (req, res, next) => {
  // const authHeader = req.headers['authorization'];

  // // console.log('Authorization header:', authHeader);
  // if (!authHeader || !authHeader.startsWith('Bearer ')) {
  //   return res.status(401).json({ error: 'Unauthorized: Bearer token missing' });
  // }

  // const token = authHeader.split(' ')[1];

  // // Optional: validate the token (JWT verify, etc.)

  // // AUTH_TOKEN_SECRET
  // const apiSecret = process.env.AUTH_TOKEN_SECRET;
  // const isOk = verifyJwtToken(token, apiSecret);

  // if (!isOk) {
  //   return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  // }

  // // Token is valid
  next();
};

module.exports = middleware;