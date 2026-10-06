import test from 'node:test';
import assert from 'node:assert/strict';
import {demoData,services} from '../assets/demo-data.js';
import {selectData,metrics,sum} from '../assets/metrics.js';
test('all periods and services derive consistent figures from actual records',()=>{
 for(const period of ['6','3','1'])for(const service of ['all',...services.map(s=>s.id)])for(const era of ['current','previous']){
  const selection=selectData(demoData,period,service,era),m=metrics(selection);
  assert.equal(m.orders,selection.orders.length);
  assert.equal(m.revenue,services.reduce((n,s)=>n+sum(selection.orders.filter(r=>r.service===s.id)),0));
  assert.equal(m.revenue,[1,2,3,4,5,6].reduce((n,month)=>n+sum(selection.orders.filter(r=>r.month===month)),0));
  assert.equal(m.clients,new Set(selection.orders.map(r=>r.clientId)).size);
  assert.equal(m.open,sum(selection.opportunities.filter(r=>!['won','lost'].includes(r.stage))));
  assert.ok(m.conversion===null||m.conversion>=0&&m.conversion<=100);
  assert.ok(selection.orders.every(r=>r.era===era&&(service==='all'||r.service===service)));
 }
});
test('month and quarter include precisely their dated orders',()=>{
 assert.ok(selectData(demoData,'1','all').orders.every(r=>r.month===6));
 assert.ok(selectData(demoData,'3','all').orders.every(r=>r.month>=4));
 assert.equal(metrics(selectData(demoData,'6','all')).orders,126);
});
test('empty selection has defined totals and no fabricated conversion',()=>{
 assert.deepEqual(metrics({orders:[],opportunities:[]}),{revenue:0,orders:0,clients:0,conversion:null,open:0});
});
