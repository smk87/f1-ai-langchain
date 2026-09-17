'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport, UIMessage } from 'ai';
import { Bubble } from './components/Bubble';
import { useMemo, useState } from 'react';
import { LoadingBubble } from './components/LoadingBubble';

export type Message = {
    role: UIMessage['role'];
    content: string;
};

export default function Home() {
    const [input, setInput] = useState('');
    const transport = useMemo(
        () =>
            new TextStreamChatTransport({
                api: '/api/chat',
                prepareSendMessagesRequest: ({ messages }) => ({
                    body: {
                        messages: messages.map(
                            (message) =>
                                ({
                                    role: message.role,
                                    content:
                                        message.parts.find(
                                            (part) => part.type === 'text',
                                        )?.text ?? '',
                                }) satisfies Message,
                        ),
                    },
                }),
            }),
        [],
    );
    const { messages, sendMessage, status } = useChat({
        transport,
    });

    const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        const text = input.trim();
        if (!text || status !== 'ready') return;

        sendMessage({ text });
        setInput('');
    };

    const isLoading = status === 'submitted' || status === 'streaming';

    return (
        <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-purple-950">
            <main className="flex flex-1 w-full max-w-3xl flex-col py-32 px-16 dark:bg-purple-950 sm:items-start">
                <h1 className="text-2xl font-bold text-amber-50 mx-auto mb-4 flex-none">
                    F1 AI Assistant
                </h1>
                <div className="flex flex-1 flex-col w-full max-w-3xl justify-between bg-gray-200 border-3 rounded-xl border-purple-500 p-4">
                    {/* Chat messages */}
                    <div className="flex flex-1 flex-col gap-4 basis-[50vh] overflow-y-auto mb-auto">
                        {messages.map((message) => (
                            <Bubble key={message.id} message={message} />
                        ))}
                    </div>

                    <LoadingBubble
                        className={isLoading ? 'visible:' : 'invisible'}
                    />

                    <hr className="mb-1 w-full border-purple-700" />

                    {/* User prompt input */}
                    <form className="flex w-full" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            className="question-box flex-1 h-10 px-4 py-2 text-black outline-none"
                            placeholder="Ask me anything related to F1..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <button
                            className={`${
                                isLoading
                                    ? 'bg-purple-300 text-purple-700'
                                    : 'bg-purple-700 text-white'
                            } px-4 py-2 rounded-md h-10`}
                            type="submit"
                            disabled={isLoading}
                        >
                            Send
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
