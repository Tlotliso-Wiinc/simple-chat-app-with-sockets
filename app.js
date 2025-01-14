import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { ChatOpenAI } from "@langchain/openai";
import Message from './models/Message.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chat-app');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Listen for incoming chat messages
    socket.on('chat message', async (data) => {
        console.log(data);

        // Call the LLM
        const response = await llm.invoke([{ role: "user", content: data.message }]);

        // Broadcast the message to all connected clients
        io.emit('chat message', { user: "AI", message: response.content});
        
        /*try {
        // Save the message to MongoDB
        const message = new Message({ user: data.user, text: data.message });
        await message.save();
        console.log('Message saved to the database');
        
        // Broadcast the message to all connected clients
        io.emit('chat message', data);
        } catch (err) {
        console.error('Error saving message to database:', err);
        }*/
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