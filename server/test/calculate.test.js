import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSummary } from '../src/calculate.js';

test('calculates meal rate, shared costs and balances', () => {
  const db = { cycles:[{id:1,status:'open'}], cycleMembers:[{cycleId:1,memberId:1,active:true,openingDue:0},{cycleId:1,memberId:2,active:true,openingDue:0}], members:[{id:1,name:'A'},{id:2,name:'B'}], meals:[{cycleId:1,memberId:1,breakfast:10,lunch:0,dinner:0,guest:0},{cycleId:1,memberId:2,breakfast:10,lunch:0,dinner:0,guest:0}], bazar:[{cycleId:1,total:2000}], costs:[{cycleId:1,amount:200,splitType:'equal'}], deposits:[{cycleId:1,memberId:1,amount:1200},{cycleId:1,memberId:2,amount:1000}] };
  const result = calculateSummary(db, 1);
  assert.equal(result.cycle.mealRate, 100);
  assert.equal(result.members[0].totalCost, 1100);
  assert.equal(result.members[0].balance, 100);
  assert.equal(result.members[1].balance, -100);
});
