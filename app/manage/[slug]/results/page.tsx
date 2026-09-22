import { redirect } from "next/navigation";

/** Results are a tab of the owner workspace now; old links land on it. */
export default async function ResultsRedirect({ params }: PageProps<"/manage/[slug]/results">) {
  const { slug } = await params;
  redirect(`/manage/${encodeURIComponent(slug)}?tab=results`);
}
