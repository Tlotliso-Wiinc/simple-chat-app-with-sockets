

import { ChatOpenAI } from "@langchain/openai";

process.env.OPENAI_API_KEY = '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';
process.env.LANGCHAIN_TRACING_V2 = "true";
process.env.LANGCHAIN_PROJECT = "simple-chat-app-with-sockets";
process.env.LANGCHAIN_ENDPOINT = "https://api.smith.langchain.com";

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0
});

const response = await llm.invoke([{ role: "user", content: "Hi im bob" }]);    
console.log(response);
