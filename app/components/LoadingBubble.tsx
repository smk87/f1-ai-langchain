export const LoadingBubble = ({ className }: { className?: string }) => {
    return (
        <div
            className={`flex items-center justify-start mb-2 gap-1 ${className} py-2 m-0`}
        >
            <div className="h-4 w-4 rounded-full bg-purple-700 animate-[pulse_1.5s_ease-in-out_infinite]" />
            <div className="h-4 w-4 rounded-full bg-purple-700 animate-[pulse_1.5s_ease-in-out_0.3s_infinite]" />
            <div className="h-4 w-4 rounded-full bg-purple-700 animate-[pulse_1.5s_ease-in-out_0.6s_infinite]" />
        </div>
    );
};
