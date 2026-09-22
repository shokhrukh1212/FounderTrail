import type { PlanFeature } from "@/lib/plan-features";

function FeatureIcon({ tone }: { tone: "free" | "pro" }) {
  return <span className={`plan-feature-icon is-${tone}`} aria-hidden="true">
    {tone === "pro"
      ? <svg viewBox="0 0 16 16"><path d="M8 1.5 9.6 6.1l4.9.1-3.9 3 1.4 4.7L8 11.1l-4 2.8 1.4-4.7-3.9-3 4.9-.1L8 1.5Z" /></svg>
      : <svg viewBox="0 0 16 16"><path d="M6.4 11.6 3 8.2l1.2-1.2 2.2 2.2 5.4-5.4L13 5l-6.6 6.6Z" /></svg>}
  </span>;
}

export function PlanFeatureList({ features, tone }: { features: readonly PlanFeature[]; tone: "free" | "pro" }) {
  return <ul className="plan-feature-list">
    {features.map((feature) => <li key={feature.title}>
      <FeatureIcon tone={tone} />
      <span>{feature.description ? <><strong>{feature.title}</strong> — {feature.description}</> : feature.title}</span>
    </li>)}
  </ul>;
}
