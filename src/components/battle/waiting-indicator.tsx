export function WaitingIndicator({ text, className = "py-6" }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-4 text-center ${className}`}>
      <span
        aria-hidden
        className="h-4 w-4 rounded-full bg-[var(--scan)]"
        style={{ animation: "blink 1.6s ease-in-out infinite" }}
      />
      <p className="readout text-sm font-bold text-[var(--foreground)]">{text}</p>
    </div>
  );
}
