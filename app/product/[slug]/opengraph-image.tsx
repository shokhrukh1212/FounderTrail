import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { getProductDetail } from "@/lib/product-data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProductOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  const name = product?.name ?? "Startup";
  const tagline = product?.tagline ?? "Discover what founders build next.";
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", background: "#fffdfa", color: "#182230", fontFamily: "Arial, sans-serif" }}><div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 30, fontWeight: 700 }}><span style={{ width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 13, background: "#ff6154", color: "white" }}>F</span>{brand.displayName}</div><div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1000px" }}><div style={{ fontSize: 72, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-3px" }}>{name}</div><div style={{ fontSize: 32, lineHeight: 1.3, color: "#5f6b7a" }}>{tagline}</div></div><div style={{ display: "flex", fontSize: 24, color: "#ff6154", fontWeight: 700 }}>Follow what they build next.</div></div>, size);
}
