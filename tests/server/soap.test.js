import test from 'node:test';
import assert from 'node:assert/strict';
import {PayamGostarClient} from '../../server/payamgostar.js';
import {loadConfig} from '../../server/config.js';
import {env,invoices,filter,soap,guid} from './fixtures.js';
const config=loadConfig(env);
const response=body=>new Response(body,{headers:{'Content-Type':'text/xml'}});
test('SOAP matches live schema, escapes secrets, allows only documented reads',async()=>{
 const requests=[];const client=new PayamGostarClient(config,async(url,options)=>{
  requests.push({url,options});return response(soap('SearchInvoice','Invoice',invoices));
 });
 const rows=await client.read('invoices',filter);assert.equal(rows.length,1);assert.equal(rows[0].FinalValue,'125001.25');
 const {url,options}=requests[0];assert.equal(url,config.baseUrl+'/Services/API/IInvoice.svc');assert.equal(options.redirect,'error');
 assert.equal(options.headers.SOAPAction,'"http://tempuri.org/IInvoice/SearchInvoice"');assert.ok(options.body.includes('<userName>fictional-reader</userName>'));assert.ok(options.body.includes('fictional-password&amp;&lt;&gt;'));assert.ok(options.body.includes('&gt;='));
 await assert.rejects(()=>client.read('SavePerson',filter));assert.equal(requests.length,1);
});
test('SOAP reads details with exact operation argument names from WSDL',async()=>{
 const client=new PayamGostarClient(config,async(url,options)=>{
  assert.ok(options.body.includes(`<invoiceId>${guid(2)}</invoiceId>`));return response(soap('FindInvoiceById','Invoice',invoices[0],{single:true}));
 });
 assert.equal((await client.get('invoices',guid(2))).CrmId,guid(2));
 await assert.rejects(()=>client.get('invoices','not-a-guid'));
});
test('empty SOAP lists are valid; failure, HTML login, DTD and malformed XML are rejected',async()=>{
 const valid=new PayamGostarClient(config,async()=>response(soap('SearchInvoice','Invoice',[])));assert.deepEqual(await valid.read('invoices',filter),[]);
 for(const body of [soap('SearchInvoice','Invoice',[],{success:false}),'<html>Login</html>','<s:Envelope><s:Body></bad>', '<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]><x>&secret;</x>', '<Envelope><Body><Fault><faultstring>SECRET</faultstring></Fault></Body></Envelope>']){
  const client=new PayamGostarClient(config,async()=>response(body));await assert.rejects(()=>client.read('invoices',filter),e=>e.code==='CRM_UNAVAILABLE'&&!e.message.includes('SECRET'));
 }
});
test('multiple records and standard XML entities are parsed without numeric coercion',async()=>{
 const rows=[...invoices,{...invoices[0],CrmId:guid(5),BillableObjectState:'A & B < C',FinalValue:'9007199254740993.25'}];
 const client=new PayamGostarClient(config,async()=>response(soap('SearchInvoice','Invoice',rows)));const result=await client.read('invoices',filter);
 assert.equal(result.length,2);assert.equal(result[1].BillableObjectState,'A & B < C');assert.equal(result[1].FinalValue,'9007199254740993.25');
});
test('upstream HTTP errors, response limits and timeouts do not leak credentials',async()=>{
 const clients=[
 new PayamGostarClient(config,async()=>new Response('secret password',{status:401})),
 new PayamGostarClient({...config,maxBytes:20},async()=>response(soap('SearchInvoice','Invoice',invoices))),
 new PayamGostarClient({...config,maxRecords:1},async()=>response(soap('SearchInvoice','Invoice',[...invoices,...invoices]))),
 new PayamGostarClient(config,async()=>{throw new Error('fictional-password secret');})
 ];
 for(const client of clients)await assert.rejects(()=>client.read('invoices',filter),e=>[502,504].includes(e.status)&&!e.message.includes('fictional-password'));
});
test('per-request deadline aborts the upstream fetch and returns a safe error',async()=>{
 const client=new PayamGostarClient({...config,timeoutMs:100},async(_url,{signal})=>new Promise((resolve,reject)=>{
  signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
  setTimeout(()=>resolve(response('too late')),300);
 }));
 await assert.rejects(()=>client.read('invoices',filter),{code:'CRM_UNAVAILABLE'});
});
test('nil XML list represents zero records, not an unresolved placeholder',async()=>{
 const body='<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><s:Body><SearchInvoiceResponse><SearchInvoiceResult><Success>true</Success><InvoiceInfoList i:nil="true"/></SearchInvoiceResult></SearchInvoiceResponse></s:Body></s:Envelope>';
 assert.deepEqual(await new PayamGostarClient(config,async()=>response(body)).read('invoices',filter),[]);
});
