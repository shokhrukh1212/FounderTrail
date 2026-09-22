import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUserFromHeaders } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RetiredPromotePage({ params }: PageProps<"/promote/[slug]">) {
  const { slug } = await params;
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(`/manage/${slug}/pro`)}`);
  const rows = await query<{ allowed: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM products p JOIN product_owners po ON po.product_id=p.id WHERE p.slug=$1 AND po.user_id=$2) AS allowed`,
    [slug, user.id],
  );
  if (!rows[0]?.allowed) notFound();
  redirect(`/manage/${slug}/pro`);
}
