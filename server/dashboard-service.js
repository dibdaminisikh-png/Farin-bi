import {ApiError} from './errors.js';
import {normalizeCustomers, normalizeOrders, normalizeOpportunities, filterRows, summarize} from './normalize.js';
import {requireConfigured} from './config.js';
export class DashboardService {
  constructor(config, client) {this.config=config;this.client=client;}
  async snapshot(filters) {
    requireConfigured(this.config);
    if ((this.active || 0) >= 4) throw new ApiError(503, 'API_BUSY', 'سرویس مشغول است؛ کمی بعد تلاش کنید.');
    this.active=(this.active || 0)+1;
    const controller=new AbortController();
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(60000)]);
    try {
    // Search can return only shared CRM fields. Retrieve full records explicitly.
    const organizations=await this.client.read('organizations',filters,signal);
    const fullOrganizations=await this.hydrate('organizations',organizations,signal);
    const customers=normalizeCustomers(fullOrganizations);
    const ids=new Set(customers.map(c=>c.id));
    const rawOrderSearch=await this.client.read('invoices',filters,signal);
    const rawOpportunitySearch=await this.client.read('opportunities',filters,signal);
    const orgOnly=rows=>rows.filter(r=>ids.has(String(r.IdentityId||'').toLowerCase()));
    // Never hydrate invoices/opportunities linked to natural persons.
    const rawOrders=await this.hydrate('invoices',orgOnly(rawOrderSearch),signal);
    const rawOpportunities=await this.hydrate('opportunities',orgOnly(rawOpportunitySearch),signal);
    const normalizedOrders=normalizeOrders(rawOrders,customers,this.config);
    const normalizedOpportunities=normalizeOpportunities(rawOpportunities,customers,this.config);
    const orders=filterRows(normalizedOrders.rows,customers,filters);
    const opportunities=filterRows(normalizedOpportunities.rows,customers,filters);
    const activeIds=new Set([...orders,...opportunities].map(r=>r.customerId));
    return {
      schemaVersion:1,source:'payamgostar',demo:false,fetchedAt:new Date().toISOString(),
      filters:{from:filters.from,to:filters.to,service:filters.service,search:filters.search},
      currency:'IRT',amountEncoding:'decimal-string',
      customers:customers.filter(c=>activeIds.has(c.id)),orders,opportunities,
      summary:summarize(orders,opportunities),
      quality:{excludedNonOrganizationOrders:rawOrderSearch.length-rawOrders.length+normalizedOrders.excluded,excludedNonOrganizationOpportunities:rawOpportunitySearch.length-rawOpportunities.length+normalizedOpportunities.excluded,
        unmappedOrderServices:orders.filter(r=>r.service==='unmapped').length,
        unmappedOpportunityServices:opportunities.filter(r=>r.service==='unmapped').length,
        unmappedOpportunityStages:opportunities.filter(r=>r.stage==='unmapped').length},
      definitions:{revenue:'ارزش نهایی فاکتورهای فروش در همه وضعیت‌ها؛ بدون کسر برگشت از فروش، معادل درآمد حسابداری نیست.',
        conversion:'برنده‌شده تقسیم بر مجموع برنده‌شده و از دست رفته؛ مراحل نگاشت‌نشده خارج از محاسبه‌اند.',
        date:'تاریخ میلادیِ فاکتور یا ایجاد فرصت، مطابق تاریخ ثبت‌شده در CRM.',
        scope:'خروجی محدود به هویت‌های حقوقی است؛ اشخاص، یادداشت‌ها و مشخصات بیماران در خروجی قرار نمی‌گیرند.',
        services:'فاکتور چندخدمتی در گروه mixed قرار می‌گیرد؛ هیچ تخصیص حدسی از مبلغ انجام نمی‌شود.'}
    };
    } catch(error) {
      if (error instanceof ApiError) throw error;
      if (signal.aborted) throw new ApiError(504, 'CRM_TIMEOUT', 'مهلت دریافت اطلاعات تمام شد؛ بازه کوتاه‌تری انتخاب کنید.');
      throw error;
    } finally { controller.abort();this.active--; }
  }
  async hydrate(kind, rows, signal) {
    const controller=new AbortController();
    const combined=AbortSignal.any([signal,controller.signal]);
    const output=new Array(rows.length);let next=0;let firstError;
    const workers=Array.from({length:Math.min(4,rows.length)},async()=>{
      try {
        while(next<rows.length){const i=next++;combined.throwIfAborted();output[i]=await this.client.get(kind,rows[i].CrmId,combined);}
      } catch(error) {firstError ??= error;controller.abort();throw error;}
    });
    await Promise.allSettled(workers);
    if(firstError)throw firstError;
    return output;
  }
}
