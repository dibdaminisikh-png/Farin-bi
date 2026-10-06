import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {ApiError, upstreamError} from './errors.js';
import {requireConfigured} from './config.js';
import {crmDateQuery} from './filters.js';
const definitions = {
  organizations: {service:'Organization', method:'SearchOrganization', list:'OrganizationInfoList', item:'OrganizationInfo', typeKey:'organizationTypeKey', find:'FindOrganizationById', idParam:'OrganizationId', userParam:'username'},
  invoices: {service:'Invoice', method:'SearchInvoice', list:'InvoiceInfoList', item:'InvoiceInfo', typeKey:'invoiceTypeKey', date:'Date', find:'FindInvoiceById', idParam:'invoiceId', userParam:'userName'},
  opportunities: {service:'Opportunity', method:'SearchOpportunity', list:'OpportunityInfoList', item:'OpportunityInfo', typeKey:'opportunityTypeKey', date:'CreateDate', find:'FindOpportunityById', idParam:'opportunityId', userParam:'username'}
};
const parser = new XMLParser({removeNSPrefix:true, ignoreAttributes:false, parseTagValue:false, parseAttributeValue:false, trimValues:true, processEntities:false});
// Reject DTD/entity definitions. Enable only the five standard XML entities.
const xml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const decode = value => {
  if (typeof value === 'string') return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_,entity) => {
    if (entity[0] === '#') { const n = entity[1] === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1)); return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : ''; }
    return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity];
  });
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));
  return value;
};
function plainObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
export function parseSoap(text, definition, maxRecords) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw upstreamError();
  let body;
  try { body = decode(parser.parse(text)).Envelope?.Body; } catch { throw upstreamError(); }
  if (!plainObject(body) || body.Fault) throw upstreamError();
  const result = body[`${definition.method}Response`]?.[`${definition.method}Result`];
  if (!plainObject(result) || result.Success !== 'true') throw upstreamError();
  if (definition.single) { const item=result[definition.item]; if (!plainObject(item) || item['@_nil']==='true') throw upstreamError(); return item; }
  const container = result[definition.list];
  if (container === undefined) throw upstreamError();
  const nil = plainObject(container) && container['@_nil'] === 'true';
  const items = nil || container === '' ? [] : container?.[definition.item];
  if (items === undefined) throw upstreamError();
  const list = items === '' ? [] : Array.isArray(items) ? items : [items];
  if (list.length > maxRecords) throw new ApiError(502, 'CRM_RESULT_TOO_LARGE', 'حجم داده بیش از حد مجاز است؛ بازه کوتاه‌تری انتخاب کنید.');
  if (list.some(item=>!plainObject(item) || item['@_nil'] === 'true')) throw upstreamError();
  return list;
}
export class PayamGostarClient {
  constructor(config, fetchImpl = fetch) { this.config=config; this.fetch=fetchImpl; }
  async read(kind, filters, signal) {
    const definition = definitions[kind];
    if (!definition) throw new Error('Unsupported read operation');
    const values = {userName:this.config.username,password:this.config.password,typeKey:this.config[definition.typeKey],query:definition.date ? crmDateQuery(definition.date,filters) : ''};
    return this.call(definition,values,signal);
  }
  async get(kind, recordId, signal) {
    const base = definitions[kind];
    if (!base || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(recordId)) throw upstreamError();
    const definition={...base,method:base.find,single:true};
    return this.call(definition,{[base.userParam]:this.config.username,password:this.config.password,[base.idParam]:recordId},signal);
  }
  async call(definition,values,signal) {
    requireConfigured(this.config);
    const {service,method} = definition;
    const request = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><${method} xmlns="http://tempuri.org/">${Object.entries(values).map(([k,v])=>`<${k}>${xml(v)}</${k}>`).join('')}</${method}></s:Body></s:Envelope>`;
    try {
      const response = await this.fetch(`${this.config.baseUrl}/Services/API/I${service}.svc`, {
        method:'POST', redirect:'error', signal:AbortSignal.any([AbortSignal.timeout(this.config.timeoutMs),...(signal?[signal]:[])]),
        headers:{'Content-Type':'text/xml; charset=utf-8',SOAPAction:`"http://tempuri.org/I${service}/${method}"`},body:request
      });
      if (!response.ok || !response.body || Number(response.headers.get('content-length')) > this.config.maxBytes) throw upstreamError();
      const reader=response.body.getReader();const chunks=[];let bytes=0;
      try {
        while (true) {const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>this.config.maxBytes){await reader.cancel();throw upstreamError();}chunks.push(value);}
      } finally {reader.releaseLock();}
      return parseSoap(Buffer.concat(chunks).toString('utf8'),definition,this.config.maxRecords);
    } catch(error) {
      // Never return SOAP bodies, upstream messages, URLs or credentials.
      if (error instanceof ApiError) throw error;
      throw upstreamError();
    }
  }
}
