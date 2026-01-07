const jwt = require("jsonwebtoken");
require("dotenv").config();
const apiSecret = process.env.API_SECRET;

exports.createJwtToken = async (expires, data) => {
    // console.log("apiSecret: ", apiSecret)
    if (!apiSecret) {
        console.log(process.env);
        return null;
    }
    // expires , format is '1h', '1d', '1m', '1y' or '1s'
    const payload = data || {};
    const token = jwt.sign(payload, apiSecret, { expiresIn: expires });
    return token;
};

exports.verifyJwtToken = (token, secret) => {
    try {
        const _secret = secret || apiSecret;
        const decoded = jwt.verify(token, _secret);
        return decoded;
    } catch (err) {
        console.error("Error verifying token: ", err.message || err);
        return false;
    }
};

exports.createJwtTokenOther = async (secret, expires, data) => {
    // console.log("apiSecret: ", apiSecret)
    const apiSecret = secret;
    if (!apiSecret) {
        console.error("Error creating token: ", secret);
        return null;
    }
    // expires , format is '1h', '1d', '1m', '1y' or '1s'
    const payload = data || {};
    const token = jwt.sign(payload, apiSecret, { expiresIn: expires });
    return token;
};