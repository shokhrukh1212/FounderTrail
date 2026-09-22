import { redirect } from "next/navigation";

/** The launch kit is a tab of the owner workspace now; old links land on it. */
export default async function LaunchKitRedirect({ params }: PageProps<"/manage/[slug]/launch-kit">) {
  const { slug } = await params;
  redirect(`/manage/${encodeURIComponent(slug)}?tab=launch-kit`);
}
