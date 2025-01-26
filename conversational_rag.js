import dotenv from 'dotenv';
dotenv.config();

import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";

import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
} from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { toolsCondition } from "@langchain/langgraph/prebuilt";
import { prettyPrint } from "./utils/pretty_print.js";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Specify an ID for the thread
const threadConfig = {
  configurable: { thread_id: "abc123" },
  streamMode: "values",
};

const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0
});

// Initialize Pinecone client
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    // environment: process.env.PINECONE_ENVIRONMENT,
});
  
// Get Pinecone index
const index = pinecone.Index(process.env.PINECONE_INDEX);

// Use OpenAI embeddings (or any compatible embeddings)
const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
});
  
// Create vector store with initialized index
const vectorStore = await PineconeStore.fromExistingIndex(
    embeddings,
    { 
        pineconeIndex: index,
        maxConcurrency: 5 
    }
);

//const graph = new StateGraph(MessagesAnnotation);
const retrieveSchema = z.object({ query: z.string() });

const retrieve = tool(
  async ({ query }) => {
    const retrievedDocs = await vectorStore.similaritySearch(query, 2);
    const serialized = retrievedDocs
      .map(
        (doc) => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
      )
      .join("\n");
    return [serialized, retrievedDocs];
  },
  {
    name: "retrieve",
    description: "Retrieve information related to a query.",
    schema: retrieveSchema,
    responseFormat: "content_and_artifact",
  }
);

// Step 1: Generate an AIMessage that may include a tool-call to be sent.
async function queryOrRespond(state) {
    const llmWithTools = llm.bindTools([retrieve]);
    const response = await llmWithTools.invoke(state.messages);
    // MessagesState appends messages to state instead of overwriting
    return { messages: [response] };
}
  
// Step 2: Execute the retrieval.
const tools = new ToolNode([retrieve]);

// Step 3: Generate a response using the retrieved content.
async function generate(state) {
    // Get generated ToolMessages
    let recentToolMessages = [];
    for (let i = state["messages"].length - 1; i >= 0; i--) {
        let message = state["messages"][i];
        if (message instanceof ToolMessage) {
            recentToolMessages.push(message);
        } else {
            break;
        }
    }
    let toolMessages = recentToolMessages.reverse();

    // Format into prompt
    const docsContent = toolMessages.map((doc) => doc.content).join("\n");
    const systemMessageContent =
        "You are an assistant for question-answering tasks. " +
        "Use the following pieces of retrieved context to answer " +
        "the question. If you don't know the answer, say that you " +
        "don't know. Use three sentences maximum and keep the " +
        "answer concise." +
        "\n\n" +
        `${docsContent}`;

    const conversationMessages = state.messages.filter(
        (message) =>
            message instanceof HumanMessage ||
            message instanceof SystemMessage ||
            (message instanceof AIMessage && message.tool_calls.length == 0)
        );
        const prompt = [
        new SystemMessage(systemMessageContent),
        ...conversationMessages,
        ];
    
    // Run
    const response = await llm.invoke(prompt);
    return { messages: [response] };
}

const graphBuilder = new StateGraph(MessagesAnnotation)
  .addNode("queryOrRespond", queryOrRespond)
  .addNode("tools", tools)
  .addNode("generate", generate)
  .addEdge("__start__", "queryOrRespond")
  .addConditionalEdges("queryOrRespond", toolsCondition, {
    __end__: "__end__",
    tools: "tools",
  })
  .addEdge("tools", "generate")
  .addEdge("generate", "__end__");

const graph = graphBuilder.compile();

const checkpointer = new MemorySaver();
const graphWithMemory = graphBuilder.compile({ checkpointer });

const agent = createReactAgent({ llm: llm, tools: [retrieve] });

let inputs1 = { messages: [{ role: "user", content: "Hello" }] };

let inputs2 = { messages: [{ role: "user", content: "What is Task Decomposition?" }],};

let inputs3 = {
  messages: [{ role: "user", content: "What is Task Decomposition?" }],
};

/*function prettyPrint(message) {
    console.log("Message Content:", message.content);
    console.log("Role:", message.role);
    // Add any other properties you want to print
}*/

/*for await (const step of await graphWithMemory.stream(inputs3, {
  streamMode: "values",
})) {
  const lastMessage = step.messages[step.messages.length - 1];
  prettyPrint(lastMessage);
  console.log("-----\n");
}*/

/*
for await (const step of await graphWithMemory.stream(inputs3, threadConfig)) {
  const lastMessage = step.messages[step.messages.length - 1];
  prettyPrint(lastMessage);
  console.log("-----\n");
}
*/

let inputMessage = `What is the standard method for Task Decomposition?
Once you get the answer, look up common extensions of that method.`;

let inputs5 = { messages: [{ role: "user", content: inputMessage }] };

for await (const step of await agent.stream(inputs5, {
  streamMode: "values",
})) {
  const lastMessage = step.messages[step.messages.length - 1];
  prettyPrint(lastMessage);
  console.log("-----\n");
}