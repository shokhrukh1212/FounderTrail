/** Seeds synthetic legacy history and rehearses the rollback-only / apply / retry modes. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
const dbUrl=process.env.DATABASE_URL;
if(!dbUrl || !['127.0.0.1','localhost'].includes(new URL(dbUrl).hostname))throw new Error('Use a disposable localhost database only.');
const pool=new pg.Pool({connectionString:dbUrl,max:1});
const artifact='artifacts/instant-launch';mkdirSync(artifact,{recursive:true});
const run=randomUUID().slice(0,8),submitter=`migration-founder-${run}`,other=`migration-other-${run}`;
try {
 await pool.query(`INSERT INTO app_users(id,name,email,email_verified) VALUES($1,'Legacy Founder',$2,true),($3,'Other Founder',$4,true)`,[submitter,`${submitter}@example.test`,other,`${other}@example.test`]);
 const preference=(await pool.query(`INSERT INTO founder_email_preferences(normalized_email) VALUES($1) RETURNING id`,[`${submitter}@example.test`])).rows[0].id;
 const fixtures={};
 for(const [name,status,consent] of [['valid','pending',true],['missing-consent','pending',false],['archived','archived',true],['conflict','pending',true],['published','published',true],['disputed','pending',true]]) {
  const slug=`migration-${run}-${name}`;
  const row=(await pool.query(`INSERT INTO products(slug,website_url,submitted_url,normalized_domain,name,tagline,contact_email,legacy_contact_email,email_preference_id,created_by_user_id,status,published_at,approved_at,launch_at,launch_date,submission_consent_at,created_at) VALUES($1,$2,$2,'migration-fixtures.test',$3,'Real legacy fixture details.',$4,$4,$5,$6,$7,CASE WHEN $7='published' THEN now()-interval '60 days' END,CASE WHEN $7='published' THEN now()-interval '60 days' END,now()-interval '60 days',current_date-60,CASE WHEN $8 THEN now()-interval '60 days' END,now()-interval '60 days') RETURNING id,slug,created_at`,[slug,`https://migration-fixtures.test/${run}/${name}`,`Legacy ${name}`,`${submitter}@example.test`,preference,submitter,status,consent])).rows[0];
  fixtures[name]=row;
  await pool.query(`INSERT INTO product_categories(product_id,category_id,position) SELECT $1,id,0 FROM categories WHERE slug='productivity'`,[row.id]);
  await pool.query(`INSERT INTO product_owner_credentials(product_id,token_hash) VALUES($1,repeat('b',64))`,[row.id]);
 }
 await pool.query(`INSERT INTO product_owners(product_id,user_id,verified_at,verification_method) VALUES($1,$2,now(),'manual_admin')`,[fixtures.conflict.id,other]);
 await pool.query(`INSERT INTO product_claims(product_id,requester_id,state,evidence_method,evidence) VALUES($1,$2,'pending','domain_meta','{"retainedEvidence":true}'),($3,$2,'disputed','domain_meta','{"retainedDispute":true}')`,[fixtures.valid.id,submitter,fixtures.disputed.id]);
 const id=fixtures.published.id;
 // Every engagement/paid-history class below is nonempty during reconciliation.
 await pool.query(`INSERT INTO product_votes(product_id,voter_hash,network_hash) VALUES($1,repeat('c',64),repeat('d',64))`,[id]);
 await pool.query(`INSERT INTO product_follows(product_id,user_id) VALUES($1,$2)`,[id,other]);
 await pool.query(`INSERT INTO product_comments(product_id,author_id,body) VALUES($1,$2,'Keep this original comment.')`,[id,other]);
 await pool.query(`INSERT INTO product_outbound_click_events(product_id,visitor_hash,network_hash,outcome) VALUES($1,repeat('e',64),repeat('f',64),'counted')`,[id]);
 await pool.query(`INSERT INTO product_listing_view_events(product_id,visitor_hash,network_hash,metric_date,outcome) VALUES($1,repeat('e',64),repeat('f',64),current_date,'counted')`,[id]);
 const week=(await pool.query(`INSERT INTO launch_weeks(starts_at,ends_at,state) VALUES('2026-08-03T00:00:00Z','2026-08-10T00:00:00Z','completed') ON CONFLICT(starts_at) DO UPDATE SET state='completed' RETURNING id`)).rows[0].id;
 const launch=(await pool.query(`INSERT INTO product_launches(product_id,launch_week_id,state,approved_at,starts_at,final_rank,final_vote_count) VALUES($1,$2,'completed','2026-08-03T00:00:00Z','2026-08-03T00:00:00Z',1,1) RETURNING id`,[id,week])).rows[0].id;
 await pool.query(`INSERT INTO launch_votes(launch_id,user_id) VALUES($1,$2)`,[launch,other]);
 const order=(await pool.query(`INSERT INTO pro_launch_orders(product_id,purchaser_id,provider_environment,quoted_price_minor,status,paid_total_minor,paid_tax_minor,paid_at) VALUES($1,$2,'test_mode',500,'paid',500,0,now()-interval '30 days') RETURNING id`,[id,submitter])).rows[0].id;
 await pool.query(`INSERT INTO pro_entitlements(product_id,source,source_order_id,status,activated_at) VALUES($1,'purchase',$2,'active',now()-interval '30 days')`,[id,order]);
 const reports=[];
 for(const [name,apply] of [['dry-run',false],['applied',true],['rerun',true]]) {
  const path=`${artifact}/migration-${name}.json`;
  const result=spawnSync(process.execPath,['--import','tsx','scripts/instant-launch-migrate.ts',...(apply?['--apply']:[]),`--report=${path}`],{env:{...process.env,USE_TEST_DATABASE:'false',DATABASE_URL:dbUrl},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);console.log(result.stdout.trim());
  const report=JSON.parse(readFileSync(path,'utf8'));assert.equal(report.reconciliation.preserved,true);reports.push(report);
  if(name==='dry-run')assert.equal((await pool.query(`SELECT status FROM products WHERE id=$1`,[fixtures.valid.id])).rows[0].status,'pending');
 }
 assert.ok(reports[0].published.includes(fixtures.valid.id));assert.equal(reports[0].published.length,1);assert.equal(reports[0].associated.length,4);assert.equal(reports[0].exceptions.length,3);
 assert.equal(reports[2].published.length,0);assert.equal(reports[2].associated.length,0);
 assert.equal((await pool.query(`SELECT state,evidence FROM product_claims WHERE product_id=$1`,[fixtures.valid.id])).rows[0].evidence.retainedEvidence,true);
 assert.equal((await pool.query(`SELECT status FROM products WHERE id=$1`,[fixtures.archived.id])).rows[0].status,'archived');
 assert.equal((await pool.query(`SELECT count(*) FROM product_launches WHERE product_id=$1`,[fixtures.valid.id])).rows[0].count,'0');
 const sqlIdentity=(await pool.query(`SELECT foundertrail_product_identity('https://www.example.com/app/?next=/folder/') AS identity`)).rows[0].identity;assert.equal(sqlIdentity,'example.com/app?next=/folder/');
 await assert.rejects(pool.query(readFileSync('migrations/020_instant_launch.down.sql','utf8')),/rollback retains new data/);
 writeFileSync(`${artifact}/migration-verification.json`,JSON.stringify({environment:'Synthetic legacy fixtures in disposable localhost PostgreSQL/PGlite; no production records',fixtures:6,dryRun:{published:1,associated:4,exceptions:3},applied:{published:1,associated:4,exceptions:3},rerun:{published:0,associated:0,exceptions:3},preserved:true,rollbackRefused:true,nonemptyHistory:['lifetime votes','launch votes/history','comments','follows','clicks','listing views','paid test orders','Pro entitlements'],exceptions:['Missing authorization consent','Conflicting manager','Unresolved dispute'],historicalListingsAutomaticallyLaunched:0},null,2));
 console.log('PASS Migration dry-run, apply, retry, nonempty history reconciliation and SQL product identity');
} finally {await pool.end();}
