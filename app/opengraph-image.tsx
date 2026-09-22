import { ImageResponse } from "next/og";
import { brandCopy } from "@/lib/brand";
import { config } from "@/lib/config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#fbfbfc", color: "#202938", fontFamily: "sans-serif" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 34, fontWeight: 750 }}><div style={{ width: 58, height: 58, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "#202938", color: "#ff6154" }}>●</div>{config.siteName}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}><div style={{ fontSize: 70, lineHeight: 1.06, maxWidth: 1000, fontWeight: 720 }}>{brandCopy.homepageHeadline}</div><div style={{ fontSize: 28, color: "#667085" }}>{brandCopy.homepageDescription}</div></div>
  </div>, size);
}
