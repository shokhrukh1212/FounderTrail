export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <rect x="4" y="4" width="40" height="40" rx="11" fill="currentColor" />
      <path d="M14 31.5h7.2V19.7H14l10-8.2 10 8.2h-7.2v11.8H34L24 39.5 14 31.5Z" fill="white" />
      <path d="M14 31.5h7.2V25h5.6v6.5H34L24 39.5 14 31.5Z" fill="#FF6154" />
    </svg>
  );
}
