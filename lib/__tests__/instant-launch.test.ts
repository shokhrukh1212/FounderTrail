import assert from 'node:assert/strict';
import test from 'node:test';
import { activationPost, launchWeek, localLaunchInstant, parseLaunchChoice, postLength, productIdentity } from '../launch-policy';
import { generatedSocial } from '../launch-kit';

test('launch now uses the real instant and the half-open Monday UTC week',()=>{
  for(const instant of ['2026-10-04T23:59:59.999Z','2026-10-05T00:00:00.000Z','2026-12-31T23:59:00Z']){
    const now=new Date(instant);const launch=parseLaunchChoice('now',null,now);const week=launchWeek(now);
    assert.equal(launch.startsAt?.toISOString(),instant.replace('23:59:00Z','23:59:00.000Z'));
    assert.ok(now>=week.startsAt && now<week.endsAt);
    assert.equal(week.startsAt.getUTCDay(),1);assert.equal(week.startsAt.getUTCHours(),0);
    assert.equal(week.endsAt.getTime()-week.startsAt.getTime(),7*86400000);
  }
});
test('scheduled dates require an explicit timezone, a future instant and bounded horizon',()=>{
  const now=new Date('2026-10-01T12:00:00Z');
  assert.equal(parseLaunchChoice('scheduled','2026-10-02T09:00:00+05:00',now).startsAt?.toISOString(),'2026-10-02T04:00:00.000Z');
  for(const value of ['2026-10-01T12:00:00Z','2026-10-01T13:00','not a date','2027-10-01T09:00:00Z'])assert.throws(()=>parseLaunchChoice('scheduled',value,now),/future/);
  assert.throws(()=>parseLaunchChoice('unrecognized',null,now),/option/);
  assert.equal(parseLaunchChoice('none',null,now).startsAt,null);
});
test('identity normalizes scheme, www and trailing slash while preserving shared-host products',()=>{
  assert.equal(productIdentity('https://www.example.com/atlas/'),'example.com/atlas');
  assert.equal(productIdentity('http://example.com/atlas'),'example.com/atlas');
  assert.notEqual(productIdentity('https://example.com/atlas'),productIdentity('https://example.com/tempo'));
  assert.notEqual(productIdentity('https://example.com/app?id=1'),productIdentity('https://example.com/app?id=2'));
  assert.equal(productIdentity('https://example.com/app/?next=/folder/'),'example.com/app?next=/folder/');
});
test('local picker respects DST offsets and rejects missing clock-change times',()=>{
  const previous=process.env.TZ;
  try {
    process.env.TZ='America/New_York';
    assert.equal(localLaunchInstant('2027-03-13T09:00')?.toISOString(),'2027-03-13T14:00:00.000Z');
    assert.equal(localLaunchInstant('2027-03-14T09:00')?.toISOString(),'2027-03-14T13:00:00.000Z');
    assert.equal(localLaunchInstant('2027-03-14T02:30'),null);
    assert.equal(localLaunchInstant('2027-02-30T09:00'),null);
  } finally { if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous; }
});
test('long Pro defaults retain the complete destination and ordinary post budget',()=>{
  const url='https://foundertrail.com/product/cafe-studio';
  const draft=generatedSocial({name:"Café — Founder's Studio",tagline:'A thoughtful workspace. '.repeat(20),useCase:null,audience:'independent founders',websiteUrl:'https://example.com',founderTrailUrl:url,launchState:'live'});
  assert.ok(draft.short.endsWith(url));assert.ok(postLength(draft.short)<=280);
});
test('state-specific post templates preserve the full short name and public URL',()=>{
  const name="Café — Founder's Studio";const url='https://foundertrail.com/product/cafe';
  assert.match(activationPost(name,url,'live'),/^I just launched Café — Founder's Studio/);
  assert.match(activationPost(name,url,'scheduled','Oct 4'),/launching on Oct 4/);
  assert.match(activationPost(name,url,'listed'),/now has a home/);
  for(const state of ['live','scheduled','listed'] as const){const post=activationPost(name,url,state,'Oct 4');assert.ok(post.endsWith(url));assert.ok(postLength(post)<280);assert.equal(new URL(`https://x.com/intent/tweet?${new URLSearchParams({text:post})}`).searchParams.get('text'),post);}
  assert.equal(postLength('https://a.com/very/long/path'),23);
  assert.equal(postLength('你好'),4);
});
