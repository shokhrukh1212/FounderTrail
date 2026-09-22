import "server-only";
import { authenticateOwner, type OwnerAuth } from "./owner-auth";
import { query } from "./db";
import type { ProEntitlementStatus } from "./pro-launch-policy";

export type ProOwnerAccess = OwnerAuth & { entitlementStatus: ProEntitlementStatus | null; productStatus: string };

export async function authenticateProOwner(request: Request, slug: string): Promise<ProOwnerAccess | null> {
  const owner = await authenticateOwner(request, slug);
  if (!owner) return null;
  const rows = await query<{ product_status: string; entitlement_status: ProEntitlementStatus | null }>(
    `SELECT p.status AS product_status,e.status AS entitlement_status
       FROM products p LEFT JOIN pro_entitlements e ON e.product_id=p.id WHERE p.id=$1::uuid`,
    [owner.productId],
  );
  return rows[0] ? { ...owner, productStatus: rows[0].product_status, entitlementStatus: rows[0].entitlement_status } : null;
}
