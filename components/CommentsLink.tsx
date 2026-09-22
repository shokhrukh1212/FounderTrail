import Link from "next/link";

/**
 * Deep link into a product's discussion. It is a plain link, so it works signed out,
 * works at zero comments, and the browser's own hash navigation lands on the section;
 * `.detail-section { scroll-margin-top }` keeps the sticky header from covering it.
 */
export function CommentsLink({ slug, productName, count, className = "comment-link" }: {
  slug: string;
  productName: string;
  count: number;
  className?: string;
}) {
  return <Link
    className={className}
    href={`/product/${slug}#discussion`}
    aria-label={`${count} ${count === 1 ? "comment" : "comments"} on ${productName}. Open the discussion.`}
    title={count ? `Read the discussion (${count.toLocaleString()})` : "Start the discussion"}
  >
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3c4.1 0 7 2.3 7 5.3 0 3-2.9 5.3-7 5.3-.8 0-1.5-.1-2.2-.3L4 15l.9-2.6C3.7 11.4 3 10 3 8.3 3 5.3 5.9 3 10 3Z" /></svg>
    <span>{count.toLocaleString()}</span>
  </Link>;
}
