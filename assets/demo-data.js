// Deterministic fictional fixtures. Amounts are integer millions of tomans.
export const services = [
  {id:'implant',label:'ایمپلنت اختصاصی',color:'#005098',base:140},
  {id:'guide',label:'گاید جراحی',color:'#b58c56',base:28},
  {id:'ortho',label:'ارتوگناتیک',color:'#6489a6',base:65},
  {id:'cosmetic',label:'پروتز زیبایی',color:'#8c9ba7',base:48}
];
export const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور'];
export const clients = ['مرکز نمونه آفتاب','کلینیک نمونه سپید','مرکز نمونه مهر','کلینیک نمونه پارس','مرکز نمونه نوین','کلینیک نمونه سلامت','مرکز نمونه امید','کلینیک نمونه باران'].map((name,i)=>({id:i,name,city:['تهران','اصفهان','شیراز','مشهد','تبریز','تهران','رشت','یزد'][i]}));
export const orders = [];
export const opportunities = [];
for (const era of ['previous','current']) for(let month=1;month<=6;month++) {
  const count=era==='current'?14+month*2:12+month*2;
  for(let i=0;i<count;i++) {
    const service=services[(i+month)%4];
    orders.push({id:`${era==='current'?'D':'P'}-${month}${String(i+1).padStart(2,'0')}`,era,month,day:1+(i*3)%28,clientId:(i+month)%8,service:service.id,amount:service.base+(i%5)*4+month*2,status: ['در حال طراحی','تأیید شده','تحویل شده','در انتظار تأیید'][i%4],owner:`کارشناس ${i%3+1}`});
  }
  for(let i=0;i<16+month;i++) {
    const service=services[(i+month)%4];
    opportunities.push({id:`O-${era}-${month}-${i}`,era,month,service:service.id,clientId:(i+month)%8,amount:service.base+(i%5)*8,stage:['lead','review','proposal','won','lost'][i%5]});
  }
}
export const demoData = {orders,opportunities,clients};
