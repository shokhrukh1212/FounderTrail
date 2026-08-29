import type { PoolClient } from "pg";
import { CAMPAIGN_TEMPLATES } from "./email-templates";
import { countAllTimeVisitors } from "./visitors";

const MILESTONE_LOCK_KEY=8_140_25_03;

export async function createReachedMilestones(client:PoolClient,total:number):Promise<number>{
  await client.query(`SELECT pg_advisory_xact_lock($1)`,[MILESTONE_LOCK_KEY]);
  const settings=await client.query<{threshold:number;automatic_sending:boolean}>(
    `SELECT threshold,automatic_sending FROM visitor_milestone_settings s
      WHERE s.enabled AND s.threshold<=$1
        AND NOT EXISTS (SELECT 1 FROM visitor_milestone_events e WHERE e.threshold=s.threshold)
      ORDER BY s.threshold`,[total],
  );
  let created=0;
  for(const setting of settings.rows){
    const template=CAMPAIGN_TEMPLATES.visitor_milestone;
    const subject=setting.threshold===100?template.subject:`BidIndex reached ${setting.threshold} visitors 🚀`;
    const heading=setting.threshold===100?template.heading:`We reached ${setting.threshold} visitors 🚀`;
    const body=setting.threshold===100?template.body:`Hi {founder_name},\n\nBidIndex has reached ${setting.threshold} visitors.\n\nWhen you share {product_name}, people can discover and support your product. Real upvotes can move it higher in the Most Upvoted leaderboard.\n\nThank you for helping BidIndex grow.\n\n— Shokhrukh Karimov\nBidIndex`;
    const campaign=await client.query<{id:string}>(
      `INSERT INTO email_campaigns
       (internal_name,template_key,message_class,product_specific,subject,preview_text,heading,body,
        include_product_logo,primary_button_label,primary_button_url,secondary_button_label,
        secondary_button_url,sender_name,reply_to,audience,campaign_context,status,created_by,updated_by)
       VALUES ($1,'visitor_milestone','marketing',false,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        'BidIndex',NULL,$11::jsonb,$12::jsonb,'draft','system:visitor-milestone','system:visitor-milestone')
       RETURNING id::text`,[
        `Visitor milestone ${setting.threshold}`,subject,template.previewText,heading,
        body,template.includeProductLogo,template.primaryButtonLabel,template.primaryButtonUrl,
        template.secondaryButtonLabel,template.secondaryButtonUrl,
        JSON.stringify({selectAll:true,statuses:["published"],marketingOptedIn:true}),
        JSON.stringify({visitor_count:setting.threshold,milestone_threshold:setting.threshold}),
      ],
    );
    const campaignId=campaign.rows[0].id;
    const inserted=await client.query(
      `INSERT INTO visitor_milestone_events(threshold,reached_at,measured_visitor_total,campaign_id,campaign_status)
       VALUES($1,now(),$2,$3::uuid,'draft') ON CONFLICT(threshold) DO NOTHING`,
      [setting.threshold,total,campaignId],
    );
    if(!inserted.rowCount){await client.query(`DELETE FROM email_campaigns WHERE id=$1::uuid`,[campaignId]);continue}
    await client.query(
      `INSERT INTO admin_notifications(kind,title,body,related_campaign_id)
       VALUES('visitor_milestone',$1,$2,$3::uuid)`,[
        `BidIndex reached ${setting.threshold} visitors`,
        `The all-time visitor total reached ${total}. A milestone campaign was saved as a draft${setting.automatic_sending?" and will be queued by the maintenance worker because automatic sending is enabled":""}.`,campaignId,
      ],
    );
    await client.query(
      `INSERT INTO email_campaign_audit_events(campaign_id,actor,action,details)
       VALUES($1::uuid,'system:visitor-milestone','created_from_milestone',$2::jsonb)`,
      [campaignId,JSON.stringify({threshold:setting.threshold,measuredVisitorTotal:total,automaticSending:setting.automatic_sending})],
    );
    created++;
  }
  return created;
}

export async function reconcileReachedMilestones(client:PoolClient):Promise<number>{
  return createReachedMilestones(client,await countAllTimeVisitors(client));
}
