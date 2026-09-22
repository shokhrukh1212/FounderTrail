import Image from "next/image";

/**
 * The FounderTrail mark. Every brand surface — this header logo, the tab icon
 * (app/icon.png), the home-screen icon (app/apple-icon.png), product share images and the
 * launch-kit pill — is derived from public/logo.png. Regenerate them together when it
 * changes.
 */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return <Image src="/brand/logo-256.png" alt="" aria-hidden="true" width={34} height={34} className={className} priority />;
}
