import {ApiError} from '../../server/errors.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig} from '../../server/config.js';
import {DashboardService} from '../../server/dashboard-service.js';
import {decimal,moneyUnits,normalizeCustomers,normalizeOrders,summarize} from '../../server/normalize.js';
import {parseFilters,crmDateQuery} from '../../server/filters.js';
import {env,filter,guid,organizations,invoices,opportunities,fakeClient} from './fixtures.js';
const config=loadConfig(env);
test('money conversion and summaries preserve exact decimal amounts',async()=>{
 assert.equal(decimal(moneyUnits('125001.25','IRR')),'12500.125');
 assert.equal(decimal(moneyUnits('125001.25','IRT')),'125001.25');
 const s=await new DashboardService(config,fakeClient()).snapshot(filter);
 assert.equal(s.summary.invoiceValueToman,'12500.125');
 assert.equal(s.summary.invoiceValueMillionToman,'0.012500125');
 assert.equal(s.summary.openOpportunityValueToman,'9000');
 assert.equal(s.summary.conversionRate,100);
 assert.equal(s.orders[0].date,'2026-09-15');
 assert.equal(s.opportunities[0].stage,'proposal');
 assert.equal(s.summary.services.find(r=>r.service==='implant').amountToman,s.summary.invoiceValueToman);
 assert.equal(s.summary.monthlyRevenue[0].amountToman,s.summary.invoiceValueToman);
 assert.ok(!JSON.stringify(s).includes('DO NOT EXPOSE'));
});
test('date, service and Persian search consistently select rows and metrics',async()=>{
 const service=new DashboardService(config,fakeClient());
 const empty=await service.snapshot({...filter,service:'guide'});
 assert.equal(empty.orders.length,0);assert.equal(empty.summary.orderCount,0);assert.equal(empty.summary.conversionRate,null);
 const search=await service.snapshot({...filter,search:'ناموجود'});assert.equal(search.customers.length,0);assert.equal(search.opportunities.length,0);
 const range=await service.snapshot({...filter,to:'2026-09-12'});assert.equal(range.orders.length,0);assert.equal(range.opportunities.length,2);
});
test('natural person records are excluded before detail retrieval',async()=>{
 const client=fakeClient(),baseRead=client.read;const fetched=[];
 client.read=async(kind)=>kind==='invoices'?[...invoices,{CrmId:guid(88),IdentityId:guid(77),Subject:'PRIVATE PATIENT'}]:baseRead(kind);
 const baseGet=client.get;client.get=async(kind,id)=>{fetched.push(id);return baseGet(kind,id);};
 const s=await new DashboardService(config,client).snapshot(filter);
 assert.equal(s.quality.excludedNonOrganizationOrders,1);assert.ok(!fetched.includes(guid(88)));assert.ok(!JSON.stringify(s).includes('PRIVATE PATIENT'));
});
test('unknown and mixed services and stages remain explicit',async()=>{
 const client=fakeClient();client.get=async(kind,id)=>{
  if(kind==='invoices')return {...invoices[0],Details:{InvoiceDetailInfo:[{ProductId:guid(9)},{ProductId:guid(10)}]}};
  if(kind==='opportunities')return {...opportunities.find(r=>r.CrmId===id),StageId:guid(999),SaleStage:'unknown'};
  return organizations[0];
 };
 const c={...config,productMap:{[guid(9)]:'implant',[guid(10)]:'guide'}};
 const s=await new DashboardService(c,client).snapshot(filter);
 assert.equal(s.orders[0].service,'mixed');assert.equal(s.summary.openOpportunityValueToman,'0');assert.equal(s.summary.conversionRate,null);assert.equal(s.quality.unmappedOpportunityStages,2);
 const u=normalizeOrders(invoices,normalizeCustomers(organizations),{...config,productMap:{}});assert.equal(u.rows[0].service,'unmapped');
});
test('invalid finance and duplicate IDs fail instead of producing fabricated totals',()=>{
 for(const value of ['','NaN','123.456','1e9','１２','<b>10</b>'])assert.throws(()=>moneyUnits(value,'IRR'));
 assert.throws(()=>normalizeOrders([{...invoices[0],FinalValue:undefined}],normalizeCustomers(organizations),config));
 assert.throws(()=>normalizeCustomers([...organizations,...organizations]));
 assert.throws(()=>normalizeOrders([{...invoices[0],InvoiceDate:'2026-02-30'}],normalizeCustomers(organizations),config));
 const s=summarize([{amountToman:'-0.125',service:'unmapped',date:'2026-09-01',customerId:guid(1)}],[]);assert.equal(s.invoiceValueToman,'-0.125');
});
test('strict filters disallow arbitrary CRM query/host injection and bounded dates',()=>{
 for(const q of ['from=2026-02-30&to=2026-03-01','from=2026-09-01&to=2026-08-01','from=2025-01-01&to=2026-09-01','from=2026-09-01&to=2026-09-30&query=anything','from=2026-09-01&from=2026-08-01&to=2026-09-30','from=2026-09-01&to=2026-09-30&pageSize=999','from=2026-09-01&to=2026-09-30&service=unknown'])assert.throws(()=>parseFilters(new URLSearchParams(q)));
 assert.equal(crmDateQuery('Date',filter),'Date >= "2026-09-01" && Date < "2026-10-01"');
});
test('configuration rejects unsafe endpoints and secrets; no credentials means not connected',async()=>{
 for(const url of ['http://farinroshan.cloud.payamgostar.com','https://evil.example','https://u:p@farinroshan.cloud.payamgostar.com','https://farinroshan.cloud.payamgostar.com/path'])assert.throws(()=>loadConfig({...env,PAYAMGOSTAR_BASE_URL:url}));
 assert.throws(()=>loadConfig({}));assert.throws(()=>loadConfig({...env,PAYAMGOSTAR_CURRENCY:'USD'}));
 const c=loadConfig({FARIN_API_TOKEN:env.FARIN_API_TOKEN});let called=false;
 await assert.rejects(()=>new DashboardService(c,{read(){called=true;}}).snapshot(filter),{code:'CRM_NOT_CONFIGURED'});assert.equal(called,false);
});
test('unmapped stage and product names cannot inherit Object prototype properties',async()=>{
 const client=fakeClient();client.get=async(kind,recordId)=>{
  if(kind==='invoices')return {...invoices[0],Details:{InvoiceDetailInfo:{ProductId:'constructor'}}};
  if(kind==='opportunities')return {...opportunities.find(r=>r.CrmId===recordId),StageId:'constructor',SaleStage:'toString'};
  return organizations[0];
 };
 const s=await new DashboardService(config,client).snapshot(filter);
 assert.equal(s.orders[0].service,'unmapped');assert.equal(s.opportunities[0].stage,'unmapped');
});
test('snapshot concurrent load is bounded and failed hydration releases the slot',async()=>{
 const service=new DashboardService(config,fakeClient());service.active=4;
 await assert.rejects(()=>service.snapshot(filter),{code:'API_BUSY'});assert.equal(service.active,4);
 service.active=0;service.client={...fakeClient(),async get(){throw new ApiError(502,'TEST_FAILURE','ساختگی');}};
 await assert.rejects(()=>service.snapshot(filter),{code:'TEST_FAILURE'});assert.equal(service.active,0);
});
