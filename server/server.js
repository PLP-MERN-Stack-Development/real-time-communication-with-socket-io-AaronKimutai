const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const allowedOrigins = [
    'http://localhost:5173',
    'https://voluble-beijinho-f88185.netlify.app'
];


const app = express();
const server = http.createServer(app); 

const io = new Server(server, {
    cors: {
        origin: allowedOrigins, 
        methods: ['GET', 'POST'],
        credentials: true,
    },
});


// Middleware
app.use(cors({
    origin: allowedOrigins, 
    methods: ["GET", "POST"],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));



const users = {};
const messages = []; 
const typingUsers = {}; 

let messageIdCounter = 1;



// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };