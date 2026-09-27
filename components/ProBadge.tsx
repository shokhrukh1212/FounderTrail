const PRO_BADGE_EXPLANATION = "Pro plan · The founder bought FounderTrail Pro (launch kit and results summary). Not identity or revenue verification.";

/**
 * The one Pro badge: a gold seal right after the startup's name. It is rendered from a
 * real active entitlement by its callers. It carries a star, never a tick, and its label
 * says plainly that Pro is a paid plan so it is never read as a verification mark —
 * ownership verification has its own separate badge.
 *
 * Every copy defines the same gradient under one id, so whichever the browser resolves
 * paints identically.
 */
export function ProBadge() {
  return <span className="pro-badge" tabIndex={0} role="img" aria-label={PRO_BADGE_EXPLANATION}>
    <svg className="pro-badge-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ft-pro-badge-fill" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD35C" />
          <stop offset=".55" stopColor="#FF9A3D" />
          <stop offset="1" stopColor="#FF6154" />
        </linearGradient>
      </defs>
      <path fill="url(#ft-pro-badge-fill)" stroke="url(#ft-pro-badge-fill)" strokeWidth="1.2" strokeLinejoin="round" d="M12 1L14.48 2.73L17.5 2.47L18.79 5.21L21.53 6.5L21.27 9.52L23 12L21.27 14.48L21.53 17.5L18.79 18.79L17.5 21.53L14.48 21.27L12 23L9.52 21.27L6.5 21.53L5.21 18.79L2.47 17.5L2.73 14.48L1 12L2.73 9.52L2.47 6.5L5.21 5.21L6.5 2.47L9.52 2.73Z" />
      <path fill="#fff" stroke="#fff" strokeWidth=".8" strokeLinejoin="round" d="M12 7L13.38 10.5L17.14 10.73L14.23 13.13L15.17 16.77L12 14.75L8.83 16.77L9.77 13.13L6.86 10.73L10.62 10.5Z" />
    </svg>
    <span className="pro-badge-tooltip" aria-hidden="true">{PRO_BADGE_EXPLANATION}</span>
  </span>;
}
