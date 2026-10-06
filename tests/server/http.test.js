import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiServer} from '../../server/app.js';
import {loadConfig} from '../../server/config.js';
import {DashboardService} from '../../server/dashboard-service.js';
import {ApiError} from '../../server/errors.js';
import {env,TOKEN,fakeClient} from './fixtures.js';
async function start(t,config,service){const server=createApiServer(config,service);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));return `http://127.0.0.1:${server.address().port}`;}
const headers={Authorization:`Bearer ${TOKEN}`};
const range='?from=2026-09-01&to=2026-09-30';
test('HTTP authentication, resource pagination and no-store responses',async t=>{
 const config=loadConfig(env),base=await start(t,config,new DashboardService(config,fakeClient()));
 assert.equal((await fetch(base+'/healthz')).status,200);
 for(const route of ['status','dashboard','customers','orders','opportunities']){
  const result=await fetch(base+'/api/v1/'+route+(route==='status'?'':range));assert.equal(result.status,401);
 }
 const wrong=await fetch(base+'/api/v1/dashboard'+range,{headers:{Authorization:'Bearer wrong-but-long-enough-token-1234567890'}});assert.equal(wrong.status,401);
 const status=await fetch(base+'/api/v1/status',{headers});assert.deepEqual(await status.json(),{configured:true,connectionVerified:false,state:'configured-unverified',powerBiConnected:false});
 const result=await fetch(base+'/api/v1/dashboard'+range,{headers});assert.equal(result.status,200);assert.equal(result.headers.get('Cache-Control'),'no-store');
 const body=await result.json();assert.equal(body.summary.orderCount,1);assert.equal(body.demo,false);assert.ok(!JSON.stringify(body).includes(env.PAYAMGOSTAR_PASSWORD));
 const orders=await (await fetch(base+'/api/v1/orders'+range,{headers})).json();assert.equal(orders.items.length,1);assert.equal(orders.pagination.total,1);
 const page2=await (await fetch(base+'/api/v1/opportunities'+range+'&pageSize=1&page=2',{headers})).json();assert.equal(page2.items.length,1);assert.equal(page2.pagination.total,2);
 const search=await (await fetch(base+'/api/v1/customers'+range+'&search=missing',{headers})).json();assert.equal(search.pagination.total,0);
 assert.equal((await fetch(base+'/api/v1/orders?query=malicious',{headers})).status,400);
 assert.equal((await fetch(base+'/api/v1/status',{method:'POST',headers})).status,405);
 assert.equal((await fetch(base+'/api/v1/orders'+range,{method:'POST',headers,body:'secret'})).status,400);
 assert.equal((await fetch(base+'/.env',{headers})).status,404);
});
test('unconfigured CRM produces honest protected status and 503 without contacting upstream',async t=>{
 const config=loadConfig({FARIN_API_TOKEN:TOKEN}),base=await start(t,config,new DashboardService(config,{read(){throw new Error('must not be called')}}));
 const status=await (await fetch(base+'/api/v1/status',{headers})).json();assert.equal(status.state,'not-configured');
 const result=await fetch(base+'/api/v1/dashboard'+range,{headers});assert.equal(result.status,503);assert.equal((await result.json()).error.code,'CRM_NOT_CONFIGURED');
});
test('CORS uses an exact origin, does not grant credentials and never replaces authentication',async t=>{
 const config={...loadConfig(env),allowedOrigin:'https://dibdaminisikh-png.github.io'},base=await start(t,config,new DashboardService(config,fakeClient()));
 assert.equal((await fetch(base+'/api/v1/status',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
 const preflight=await fetch(base+'/api/v1/orders',{method:'OPTIONS',headers:{Origin:config.allowedOrigin,'Access-Control-Request-Method':'GET'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),config.allowedOrigin);assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),null);
 const unauth=await fetch(base+'/api/v1/status',{headers:{Origin:config.allowedOrigin}});assert.equal(unauth.status,401);
});
test('rate limits apply before authentication and cannot be bypassed with forwarding headers',async t=>{
 const config={...loadConfig(env),rateLimit:2},base=await start(t,config,new DashboardService(config,fakeClient()));
 assert.equal((await fetch(base+'/api/v1/status')).status,401);assert.equal((await fetch(base+'/api/v1/status')).status,401);
 const result=await fetch(base+'/api/v1/status',{headers:{...headers,'X-Forwarded-For':'1.2.3.4'}});assert.equal(result.status,429);assert.ok(result.headers.get('Retry-After'));
});
test('unexpected and CRM errors are sanitized',async t=>{
 const config=loadConfig(env);
 for(const error of [new Error('SECRET username/password'),new ApiError(502,'CRM_UNAVAILABLE','دریافت اطلاعات ناموفق بود.')]){
  const base=await start(t,config,{async snapshot(){throw error;}});const result=await fetch(base+'/api/v1/dashboard'+range,{headers});const text=await result.text();assert.ok(!text.includes('SECRET'));assert.ok(!text.includes('password'));assert.ok(result.status>=500);
 }
});
test('full HTTP-to-SOAP flow uses only read operations and returns normalized data',async t=>{
 const {PayamGostarClient}=await import('../../server/payamgostar.js');
 const {soap,organizations,invoices,opportunities}=await import('./fixtures.js');
 const config=loadConfig(env),actions=[];
 const fetchSoap=async(url,options)=>{
  const service=/I(Organization|Invoice|Opportunity)\.svc$/.exec(url)[1];
  const method=options.headers.SOAPAction.split('/').at(-1).replaceAll('"','');actions.push(method);
  const rows={Organization:organizations,Invoice:invoices,Opportunity:opportunities}[service];
  if(method.startsWith('Search'))return new Response(soap(method,service,rows));
  const recordId=/<(?:OrganizationId|invoiceId|opportunityId)>([^<]+)</.exec(options.body)[1];
  return new Response(soap(method,service,rows.find(r=>r.CrmId===recordId),{single:true}));
 };
 const base=await start(t,config,new DashboardService(config,new PayamGostarClient(config,fetchSoap)));
 const response=await fetch(base+'/api/v1/dashboard'+range,{headers});assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.summary.invoiceValueToman,'12500.125');assert.equal(body.summary.opportunityStages.won,1);
 assert.ok(actions.every(m=>m.startsWith('Search')||m.startsWith('Find')));assert.ok(actions.includes('FindInvoiceById'));assert.ok(actions.includes('FindOpportunityById'));
});
