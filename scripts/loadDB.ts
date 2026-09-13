import { DataAPIClient } from '@datastax/astra-db-ts';
import { loadEnvConfig } from '@next/env';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { validateSafeUrl } from '@langchain/core/utils/ssrf';
import { type Browser, chromium } from 'playwright';

loadEnvConfig(process.cwd());

type SimilarityMetric = 'cosine' | 'euclidean' | 'dot_product';

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    MISTRAL_API_KEY,
} = process.env;

const DATA_SOURCES = ['https://en.wikipedia.org/wiki/Formula_One'];
const EMBEDDING_BATCH_SIZE = 64;
const MAX_EMBEDDING_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 2000;

// Instantiate the llm and vector db
const mistral = new MistralAIEmbeddings({
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

// Instantiate the text splitter
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createEmbeddingsWithRetry = async (inputs: string[]) => {
    for (let attempt = 0; attempt < MAX_EMBEDDING_RETRIES; attempt++) {
        try {
            return await mistral.embedDocuments(inputs);
        } catch (error) {
            const statusCode =
                error &&
                typeof error === 'object' &&
                'statusCode' in error &&
                typeof error.statusCode === 'number'
                    ? error.statusCode
                    : undefined;

            if (statusCode === 429 && attempt < MAX_EMBEDDING_RETRIES - 1) {
                const delay = BASE_RETRY_DELAY_MS * 2 ** attempt;
                console.warn(
                    `Rate limited (429). Retrying batch in ${delay}ms...`,
                );
                await sleep(delay);
                continue;
            }

            throw error;
        }
    }

    throw new Error('Failed to create embeddings after retries');
};

const createCollection = async (similarityMetric?: SimilarityMetric) => {
    const response = await db.createCollection(String(ASTRA_DB_COLLECTION), {
        vector: {
            dimension: 1024,
            metric: similarityMetric,
        },
    });

    console.log(response);
};

const loadSampleData = async () => {
    const collection = await db.collection(String(ASTRA_DB_COLLECTION));
    const browser = await chromium.launch({ headless: true });

    try {
        for await (const url of DATA_SOURCES) {
            const content = await scrapPage(url, browser);
            const chunks = await splitter.splitText(content);

            for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
                const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE); // Create a batch of chunks
                const embeddings = await createEmbeddingsWithRetry(batch); // Create embeddings for the batch
                const payload = embeddings.map((embedding, index) => ({
                    $vector: embedding,
                    text: batch[index],
                }));

                const response = await collection.insertMany(payload);

                console.log(
                    `Inserted batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)}:`,
                    response,
                );

                if (i + EMBEDDING_BATCH_SIZE < chunks.length) {
                    await sleep(500);
                }
            }
        }
    } catch (error) {
        console.error(error);
    } finally {
        await browser.close();
    }
};

const scrapPage = async (url: string, browser?: Browser) => {
    const safeUrl = validateSafeUrl(url, { allowHttp: true });
    const ownsBrowser = !browser;
    const activeBrowser =
        browser ?? (await chromium.launch({ headless: true }));

    try {
        const page = await activeBrowser.newPage();

        await page.goto(safeUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
        });
        await page
            .waitForLoadState('networkidle', { timeout: 10_000 })
            .catch(() => {});

        const pageContent = await page.evaluate(() => {
            document
                .querySelectorAll('script, style, noscript')
                .forEach((el) => el.remove());
            return (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
        });

        await page.close();

        const doc = new Document({
            pageContent,
            metadata: { source: safeUrl },
        });

        return doc.pageContent;
    } finally {
        if (ownsBrowser) {
            await activeBrowser.close();
        }
    }
};

createCollection().then(() => loadSampleData());
