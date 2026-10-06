export const sum = rows => rows.reduce((total,r)=>total+r.amount,0);
export function selectData(data,period,service,era='current') {
 const start = {6:1,3:4,1:6}[period] || 1;
 const matches = r=>r.era===era && r.month>=start && (service==='all'||r.service===service);
 return {orders:data.orders.filter(matches),opportunities:data.opportunities.filter(matches)};
}
export function metrics(selection) {
 const {orders,opportunities}=selection;
 const won=opportunities.filter(r=>r.stage==='won').length;
 const closed=opportunities.filter(r=>['won','lost'].includes(r.stage)).length;
 return {revenue:sum(orders),orders:orders.length,clients:new Set(orders.map(r=>r.clientId)).size,conversion:closed?won/closed*100:null,open:sum(opportunities.filter(r=>!['won','lost'].includes(r.stage)))};
}
