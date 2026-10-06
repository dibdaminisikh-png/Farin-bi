import {ApiError} from './errors.js';
import {normalizeSearch, validDay} from './filters.js';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = () => { throw new ApiError(502, 'CRM_DATA_INVALID', 'قالب داده پیام‌گستر معتبر نیست؛ نگاشت و نسخه سرویس باید بررسی شود.'); };
const scalar = value => typeof value === 'string' ? value : '';
const id = value => { const result=scalar(value).toLowerCase();if(!GUID.test(result))invalid();return result; };
const day = value => { const result=scalar(value).slice(0,10);if(!validDay(result))invalid();return result; };
const safeLabel = (value, max=160) => { const result=scalar(value).trim();if(!result || result.length>max || /[\x00-\x1f\x7f]/.test(result))invalid();return result; };
function arrayField(container, key) {
  if (!container || container['@_nil']==='true' || container==='') return [];
  const value=container[key];if(value===undefined)return [];return Array.isArray(value)?value:[value];
}
// Money is held as thousandths of a toman in BigInt. No float arithmetic.
export function moneyUnits(value, currency) {
  const s=scalar(value);
  if (!/^-?\d{1,20}(?:\.\d{1,2})?$/.test(s) || !['IRR','IRT'].includes(currency)) invalid();
  const negative=s.startsWith('-'), [whole,fraction='']=s.replace(/^-/,'').split('.');
  const minor=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  return (negative?-minor:minor)*(currency==='IRR'?1n:10n);
}
export function decimal(units, scale=3) {
  const sign=units<0n?'-':'';const s=(units<0n?-units:units).toString().padStart(scale+1,'0');
  const fraction=s.slice(-scale).replace(/0+$/,'');
  return `${sign}${s.slice(0,-scale)}${fraction?'.'+fraction:''}`;
}
const amount = (value, currency) => decimal(moneyUnits(value,currency));
const amountUnits = value => {
  const [whole,fraction='']=value.split('.');return BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0'))*(value.startsWith('-')?-1n:1n);
};
function distinct(rows) {
  const seen=new Set();for(const row of rows){if(seen.has(row.id))invalid();seen.add(row.id);}return rows;
}
function serviceFor(container,key,map) {
  const products=arrayField(container,key);if(!products.length)return 'unmapped';
  const groups=new Set(products.map(p=>{const key=scalar(p.ProductId).toLowerCase();return Object.hasOwn(map,key)?map[key]:'unmapped';}));
  if(groups.has('unmapped'))return 'unmapped';return groups.size===1?[...groups][0]:'mixed';
}
export function normalizeCustomers(records) {
  return distinct(records.map(r=>{
    // Only organization data is requested. Do not expose contacts, identifiers,
    // free-text notes, custom fields, personnel or any real patient identities.
    const addresses=arrayField(r.AddressContacts,'IdentityContactAddress');
    const city=scalar(addresses.find(a=>scalar(a.City))?.City);
    if(city.length>100 || /[\x00-\x1f\x7f]/.test(city))invalid();
    return {id:id(r.CrmId),name:safeLabel(r.NickName),city};
  }));
}
export function normalizeOrders(records, customers, config) {
  const ids=new Set(customers.map(c=>c.id));let excluded=0;
  const rows=[];
  for(const r of records) {
    const customerId=scalar(r.IdentityId).toLowerCase();
    if(!ids.has(customerId)){excluded++;continue;}
    const invoiceType=scalar(r.InvoiceType);
    if(invoiceType && invoiceType!=='Invoice')invalid();
    rows.push({id:id(r.CrmId),customerId,date:day(r.InvoiceDate),service:serviceFor(r.Details,'InvoiceDetailInfo',config.productMap),amountToman:amount(r.FinalValue,config.currency),status:scalar(r.BillableObjectState).slice(0,80)||'نامشخص'});
  }
  return {rows:distinct(rows),excluded};
}
export function normalizeOpportunities(records, customers, config) {
  const ids=new Set(customers.map(c=>c.id));let excluded=0;
  const rows=[];
  for(const r of records) {
    const customerId=scalar(r.IdentityId).toLowerCase();
    if(!ids.has(customerId)){excluded++;continue;}
    const stageId=scalar(r.StageId).toLowerCase(),stageLabel=scalar(r.SaleStage);
    const stage=Object.hasOwn(config.stageMap,stageId)?config.stageMap[stageId]:Object.hasOwn(config.stageMap,stageLabel)?config.stageMap[stageLabel]:'unmapped';
    rows.push({id:id(r.CrmId),customerId,date:day(r.CreatDate || r.CreateDate),service:serviceFor(r.Products,'OpportunityProductInfo',config.productMap),amountToman:amount(r.TotalValue,config.currency),stage});
  }
  return {rows:distinct(rows),excluded};
}
export function filterRows(rows, customers, filters) {
  const byId=new Map(customers.map(c=>[c.id,c]));const search=normalizeSearch(filters.search);
  return rows.filter(r=>r.date>=filters.from&&r.date<=filters.to&&(filters.service==='all'||r.service===filters.service)&&normalizeSearch(`${byId.get(r.customerId)?.name||''} ${byId.get(r.customerId)?.city||''}`).includes(search)).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
function total(rows) {return rows.reduce((sum,r)=>sum+amountUnits(r.amountToman),0n);}
export function summarize(orders, opportunities) {
  const sales=total(orders);const open=opportunities.filter(r=>['lead','review','proposal'].includes(r.stage));
  const won=opportunities.filter(r=>r.stage==='won').length,lost=opportunities.filter(r=>r.stage==='lost').length;
  const serviceGroups=['implant','guide','ortho','cosmetic','mixed','unmapped'];
  return {
    invoiceValueToman:decimal(sales),invoiceValueMillionToman:decimal(sales,9),orderCount:orders.length,
    activeCustomerCount:new Set(orders.map(r=>r.customerId)).size,
    openOpportunityValueToman:decimal(total(open)),
    conversionRate:won+lost?Math.round(won/(won+lost)*10000)/100:null,
    opportunityStages:Object.fromEntries(['lead','review','proposal','won','lost','unmapped'].map(stage=>[stage,opportunities.filter(r=>r.stage===stage).length])),
    services:serviceGroups.map(service=>({service,orderCount:orders.filter(r=>r.service===service).length,amountToman:decimal(total(orders.filter(r=>r.service===service)))})),
    monthlyRevenue:[...new Set(orders.map(r=>r.date.slice(0,7)))].sort().map(month=>({month,amountToman:decimal(total(orders.filter(r=>r.date.startsWith(month))))}))
  };
}
