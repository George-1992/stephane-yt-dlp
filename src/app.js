const path = require('path');
const express = require('express')
const routes = require('./routes')
const middleware = require('@/middleware/authMiddleware')


const app = express()

app.use(express.json())
app.use(middleware);
app.use('/api/v1', routes)
// Apply to all routes


// Serve static files from the public folder
app.use(express.static(path.join(__dirname, '..', 'public')));



module.exports = app
