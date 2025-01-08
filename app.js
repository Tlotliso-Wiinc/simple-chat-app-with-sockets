const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chat-app');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const Message = require('./models/Message');

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Listen for incoming chat messages
    socket.on('chat message', async (data) => {
        console.log('Received message:', data);

        try {
        // Save the message to MongoDB
        const message = new Message({ user: data.user, text: data.message });
        await message.save();
        console.log('Message saved to the database');
        
        // Broadcast the message to all connected clients
        io.emit('chat message', data);
        } catch (err) {
        console.error('Error saving message to database:', err);
        }
  });

  // Listen for user disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.use(express.static('public'));