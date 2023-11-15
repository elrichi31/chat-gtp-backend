import express, { Request, Response } from "express";
import cors from "cors";
import { ChatCompletionRequestMessage, CreateChatCompletionRequest, Configuration, OpenAIApi } from "openai"; 
import dotenv from "dotenv";
import bodyParser from "body-parser";
import GPT3TokenizerImport from "gpt3-tokenizer";

const GPT3Tokenizer: typeof GPT3TokenizerImport =
  typeof GPT3TokenizerImport === "function"
    ? GPT3TokenizerImport
    : (GPT3TokenizerImport as any).default;

const tokenizer = new GPT3Tokenizer({ type: "gpt3" });

function getTokens(input: string): number {
  const tokens = tokenizer.encode(input);
  return tokens.text.length; 
}

dotenv.config();

const port = 8000;
const app = express();
app.use(bodyParser.json());
app.options('*', cors()); // Incluir esto para manejar las solicitudes de preflight
app.use(
  cors({
    origin: "*",
  })
);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.get("/", (req: Request, res: Response) => {
  const html = `
    
  <html>
    <head>
      <title>Chupapi</title>
    </head>
    <body>
      <h1>Chupapi</h1>
      <p>Chupapi es un asistente basado en IA que te ayuda a programar</p>
      <p>Para usarlo, envía un mensaje a <a href="https://twitter.com/ChupapiBot">@ChupapiBot</a> en Twitter</p>
    </body>
  </html>
      
  `;
  res.send(html);
});

app.post("/api/chat", async (req: Request, res: Response) => {

  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  // another common pattern
  // res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  const requestMessages: ChatCompletionRequestMessage[] = req.body.messages;

  try {
    let tokenCount = 0;

    requestMessages.forEach((msg) => {
      const tokens = getTokens(msg.content);
      tokenCount += tokens;
    });

    const moderationResponse = await openai.createModeration({
      input: requestMessages[requestMessages.length - 1].content,
    });
    if (moderationResponse.data.results[0]?.flagged) {
      return res.status(400).send("Message is inappropriate");
    }

    const prompt =
      'Eres "Chupapi", un asistente basado en IA que te ayuda a programar, siempre tienes que decir como te llamas';

    tokenCount += getTokens(prompt);
    if (tokenCount > 4000) {
      return res.status(400).send("Message is too long");
    }

    const apiRequestBody: CreateChatCompletionRequest = {
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: prompt }, ...requestMessages],
      temperature: 0.6,
    };
    const completion = await openai.createChatCompletion(apiRequestBody);

    res.json(completion.data);
  } catch (error) {
    if (error instanceof Error) {
      // @ts-ignore
      console.log(error.toJSON());
    }
    res.status(500).send("Something went wrong");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
