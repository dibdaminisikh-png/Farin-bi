export const fa = value => new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1}).format(value);
export const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const persianDigits = value => String(value).replace(/\d/g,n=>'۰۱۲۳۴۵۶۷۸۹'[Number(n)]);
export function formatDate(value,withTime=false) {
  if(value===null || value===undefined || !Number.isFinite(Date.parse(value)))return 'داده موجود نیست';
  return new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',year:'numeric',month:'long',day:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(new Date(value));
}
export const durationLabel = days => days<1/24?`${fa(days*1440)} دقیقه`:days<1?`${fa(days*24)} ساعت`:`${fa(days)} روز`;
