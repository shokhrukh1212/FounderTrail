import assert from "node:assert/strict";
import test from "node:test";
import { launchWeeks } from "../../components/LaunchScheduler";

test("every launch week option is a Monday at 00:00 UTC the API accepts",()=>{
  for(const now of [new Date("2026-09-23T00:48:00Z"),new Date("2026-09-21T00:00:00Z"),new Date("2026-09-27T23:59:59Z"),new Date("2026-12-30T12:00:00Z")]){
    const weeks=launchWeeks(now);
    const currentMonday=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-((now.getUTCDay()+6)%7));
    assert.equal(new Date(weeks[0].value).getTime(),currentMonday);
    assert.match(weeks[0].label,/^This week/);
    for(const week of weeks){
      const start=new Date(week.value);
      assert.equal(start.getUTCDay(),1);
      assert.equal(start.getUTCHours()+start.getUTCMinutes()+start.getUTCSeconds()+start.getUTCMilliseconds(),0);
      assert.ok(start.getTime()<=now.getTime()+180*24*60*60*1000,`${week.value} is beyond six months`);
    }
  }
  assert.equal(launchWeeks(new Date("2026-09-23T00:48:00Z"))[1].label,"Sep 28 – Oct 5, 2026");
});
