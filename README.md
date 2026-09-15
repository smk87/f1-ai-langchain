# F1 AI Assistant

A streaming Formula 1 chatbot built with **Next.js**, **LangChain**, **Mistral AI**, and **DataStax Astra DB**. Ask questions about drivers, teams, circuits, and F1 history — answers are grounded in scraped web content stored as vector embeddings.

## RAG in Action

Same question, two different outcomes — with and without retrieved context from Astra DB:

| With RAG context | Without RAG context |
| :---: | :---: |
| ![With RAG context](./public/readme/with-rag.png) | ![Without RAG context](./public/readme/without-rag.png) |
| Retrieves relevant F1 documents from Astra DB before generating a response | Skips vector search and answers from the model's general knowledge only |

## Features

- **RAG-powered answers** — retrieves relevant F1 context from Astra DB before generating a response
- **Streaming UI** — assistant replies appear token-by-token via the Vercel AI SDK
- **Automated knowledge base** — seed script scrapes public F1 sources, chunks text, embeds with Mistral, and loads vectors into Astra
- **Simple chat interface** — user and assistant message bubbles with a loading indicator

## Tech Stack

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| Frontend         | Next.js 16, React 19, Tailwind CSS 4            |
| Chat UI          | `@ai-sdk/react`, `ai` (TextStreamChatTransport) |
| LLM & Embeddings | LangChain, `@langchain/mistralai`               |
| Vector DB        | DataStax Astra DB (`@datastax/astra-db-ts`)     |
| Scraping         | Playwright                                      |

## How It Works

```mermaid
flowchart LR
    User[User] --> UI[Next.js Chat UI]
    UI -->|POST /api/chat| API[Chat API Route]
    API -->|embed query| MistralEmb[Mistral Embeddings]
    MistralEmb -->|vector search| Astra[(Astra DB)]
    Astra -->|top 50 chunks| API
    API -->|prompt + context| MistralLLM[Mistral LLM]
    MistralLLM -->|text stream| UI
```

1. The user sends a message from the chat UI.
2. The API embeds the latest message with Mistral.
3. Astra DB returns the 50 most similar document chunks.
4. Those chunks are injected into a system prompt alongside the conversation history.
5. Mistral streams the response back as plain text, which the UI renders live.

## Prerequisites

- **Node.js** 20+
- **Mistral AI** API key — [console.mistral.ai](https://console.mistral.ai/)
- **DataStax Astra DB** — [astra.datastax.com](https://astra.datastax.com/)
    - A database with Serverless Vector Search enabled
    - An application token with read/write access
- **Playwright Chromium** (for the seed script)

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo-url>
cd f1-ai-langchain
yarn install
# or: npm install
```

Install the Playwright browser used by the scraper:

```bash
npx playwright install chromium
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Mistral AI
MISTRAL_API_KEY=your_mistral_api_key

# DataStax Astra DB
ASTRA_DB_API_ENDPOINT=https://<database-id>-<region>.apps.astra.datastax.com
ASTRA_DB_APPLICATION_TOKEN=AstraCS:...
ASTRA_DB_NAMESPACE=default_keyspace
ASTRA_DB_COLLECTION=f1_docs
```

| Variable                     | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| `MISTRAL_API_KEY`            | API key for Mistral chat and embedding models         |
| `ASTRA_DB_API_ENDPOINT`      | Astra DB API endpoint URL for your database           |
| `ASTRA_DB_APPLICATION_TOKEN` | Application token with access to the database         |
| `ASTRA_DB_NAMESPACE`         | Astra keyspace / namespace (often `default_keyspace`) |
| `ASTRA_DB_COLLECTION`        | Collection name for storing F1 document vectors       |

### 3. Seed the vector database

The seed script creates the collection, scrapes F1 content, splits it into chunks, generates embeddings, and inserts them into Astra DB.

Default sources scraped by `scripts/loadDB.ts`:

- [Formula One (Wikipedia)](https://en.wikipedia.org/wiki/Formula_One)
- [List of F1 World Drivers' Champions (Wikipedia)](https://en.wikipedia.org/wiki/List_of_Formula_One_World_Drivers%27_Champions)
- [BBC Sport F1 article](https://www.bbc.com/sport/formula1/articles/c5yeln1j175o)

```bash
yarn seed
# or: npm run seed
```

> **Note:** The seed script calls `createCollection` before inserting data. If the collection already exists, you may need to delete it in the Astra UI or adjust the script before re-running.

Embedding requests are batched (64 chunks) with automatic retry on rate limits.

### 4. Run the development server

```bash
yarn dev
# or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start chatting.

## Scripts

| Command      | Description                                            |
| ------------ | ------------------------------------------------------ |
| `yarn dev`   | Start the Next.js development server                   |
| `yarn build` | Create a production build                              |
| `yarn start` | Run the production server                              |
| `yarn lint`  | Run ESLint                                             |
| `yarn seed`  | Scrape F1 pages, embed content, and load into Astra DB |

## Project Structure

```
f1-ai-langchain/
├── app/
│   ├── api/chat/route.ts    # RAG + streaming chat endpoint
│   ├── components/
│   │   ├── Bubble.tsx       # User / assistant message bubbles
│   │   └── LoadingBubble.tsx
│   ├── layout.tsx
│   ├── page.tsx             # Chat UI (useChat + TextStreamChatTransport)
│   └── globals.css
├── scripts/
│   └── loadDB.ts            # Scrape, chunk, embed, and seed Astra DB
├── public/
│   └── readme/              # README screenshots (with/without RAG)
├── package.json
└── README.md
```

## API

### `POST /api/chat`

Accepts a JSON body with a LangChain-style message array:

```json
{
    "messages": [
        { "role": "user", "content": "Who won the 2023 F1 championship?" }
    ]
}
```

Returns a **streaming plain-text** response (`Content-Type: text/plain`) compatible with `TextStreamChatTransport`.

## Customization

- **Add data sources** — edit the `DATA_SOURCES` array in `scripts/loadDB.ts`, then re-run `yarn seed`.
- **Chunk size** — adjust `chunkSize` and `chunkOverlap` in the `RecursiveCharacterTextSplitter` config inside `scripts/loadDB.ts`.
- **Retrieval count** — change the `limit` in the vector search inside `app/api/chat/route.ts`.
- **System prompt** — modify the F1 assistant template in `app/api/chat/route.ts`.

## License

Private project.
