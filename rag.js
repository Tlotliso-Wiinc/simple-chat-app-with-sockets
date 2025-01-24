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
import { MessagesAnnotation } from "@langchain/langgraph";

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
//console.log(example_messages);

console.assert(example_messages.length === 1);
// console.log(example_messages[0].content);


/* Custom Prompt Template */
const template = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.
Always say "thanks for asking!" at the end of the answer.

{context}

Question: {question}

Helpful Answer:`;
const promptTemplateCustom = ChatPromptTemplate.fromMessages([
  ["user", template],
]);

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
  const messages = await promptTemplateCustom.invoke({
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

const graph2 = new StateGraph(MessagesAnnotation);

let inputs = { question: "What is Task Decomposition?" };

/*
const result = await graph.invoke(inputs);
console.log(result.context.slice(0, 2));
console.log(`\nAnswer: ${result["answer"]}`);
*/

/*
console.log(inputs);
console.log("\n====\n");
for await (const chunk of await graph.stream(inputs, {
  streamMode: "updates",
})) {
  console.log(chunk);
  console.log("\n====\n");
}
*/

const stream = await graph.stream(inputs, { streamMode: "messages" });

for await (const [message, _metadata] of stream) {
  process.stdout.write(message.content + "|");
}