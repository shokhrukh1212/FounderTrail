import { config } from "@/lib/config";

/** The contact line on the legal pages. The address comes from SUPPORT_EMAIL. */
export function LegalContact({ topic }: { topic: "privacy" | "terms" }) {
  const subject = topic === "privacy" ? "Privacy question" : "Terms question";
  return config.supportEmail
    ? <p>Questions or requests? Email <a href={`mailto:${config.supportEmail}?subject=${encodeURIComponent(subject)}`}>{config.supportEmail}</a>.</p>
    : <p>Questions or requests? Reply to any email you have received from {config.siteName} and we will get back to you.</p>;
}
