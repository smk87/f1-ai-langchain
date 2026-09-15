import { DataAPIClient } from '@datastax/astra-db-ts';
import { loadEnvConfig } from '@next/env';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { MistralAI } from '@langchain/mistralai';
import { BaseMessageLike } from '@langchain/core/messages';

loadEnvConfig(process.cwd());

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    MISTRAL_API_KEY,
} = process.env;

// Instantiate the llm and vector db
const mistral = new MistralAIEmbeddings({
    apiKey: MISTRAL_API_KEY,
});
const mistralChat = new MistralAI({
    apiKey: MISTRAL_API_KEY,
});
const client = new DataAPIClient({
    dbOptions: {
        token: ASTRA_DB_APPLICATION_TOKEN,
    },
});
const db = client.db(String(ASTRA_DB_API_ENDPOINT), {
    keyspace: ASTRA_DB_NAMESPACE,
});

export async function POST(req: Request) {
    let docContext = '';

    try {
        const { messages } = await req.json();
        const latestMessage = messages[messages.length - 1];

        // Find the vector and get the context related to user input
        const embedding = await mistral.embedQuery(latestMessage.content);
        const collection = db.collection(String(ASTRA_DB_COLLECTION));
        const cursor = collection.find(
            {},
            {
                sort: {
                    $vector: embedding,
                },
                limit: 50,
            },
        );
        const documents = await cursor.toArray();
        docContext = JSON.stringify(documents?.map((doc) => doc.text));

        // Create the prompt template with the context
        const template: BaseMessageLike = {
            role: 'system',
            content: `You are an AI Assistant for F1 fans. You are able to answer questions about the latest F1 news, drivers, teams, and circuits. You are also able to answer questions about the history of F1. If context doesn't provide the answer, you should answer based on your knowledge. And don't mention your source of information or what the context does or doesn't include.
        
            For response use markdown where applicable.

            -- Context --
            ${docContext}
            -- Context --

            -- Question --
            ${latestMessage.content}
            -- Question --
        `,
        };

        // Stream the response from the LLM
        const stream = await mistralChat.stream([template, ...messages], {
            signal: req.signal,
        });
        const encoder = new TextEncoder();

        return new Response(
            new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of stream) {
                            controller.enqueue(encoder.encode(chunk));
                        }

                        controller.close();
                    } catch (error) {
                        controller.error(error);
                    }
                },
            }),
            {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-cache',
                },
            },
        );
    } catch (error) {
        return Response.json({ error: error }, { status: 500 });
    }
}
