import {XMLBuilder} from 'fast-xml-parser';
export const guid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const TOKEN='fictional-testing-token-12345678901234567890';
export const env = {FARIN_API_TOKEN:TOKEN,PAYAMGOSTAR_USERNAME:'fictional-reader',PAYAMGOSTAR_PASSWORD:'fictional-password&<>',PAYAMGOSTAR_CURRENCY:'IRR',PAYAMGOSTAR_PRODUCT_SERVICE_MAP:JSON.stringify({[guid(9)]:'implant'}),PAYAMGOSTAR_STAGE_MAP:JSON.stringify({[guid(20)]:'won',[guid(21)]:'proposal'})};
export const organizations=[{CrmId:guid(1),NickName:'مرکز نمونه الف',AddressContacts:{IdentityContactAddress:{City:'تهران',Address:'DO NOT EXPOSE'}},NationalCode:'DO NOT EXPOSE',Description:'DO NOT EXPOSE',Emails:{string:'DO NOT EXPOSE'}}];
export const invoices=[{CrmId:guid(2),IdentityId:guid(1),InvoiceType:'Invoice',InvoiceDate:'2026-09-15T12:00:00+03:30',FinalValue:'125001.25',BillableObjectState:'تایید شده',Description:'DO NOT EXPOSE',Details:{InvoiceDetailInfo:{ProductId:guid(9),ProductName:'DO NOT EXPOSE'}}}];
export const opportunities=[{CrmId:guid(3),IdentityId:guid(1),CreatDate:'2026-09-10T10:00:00',TotalValue:'50000',StageId:guid(20),Products:{OpportunityProductInfo:{ProductId:guid(9)}},Description:'DO NOT EXPOSE'}, {CrmId:guid(4),IdentityId:guid(1),CreatDate:'2026-09-11T10:00:00',TotalValue:'90000',StageId:guid(21),Products:{OpportunityProductInfo:{ProductId:guid(9)}}}];
export const filter = {from:'2026-09-01',to:'2026-09-30',service:'all',search:'',page:1,pageSize:50};
export function soap(method, service, rows, {success=true,single=false}={}) {
  const result={Success:String(success),Message:success?'':'sensitive upstream failure'};
  if(single)result[`${service}Info`]=rows;
  else result[`${service}InfoList`] = rows.length ? {[`${service}Info`]:rows} : '';
  const body={'s:Envelope':{'@_xmlns:s':'http://schemas.xmlsoap.org/soap/envelope/','s:Body':{[`${method}Response`]:{[`${method}Result`]:result}}}};
  return new XMLBuilder({ignoreAttributes:false}).build(body);
}
export const fakeClient = () => ({
  async read(kind){return {organizations,invoices,opportunities}[kind];},
  async get(kind,id){return {organizations,invoices,opportunities}[kind].find(r=>r.CrmId===id);}
});
