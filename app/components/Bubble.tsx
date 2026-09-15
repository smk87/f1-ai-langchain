import { UIMessage } from 'ai';

export type Message = UIMessage & {};

export const Bubble = ({ message }: { message: Message }) => {
    const textPart = message.parts.find((part) => part.type === 'text');
    const isUser = message.role === 'user';

    return isUser ? (
        <div className="text-white p-4 bg-purple-400 rounded-xl rounded-br-none w-fit ml-auto">
            {textPart?.text ?? ''}
        </div>
    ) : (
        <div className="text-white p-4 bg-purple-700 rounded-xl rounded-bl-none w-fit mr-auto">
            {textPart?.text ?? ''}
        </div>
    );
};
