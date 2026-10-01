import type { PoolClient } from "pg";
/** Caller locks the product. Typed contacts are never used as identity evidence. */
export async function associateOriginalSubmitter(client: PoolClient, productId: string, userId: string) {
  const product = await client.query(`SELECT 1 FROM products p JOIN app_users u ON u.id=p.created_by_user_id WHERE p.id=$1::uuid AND p.created_by_user_id=$2 AND u.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM product_owners WHERE product_id=p.id) AND NOT EXISTS(SELECT 1 FROM product_claims WHERE product_id=p.id AND state='disputed')`, [productId,userId]);
  if (!product.rowCount) return false;
  await grantManagement(client,productId,userId,"new_submission");
  return true;
}
export async function grantManagement(client: PoolClient, productId: string, userId: string, method: "new_submission" | "verified_email") {
  await client.query(`INSERT INTO product_owners(product_id,user_id,verified_at,verification_method) VALUES($1::uuid,$2,now(),$3) ON CONFLICT DO NOTHING`, [productId,userId,method]);
  await client.query(`UPDATE product_claims SET state='claimed',reviewed_at=now(),updated_at=now(),evidence=evidence||jsonb_build_object('management_access_source',$3::text) WHERE product_id=$1::uuid AND requester_id=$2 AND state='pending'`, [productId,userId,method]);
  await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details) VALUES($1,'user','management.access_associated',$2::uuid,jsonb_build_object('evidence',$3::text))`, [userId,productId,method]);
}
