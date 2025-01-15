import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0
});

const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large"
});

const vectorStore = new MemoryVectorStore(embeddings);