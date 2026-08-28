import { redirect } from "next/navigation";

export default async function LegacyIntegrationPage({ params }: PageProps<"/manage/[slug]/integration">) {
  const { slug } = await params;
  redirect(`/manage/${encodeURIComponent(slug)}?tab=verification`);
}
