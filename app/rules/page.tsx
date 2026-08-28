import { permanentRedirect } from "next/navigation";

export default function RulesPage() {
  permanentRedirect("/about#submission-guidelines");
}
