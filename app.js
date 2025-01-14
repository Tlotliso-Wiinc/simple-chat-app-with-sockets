import express, { response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { ChatOpenAI } from "@langchain/openai";
import Message from './models/Message.js';
import dotenv from 'dotenv';

import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";

import { v4 as uuidv4 } from "uuid";

const config = { configurable: { thread_id: uuidv4() } };

// Define the function that calls the model
const callModel = async (state) => {
  const response = await llm.invoke(state.messages);
  return { messages: response };
};

// Define a new graph
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel)
  .addEdge(START, "model")
  .addEdge("model", END);

// Add memory
const memory = new MemorySaver();
const graphApp = workflow.compile({ checkpointer: memory });

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chat-app');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const llm = new ChatOpenAI({
  apiKey: dotenv.config().parsed.OPENAI_API_KEY,
  model: "gpt-4o-mini",
  temperature: 0
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join a specific room when user connects
    socket.on('join room', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    // Listen for incoming chat messages
    socket.on('chat message', async (data) => {
        console.log(data);
        
        // Call the LLM
        const output = await graphApp.invoke({ messages: [{ role: "user", content: data.message }] }, config);
        // The output contains all messages in the state.
        // This will log the last message in the conversation.
        const lastMessage = output.messages[output.messages.length - 1];
        console.log(lastMessage.content);

        //const response = await llm.invoke([{ role: "user", content: data.message }]);

        // Broadcast the message only to the specific room
        if (data.room) {
            io.to(data.room).emit('chat', { 
                user: "AI", 
                message: lastMessage.content,
                room: data.room
            });
        }

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