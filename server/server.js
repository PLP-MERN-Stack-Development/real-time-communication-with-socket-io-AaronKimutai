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


const findMessageById = (id) => messages.find(msg => msg.id === id);


// Socket.io connection handler
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('user_join_room', ({ username, room }) => {
        const oldRoom = users[socket.id]?.room;

        if (oldRoom && oldRoom !== room) {
            socket.leave(oldRoom);
            io.to(oldRoom).emit('user_left', { username, id: socket.id, room: oldRoom });
        }
        
        socket.join(room);
        users[socket.id] = { username, id: socket.id, room };
        
        io.emit('user_list', Object.values(users));
        io.to(room).emit('user_joined', { username, id: socket.id, room });

        console.log(`${username} joined room: ${room}`);
    });

    socket.on('file_share', (fileMessageData, callback) => {
        const user = users[socket.id];
        if (!user || !user.room) {
            if (callback) callback({ status: 'Error', message: 'Not in a room.' });
            return;
        }

        const message = {
            ...fileMessageData,
            id: messageIdCounter++, 
            sender: user.username,
            senderId: socket.id,
            timestamp: new Date().toISOString(),
            room: user.room,
            reactions: {},
        };
        
        messages.push(message); 
        io.to(user.room).emit('receive_message', message);
        
        if (callback) {
            callback({ status: 'OK', id: message.id, timestamp: message.timestamp });
        }
    });


    socket.on('send_message', (messageData, callback) => {
        const user = users[socket.id];
        if (!user || !user.room) {
            if (callback) callback({ status: 'Error', message: 'Not in a room.' });
            return;
        }

        const message = {
            ...messageData,
            id: messageIdCounter++, 
            sender: user.username || 'Anonymous',
            senderId: socket.id,
            timestamp: new Date().toISOString(),
            room: user.room,
            reactions: {},
        };
        
        messages.push(message); 
        io.to(user.room).emit('receive_message', message);
        
        if (callback) {
            callback({ status: 'OK', id: message.id, timestamp: message.timestamp });
        }
    });


    socket.on('private_message', (messageData, callback) => {
        const user = users[socket.id];
        if (!user) {
            if (callback) callback({ status: 'Error', message: 'User not found.' });
            return; 
        }

        const message = {
            ...messageData,
            id: messageIdCounter++,
            sender: user.username,
            senderId: socket.id,
            timestamp: new Date().toISOString(),
            isPrivate: true,
            room: user.room,
            reactions: {},
        };
        
        const recipientSocket = io.sockets.sockets.get(message.to);
        
        if (recipientSocket) {
            recipientSocket.emit('private_message', message);
            socket.emit('private_message', message);
            
            if (callback) {
                callback({ status: 'OK', id: message.id, timestamp: message.timestamp });
            }
        } else {
            if (callback) {
                callback({ status: 'Error', message: 'Recipient offline.' });
            }
        }
    });


    socket.on('read_receipt', ({ room, lastMessageId }) => {
        const readerId = socket.id;
        const readerUsername = users[readerId]?.username;
        if (!readerUsername) return;

        messages.forEach(msg => {
            if (msg.room === room && msg.id <= lastMessageId && msg.senderId !== readerId) {
                if (!msg.readBy) msg.readBy = [];
                
                if (!msg.readBy.includes(readerId)) {
                    msg.readBy.push(readerId);
                    
                    io.to(msg.senderId).emit('message_read', {
                        messageId: msg.id,
                        readerId: readerId
                    });
                }
            }
        });
    });


    socket.on('react_message', ({ messageId, reactionType }) => {
        const user = users[socket.id];
        if (!user) return;

        const messageToUpdate = findMessageById(messageId);

        if (messageToUpdate) {
            const userId = socket.id;
            
            if (!messageToUpdate.reactions[reactionType]) {
                messageToUpdate.reactions[reactionType] = [];
            }

            const reactedIndex = messageToUpdate.reactions[reactionType].indexOf(userId);

            if (reactedIndex > -1) {
                messageToUpdate.reactions[reactionType].splice(reactedIndex, 1);
            } else {
                messageToUpdate.reactions[reactionType].push(userId);
            }
            
            io.to(messageToUpdate.room).emit('message_reacted', { 
                messageId: messageToUpdate.id,
                newReactions: messageToUpdate.reactions,
            });
        }
    });


    
    socket.on('typing', (isTyping) => {
        const user = users[socket.id];
        if (!user || !user.room) return;

        if (isTyping) {
            typingUsers[socket.id] = { username: user.username, room: user.room };
        } else {
            delete typingUsers[socket.id];
        }

        const roomTypingUsers = Object.values(typingUsers)
                                       .filter(u => u.room === user.room)
                                       .map(u => u.username);
        
        socket.to(user.room).emit('typing_users', roomTypingUsers);
    });

    
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('user_left', { username: user.username, id: socket.id, room: user.room });
            

            console.log(`${user.username} left the chat from room: ${user.room}`);
        }
        
        delete users[socket.id];
        delete typingUsers[socket.id];
        
        io.emit('user_list', Object.values(users));
        
        const globalTypingUsers = Object.values(typingUsers).map(u => u.username);
        io.emit('typing_users', globalTypingUsers); 
    });
});

// API route for Pagination 
app.get('/api/messages', (req, res) => {
    const { room, limit = 20, offset = 0 } = req.query;
    
    const numLimit = Number(limit);
    const numOffset = Number(offset);

    const roomMessages = messages
        .filter(msg => msg.room === room && !msg.isPrivate)
        .sort((a, b) => b.id - a.id); 

    const paginatedMessages = roomMessages
        .slice(numOffset, numOffset + numLimit)
        .reverse(); 
    
    res.json(paginatedMessages);
});

// Root route
app.get('/', (req, res) => {
    res.send('Socket.io Chat Server is running');
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };