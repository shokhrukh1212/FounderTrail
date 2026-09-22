import { permanentRedirect } from "next/navigation";

/** Common alternative URL, e.g. as entered on an OAuth consent screen. */
export default function PrivacyPolicyAlias() {
  permanentRedirect("/privacy");
}
