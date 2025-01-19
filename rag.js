import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { Annotation } from "@langchain/langgraph";
import { concat } from "@langchain/core/utils/stream";
import { StateGraph } from "@langchain/langgraph";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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



const promptTemplate = await pull("rlm/rag-prompt");

// Example:
const example_prompt = await promptTemplate.invoke({
  context: "(context goes here)",
  question: "(question goes here)",
});

const example_messages = example_prompt.messages;
console.log(example_messages);

console.assert(example_messages.length === 1);
// console.log(example_messages[0].content);

const InputStateAnnotation = Annotation.Root({
  question: Annotation,
});

const StateAnnotation = Annotation.Root({
  question: Annotation,
  context: Annotation,
  answer: Annotation,
});


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

const retrieve = async (state) => {
  const retrievedDocs = await vectorStore.similaritySearch(state.question);
  return { context: retrievedDocs };
};

const generate = async (state) => {
  const docsContent = state.context.map((doc) => doc.pageContent).join("\n");
  const messages = await promptTemplate.invoke({
    question: state.question,
    context: docsContent,
  });
  const response = await llm.invoke(messages);
  return { answer: response.content };
};

const graph = new StateGraph(StateAnnotation)
  .addNode("retrieve", retrieve)
  .addNode("generate", generate)
  .addEdge("__start__", "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", "__end__")
  .compile();

let inputs = { question: "What is Task Decomposition?" };

const result = await graph.invoke(inputs);
console.log(result.context.slice(0, 2));
console.log(`\nAnswer: ${result["answer"]}`);