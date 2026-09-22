import { permanentRedirect } from "next/navigation";

export default function RetiredFoundingPage() {
  permanentRedirect("/?view=discover#products");
}
