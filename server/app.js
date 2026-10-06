import {createServer} from 'node:http';
import {createHash, timingSafeEqual, randomUUID} from 'node:crypto';
import {ApiError} from './errors.js';
import {isConfigured} from './config.js';
import {parseFilters} from './filters.js';
const digest = value => createHash('sha256').update(value).digest();
const protectedRoutes = ['/api/v1/status','/api/v1/dashboard','/api/v1/customers','/api/v1/orders','/api/v1/opportunities'];
export function createApiServer(config, service, {now=Date.now}={}) {
  const tokenHash=digest(config.token),buckets=new Map();let lastSweep=0;
  return createServer({maxHeaderSize:8192,requestTimeout:10000,headersTimeout:5000},async(req,res)=>{
    const requestId=randomUUID();
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');res.setHeader('Pragma','no-cache');
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Request-ID',requestId);
    const send=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
    try {
      if(req.headers['content-length'] && req.headers['content-length']!=='0' || req.headers['transfer-encoding']) throw new ApiError(400,'BODY_NOT_ALLOWED','این API فقط درخواست بدون بدنه می‌پذیرد.');
      const origin=req.headers.origin;
      if(origin && (!config.allowedOrigin || origin!==config.allowedOrigin)) throw new ApiError(403,'ORIGIN_NOT_ALLOWED','مبدأ درخواست مجاز نیست.');
      if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      const clock=now();
      if(clock-lastSweep>60000){for(const [k,b] of buckets)if(b.reset<=clock)buckets.delete(k);lastSweep=clock;}
      // Use the actual socket peer; never trust arbitrary X-Forwarded-For.
      const peer=req.socket.remoteAddress||'unknown';let bucket=buckets.get(peer);
      if(!bucket || bucket.reset<=clock){if(buckets.size>=10000){throw new ApiError(429,'RATE_LIMITED','تعداد درخواست‌ها بیش از حد مجاز است.');}bucket={count:0,reset:clock+60000};buckets.set(peer,bucket);}
      if(++bucket.count>config.rateLimit){res.setHeader('Retry-After',String(Math.ceil((bucket.reset-clock)/1000)));throw new ApiError(429,'RATE_LIMITED','تعداد درخواست‌ها بیش از حد مجاز است.');}
      const url=new URL(req.url,'http://localhost');
      if(req.method==='OPTIONS' && protectedRoutes.includes(url.pathname)) {
        if(!origin)throw new ApiError(403,'ORIGIN_NOT_ALLOWED','مبدأ درخواست مجاز نیست.');
        res.setHeader('Access-Control-Allow-Methods','GET');res.setHeader('Access-Control-Allow-Headers','Authorization');res.writeHead(204);res.end();return;
      }
      if(req.method!=='GET'){res.setHeader('Allow','GET');throw new ApiError(405,'METHOD_NOT_ALLOWED','فقط دریافت اطلاعات مجاز است.');}
      if(url.pathname==='/healthz'){send(200,{ok:true});return;}
      if(!protectedRoutes.includes(url.pathname))throw new ApiError(404,'NOT_FOUND','مسیر پیدا نشد.');
      const header=req.headers.authorization||'';
      const token=/^Bearer ([^\s]{32,256})$/.exec(header)?.[1]||'';
      if(!timingSafeEqual(digest(token),tokenHash)){res.setHeader('WWW-Authenticate','Bearer');throw new ApiError(401,'UNAUTHORIZED','دسترسی معتبر برای API لازم است.');}
      if(url.pathname==='/api/v1/status') {
        if(url.search)throw new ApiError(400,'INVALID_FILTER','این مسیر پارامتر ندارد.');
        send(200,{configured:isConfigured(config),connectionVerified:false,state:isConfigured(config)?'configured-unverified':'not-configured',powerBiConnected:false});return;
      }
      const filters=parseFilters(url.searchParams);
      const snapshot=await service.snapshot(filters);
      if(url.pathname==='/api/v1/dashboard'){send(200,snapshot);return;}
      const key=url.pathname.split('/').at(-1),rows=snapshot[key];const offset=(filters.page-1)*filters.pageSize;
      send(200,{schemaVersion:1,source:snapshot.source,demo:false,filters:snapshot.filters,currency:snapshot.currency,amountEncoding:snapshot.amountEncoding,fetchedAt:snapshot.fetchedAt,
        items:rows.slice(offset,offset+filters.pageSize),pagination:{page:filters.page,pageSize:filters.pageSize,total:rows.length},quality:snapshot.quality});
    } catch(error) {
      // No error stacks, CRM error details or secret values in responses/logs.
      const known=error instanceof ApiError;
      send(known?error.status:500,{error:{code:known?error.code:'INTERNAL_ERROR',message:known?error.message:'خطای داخلی سرویس.',requestId}});
    }
  });
}
