import { OpenAIEmbeddings } from "@langchain/openai";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import dotenv from 'dotenv';
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";

// Load environment variables
dotenv.config();

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  // environment: process.env.PINECONE_ENVIRONMENT,
});

// Get Pinecone index
const index = pinecone.Index(process.env.PINECONE_INDEX);

// Load the document
const pTagSelector = "p";
const cheerioLoader = new CheerioWebBaseLoader(
  "https://lilianweng.github.io/posts/2023-06-23-agent/",
  {
    selector: pTagSelector,
  }
);

const docs = await cheerioLoader.load();

console.assert(docs.length === 1);
//console.log(`Total characters: ${docs[0].pageContent.length}`);
//console.log(docs[0].pageContent.slice(0, 500));

// Split the document
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
const allSplits = await splitter.splitDocuments(docs);
console.log(`Split blog post into ${allSplits.length} sub-documents.`);

// Create embeddings
const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY
});

const vector1 = await embeddings.embedQuery(allSplits[0].pageContent);
const vector2 = await embeddings.embedQuery(allSplits[1].pageContent);

console.assert(vector1.length === vector2.length);
console.log(`Generated vectors of length ${vector1.length}\n`);
console.log(vector1.slice(0, 10));

// Create vector store with initialized index
const vectorStore = await PineconeStore.fromExistingIndex(
  embeddings,
  { 
    pineconeIndex: index,
    maxConcurrency: 5 
  }
);

// Add the documents to the vector store
await vectorStore.addDocuments(allSplits);