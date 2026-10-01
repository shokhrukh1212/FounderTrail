/** Audited legacy transition. Default is a rollback-only dry run; never sends email. */
import { writeFileSync } from 'node:fs';
import { databaseHost, getPool } from '../lib/db';
import { productIdentity } from '../lib/launch-policy';
import { validateProductSubmission } from '../lib/product-validation';
import { associateOriginalSubmitter } from '../lib/management-access';
const apply = process.argv.includes('--apply');
const reportPath = process.argv.find(value=>value.startsWith('--report='))?.slice(9) || '/private/tmp/foundertrail-instant-launch-report.json';
async function main(){
  console.log(`Instant launch ${apply ? 'apply' : 'dry-run'} on ${databaseHost()}`);
  const pool=getPool();const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(81402520)`);
    // Reconciliation covers immutable IDs, URLs, metadata, engagement and paid records.
    const tables=['product_votes','launch_votes','product_comments','product_follows','product_outbound_click_events','product_listing_view_events','product_media','product_launches','pro_launch_orders','pro_entitlements','product_categories','product_updates','product_owner_credentials','product_submission_metadata'];
    async function fingerprints(){
      const result:Record<string,string>={};
      for(const table of tables){const rows=await client.query(`SELECT md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY row_to_json(t)::text),'')) AS hash FROM ${table} t`);result[table]=rows.rows[0].hash;}
      const rows=await client.query(`SELECT md5(coalesce(string_agg((to_jsonb(p)-'status'-'published_at'-'approved_at'-'updated_at')::text,'' ORDER BY id),'')) AS hash FROM products p`);result.products=rows.rows[0].hash;return result;
    }
    const before=await fingerprints();
    const rows=await client.query(`SELECT p.*,u.deleted_at AS submitter_deleted_at,(SELECT string_agg(c.slug,',') FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=p.id) AS categories,EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND (p.created_by_user_id IS NULL OR po.user_id<>p.created_by_user_id)) AS conflicting_owner,EXISTS(SELECT 1 FROM product_claims pc WHERE pc.product_id=p.id AND pc.state='disputed') AS disputed,EXISTS(SELECT 1 FROM product_moderation_events me WHERE me.product_id=p.id AND me.to_status IN ('rejected','archived')) AS restricted FROM products p LEFT JOIN app_users u ON u.id=p.created_by_user_id ORDER BY p.created_at FOR UPDATE OF p`);
    const identities=new Map<string,number>();
    for(const p of rows.rows){try{const key=productIdentity(p.website_url);identities.set(key,(identities.get(key)||0)+1);}catch{}}
    const report:{mode:string;published:string[];associated:string[];exceptions:{id:string;reason:string}[];reconciliation:unknown}={mode:apply?'apply':'dry-run',published:[],associated:[],exceptions:[],reconciliation:null};
    for(const p of rows.rows){
      if(p.conflicting_owner||p.disputed){report.exceptions.push({id:p.id,reason:'Conflicting ownership or unresolved dispute'});continue;}
      if(p.created_by_user_id&&!p.submitter_deleted_at&&await associateOriginalSubmitter(client,p.id,p.created_by_user_id))report.associated.push(p.id);
      if(p.status!=='pending')continue;
      if(p.restricted||p.is_demo||p.submitter_deleted_at){report.exceptions.push({id:p.id,reason:'Prior moderation, demo, or restricted account'});continue;}
      const form=new FormData();for(const [key,value] of Object.entries({websiteUrl:p.website_url,name:p.short_name||p.name,tagline:p.tagline,contactEmail:p.contact_email,categories:p.categories,ownershipConsent:p.submission_consent_at?'on':''}))form.set(key,String(value??''));
      const valid=validateProductSubmission(form);
      if(!valid.ok){report.exceptions.push({id:p.id,reason:`Automatic validation: ${valid.field??'details'}`});continue;}
      if((identities.get(productIdentity(p.website_url))||0)>1){report.exceptions.push({id:p.id,reason:'Unresolved duplicate product URL'});continue;}
      await client.query(`UPDATE products SET status='published',published_at=coalesce(published_at,now()),approved_at=coalesce(approved_at,now()),updated_at=now() WHERE id=$1`,[p.id]);
      await client.query(`INSERT INTO product_moderation_events(product_id,from_status,to_status,internal_reason) VALUES($1,'pending','published','Instant publishing migration: automatic validation passed.')`,[p.id]);
      await client.query(`INSERT INTO foundertrail_audit_events(actor_kind,action,product_id,details) VALUES('system','migration.instant_publication',$1,jsonb_build_object('migration','020','previousStatus','pending'))`,[p.id]);
      report.published.push(p.id);
    }
    const after=await fingerprints();const preserved=JSON.stringify(before)===JSON.stringify(after);
    report.reconciliation={preserved,before,after};
    if(!preserved)throw new Error('Historical-data reconciliation failed; rolling back.');
    // Write the reviewable report before allowing any commit.
    writeFileSync(reportPath,JSON.stringify(report,null,2),{mode:0o600});
    await client.query(apply?'COMMIT':'ROLLBACK');
    console.log(JSON.stringify({mode:report.mode,published:report.published.length,associated:report.associated.length,exceptions:report.exceptions.length,preserved,reportPath}));
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Migration failed');process.exitCode=1;});
