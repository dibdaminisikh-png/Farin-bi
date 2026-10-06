import {ApiError} from './errors.js';
export const SERVICE_IDS = ['implant', 'guide', 'ortho', 'cosmetic'];
export const STAGE_IDS = ['lead', 'review', 'proposal', 'won', 'lost'];
const fail = name => { throw new Error(`Invalid server configuration: ${name}`); };
function mapping(env, name, allowed) {
  let value;
  try { value = JSON.parse(env[name] || '{}'); } catch { fail(name); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.entries(value).some(([key,v]) => !key || key.length > 128 || !allowed.includes(v))) fail(name);
  return value;
}
function integer(env, name, fallback, min, max) {
  const value = Number(env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) fail(name);
  return value;
}
export function loadConfig(env = process.env) {
  const token = env.FARIN_API_TOKEN || '';
  if (token.length < 32 || token.length > 256 || /\s/.test(token) || /replace|example|change.me/i.test(token)) fail('FARIN_API_TOKEN (generate a random token)');
  const url = new URL(env.PAYAMGOSTAR_BASE_URL || 'https://farinroshan.cloud.payamgostar.com');
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.cloud\.payamgostar\.com$/i.test(url.hostname) || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) fail('PAYAMGOSTAR_BASE_URL');
  const currency = env.PAYAMGOSTAR_CURRENCY || '';
  if (currency && !['IRR', 'IRT'].includes(currency)) fail('PAYAMGOSTAR_CURRENCY');
  const origin = env.FARIN_ALLOWED_ORIGIN || '';
  if (origin) {
    const u = new URL(origin);
    if (u.protocol !== 'https:' || u.origin !== origin || u.username || u.password) fail('FARIN_ALLOWED_ORIGIN');
  }
  return {
    token, baseUrl: url.origin, currency, allowedOrigin: origin,
    username: env.PAYAMGOSTAR_USERNAME || '', password: env.PAYAMGOSTAR_PASSWORD || '',
    organizationTypeKey: env.PAYAMGOSTAR_ORGANIZATION_TYPE_KEY || '',
    invoiceTypeKey: env.PAYAMGOSTAR_INVOICE_TYPE_KEY || '', opportunityTypeKey: env.PAYAMGOSTAR_OPPORTUNITY_TYPE_KEY || '',
    productMap: Object.fromEntries(Object.entries(mapping(env, 'PAYAMGOSTAR_PRODUCT_SERVICE_MAP', SERVICE_IDS)).map(([k,v])=>[k.toLowerCase(),v])),
    stageMap: mapping(env, 'PAYAMGOSTAR_STAGE_MAP', STAGE_IDS),
    port: integer(env, 'PORT', 8787, 1, 65535), host: env.HOST || '127.0.0.1',
    timeoutMs: integer(env, 'CRM_TIMEOUT_MS', 15000, 100, 60000),
    maxRecords: integer(env, 'CRM_MAX_RECORDS', 200, 1, 2000),
    maxBytes: integer(env, 'CRM_MAX_RESPONSE_BYTES', 8388608, 1024, 16777216),
    rateLimit: integer(env, 'API_RATE_LIMIT', 60, 1, 1000)
  };
}
export function isConfigured(config) { return Boolean(config.username && config.password && config.currency); }
export function requireConfigured(config) {
  if (!isConfigured(config)) throw new ApiError(503, 'CRM_NOT_CONFIGURED', 'اتصال پیام‌گستر هنوز پیکربندی نشده است.');
}
