import { redirect } from "next/navigation";

export default async function RetiredMetricsPage({ params }: PageProps<"/manage/[slug]/metrics">) {
  const { slug } = await params;
  redirect(`/manage/${slug}?tab=verification`);
}
