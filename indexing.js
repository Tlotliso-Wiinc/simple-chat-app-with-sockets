import { OpenAIEmbeddings } from "@langchain/openai";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
/*
const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY
});
*/

//console.log(embeddings);

/*
// Create a vector store
const vectorStore = new MemoryVectorStore(embeddings);

// Add the documents to the vector store
await vectorStore.addDocuments(allSplits);
*/