import {ApiError} from './errors.js';
import {SERVICE_IDS} from './config.js';
const bad = () => { throw new ApiError(400, 'INVALID_FILTER', 'بازه تاریخ، خدمت یا پارامتر درخواست نامعتبر است.'); };
export function validDay(s) {
  return typeof s === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
}
export function parseFilters(params) {
  const allowed = ['from', 'to', 'service', 'search', 'page', 'pageSize'];
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) bad();
  const from = params.get('from'), to = params.get('to');
  if (!validDay(from) || !validDay(to)) bad();
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (days < 0 || days > 365) bad();
  const service = params.get('service') || 'all';
  if (!['all', ...SERVICE_IDS, 'mixed', 'unmapped'].includes(service)) bad();
  const search = params.get('search') || '';
  if (search.length > 100 || /[\x00-\x1f\x7f]/.test(search)) bad();
  const pageString = params.get('page') || '1', sizeString = params.get('pageSize') || '50';
  if (!/^\d{1,7}$/.test(pageString) || !/^\d{1,3}$/.test(sizeString)) bad();
  const page = Number(pageString), pageSize = Number(sizeString);
  if (page < 1 || pageSize < 1 || pageSize > 200) bad();
  return {from,to,service,search,page,pageSize};
}
export function crmDateQuery(field, {from,to}) {
  const next = new Date(Date.parse(to) + 86400000).toISOString().slice(0,10);
  return `${field} >= "${from}" && ${field} < "${next}"`;
}
export const normalizeSearch = value => value.replace(/ي/g,'ی').replace(/ك/g,'ک').trim().toLowerCase();
