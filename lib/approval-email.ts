import "server-only";
import { Resend } from "resend";
import { approvalAccessToken, approvalManagementUrl } from "./approval-access";
import { config } from "./config";
import { query, withTransaction } from "./db";
import { canonicalProductUrl, xLaunchIntent } from "./product-share";

const APPROVAL_EMAIL_SIGNER = "Shokhrukh Karimov";

export type ApprovalEmailResult = {
  status: "sent" | "already_sent" | "in_progress" | "failed" | "skipped";
  sentAt: string | null;
  providerId: string | null;
  warning?: string;
};

type ApprovalEmailProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  founder_name: string | null;
  contact_email: string;
  approved_at: Date;
  token_version: number;
  approval_email_status: string;
  approval_email_last_attempt_at: Date | null;
  approval_email_sent_at: Date | null;
  approval_email_provider_id: string | null;
  has_logo: boolean;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function approvalEmailContent(product: ApprovalEmailProduct) {
  const publicUrl = canonicalProductUrl(config.siteUrl, product.slug);
  const shareUrl = xLaunchIntent({ siteUrl: config.siteUrl, slug: product.slug, productName: product.name, description: product.tagline });
  const accessToken = approvalAccessToken({ productId: product.id, approvedAt: product.approved_at, tokenVersion: product.token_version }, config.eventHashSalt);
  const managementUrl = approvalManagementUrl(config.siteUrl, product.slug, accessToken);
  const greeting = product.founder_name?.trim() || "there";
  const logoUrl = product.has_logo ? `${config.siteUrl}/api/products/${encodeURIComponent(product.slug)}/logo` : null;
  const button = (label: string, href: string, primary = false) => `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 10px 0;padding:13px 18px;border-radius:9px;border:1px solid ${primary ? "#ff6154" : "#e5e7eb"};background:${primary ? "#ff6154" : "#ffffff"};color:${primary ? "#ffffff" : "#1f2937"};font-weight:700;text-decoration:none">${escapeHtml(label)}</a>`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:560px){.wrap{padding:18px!important}.card{padding:24px 18px!important}.actions a{display:block!important;margin-right:0!important;text-align:center!important}}</style></head><body style="margin:0;background:#f7f7f8;color:#1f2937;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div class="wrap" style="padding:32px 16px"><div class="card" style="max-width:620px;margin:0 auto;padding:36px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff"><div style="margin-bottom:28px;font-size:20px;font-weight:800">BidIndex</div>${logoUrl ? `<img src="${escapeHtml(logoUrl)}" width="64" height="64" alt="${escapeHtml(product.name)} logo" style="display:block;width:64px;height:64px;margin-bottom:20px;border-radius:13px;object-fit:cover">` : ""}<h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">${escapeHtml(product.name)} is now live 🚀</h1><p style="margin:0 0 16px;color:#667085;line-height:1.65">Hi ${escapeHtml(greeting)},</p><p style="margin:0 0 22px;color:#667085;line-height:1.65">Your product has been approved and is now live on BidIndex.</p><div class="actions">${button("View your product", publicUrl)}${button("Share on X", shareUrl, true)}</div><p style="margin:18px 0 12px;color:#667085;line-height:1.65">Want more people to discover it? Share the launch with your audience.</p><p style="margin:0 0 22px;color:#667085;line-height:1.65">You can continue managing your listing, publishing updates and connecting verified data here:</p>${button("Manage product", managementUrl)}<p style="margin:28px 0 0;color:#667085;line-height:1.6">— ${escapeHtml(APPROVAL_EMAIL_SIGNER)}<br><strong style="color:#1f2937">BidIndex</strong></p></div></div></body></html>`;
  const text = `Hi ${greeting},\n\nYour product has been approved and is now live on BidIndex.\n\nView your listing:\n${publicUrl}\n\nWant more people to discover it? Share the launch with your audience.\n\nShare on X:\n${shareUrl}\n\nYou can continue managing your listing, publishing updates and connecting verified data here:\n${managementUrl}\n\n— ${APPROVAL_EMAIL_SIGNER}\nBidIndex`;
  return { publicUrl, shareUrl, managementUrl, html, text };
}

function safeFailureCode(error: unknown): string {
  if (!error || typeof error !== "object") return "provider_error";
  const candidate = error as { name?: unknown; statusCode?: unknown };
  const name = typeof candidate.name === "string" && /^[a-z0-9_-]{1,80}$/i.test(candidate.name) ? candidate.name : "provider_error";
  const status = typeof candidate.statusCode === "number" ? `:${candidate.statusCode}` : "";
  return `${name}${status}`.slice(0, 120);
}

async function markFailed(productId: string, code: string) {
  await query(`UPDATE products SET approval_email_status='failed',approval_email_last_failure=$2,updated_at=now() WHERE id=$1::uuid AND approval_email_sent_at IS NULL`, [productId, code]);
  console.error("approval email failed", { productId, code });
}

export async function sendApprovalEmail(productId: string, options: { allowSkipped?: boolean } = {}): Promise<ApprovalEmailResult> {
  const claimed = await withTransaction(async (client) => {
    const result = await client.query<ApprovalEmailProduct>(
      `SELECT p.id::text,p.slug,p.name,p.tagline,p.founder_name,p.contact_email,p.approved_at,
              o.token_version,p.approval_email_status,p.approval_email_last_attempt_at,
              p.approval_email_sent_at,p.approval_email_provider_id,
              (EXISTS (SELECT 1 FROM product_media pm WHERE pm.product_id=p.id AND pm.kind='logo')
               OR EXISTS (SELECT 1 FROM product_submission_metadata sm WHERE sm.product_id=p.id AND sm.extracted_logo_url IS NOT NULL)) AS has_logo
         FROM products p JOIN product_owner_credentials o ON o.product_id=p.id
        WHERE p.id=$1::uuid AND p.status='published' AND p.approved_at IS NOT NULL FOR UPDATE`,
      [productId],
    );
    const product = result.rows[0];
    if (!product) return { kind: "skipped" as const };
    if (product.approval_email_sent_at || product.approval_email_status === "sent") return { kind: "sent" as const, product };
    if (product.approval_email_status === "skipped" && !options.allowSkipped) return { kind: "skipped" as const };
    const recentAttempt = product.approval_email_last_attempt_at && Date.now() - new Date(product.approval_email_last_attempt_at).getTime() < 5 * 60_000;
    if (product.approval_email_status === "sending" && recentAttempt) return { kind: "sending" as const };
    await client.query(`UPDATE products SET approval_email_status='sending',approval_email_last_attempt_at=now(),approval_email_last_failure=NULL,updated_at=now() WHERE id=$1::uuid`, [productId]);
    return { kind: "claimed" as const, product };
  });

  if (claimed.kind === "skipped") return { status: "skipped", sentAt: null, providerId: null };
  if (claimed.kind === "sending") return { status: "in_progress", sentAt: null, providerId: null };
  if (claimed.kind === "sent") return { status: "already_sent", sentAt: claimed.product.approval_email_sent_at?.toISOString() ?? null, providerId: claimed.product.approval_email_provider_id };
  const product = claimed.product;
  if (!config.email.resendApiKey || !config.email.from) {
    await markFailed(product.id, "email_not_configured");
    return { status: "failed", sentAt: null, providerId: null, warning: "Product published, but approval email is not configured." };
  }

  const content = approvalEmailContent(product);
  const idempotencyKey = `product-approved:${product.id}:${product.approved_at.toISOString()}`;
  try {
    const resend = new Resend(config.email.resendApiKey);
    const { data, error } = await resend.emails.send({
      from: config.email.from,
      to: product.contact_email,
      subject: `${product.name} is now live on BidIndex 🚀`,
      html: content.html,
      text: content.text,
      ...(config.email.replyTo ? { replyTo: config.email.replyTo } : {}),
    }, { idempotencyKey });
    if (error || !data?.id) throw error ?? new Error("missing_provider_id");
    const sentAt = new Date();
    await query(`UPDATE products SET approval_email_status='sent',approval_email_sent_at=$2,approval_email_provider_id=$3,approval_email_last_failure=NULL,updated_at=now() WHERE id=$1::uuid`, [product.id, sentAt, data.id]);
    return { status: "sent", sentAt: sentAt.toISOString(), providerId: data.id };
  } catch (error) {
    const code = safeFailureCode(error);
    await markFailed(product.id, code);
    return { status: "failed", sentAt: null, providerId: null, warning: "Product published, but the approval email was not sent." };
  }
}
