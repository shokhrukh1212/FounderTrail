export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <rect x="4" y="4" width="40" height="40" rx="12" fill="currentColor" />
      <path d="M13 35c5.8-1.4 6.2-7.2 9.5-10.1 2.7-2.4 5.4-1.7 7.7-4.4 1.5-1.7 2.4-4.2 3-7.5" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <circle cx="13" cy="35" r="3" fill="#FF6154" />
      <circle cx="33" cy="13" r="3" fill="#FF6154" />
    </svg>
  );
}
