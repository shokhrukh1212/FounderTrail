import { permanentRedirect } from "next/navigation";

export default function RetiredLeaderboardsPage() {
  permanentRedirect("/?view=discover#products");
}
