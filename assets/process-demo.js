import {processDefinition} from './process-definition.js';
export {processDefinition};
// Only topology comes from the supplied description. Every case, person,
// timestamp, follow-up date and time target is synthetic; no patient information.
export const processAsOf='2026-10-07T09:00:00+03:30';
export const processPeople=[
  {id:'intake',name:'کارشناس نمونه پذیرش',role:'ثبت و بررسی مدارک'},
  {id:'finance',name:'کارشناس نمونه مالی',role:'پیش‌پرداخت و تسویه'},
  {id:'designer',name:'طراح نمونه ۱',role:'طراحی دیجیتال'},
  {id:'reviewer',name:'کارشناس نمونه بررسی',role:'کنترل طراحی و ساخت'},
  {id:'surgeon',name:'هماهنگ‌کننده نمونه جراح',role:'پیگیری تأیید جراح'},
  {id:'expert',name:'کارشناس دوم نمونه',role:'تأیید مستقل طراحی'},
  {id:'production',name:'مسئول نمونه ساخت',role:'مولاژ و پرینت'},
  {id:'quality',name:'کارشناس نمونه آزمایش',role:'کنترل و تست'},
  {id:'delivery',name:'کارشناس نمونه آماده‌سازی',role:'عکاسی، استریل و تحویل'},
  {id:'system',name:'سامانه',role:'اقدام خودکار؛ کارتابل انسانی ندارد'}
];
const assign={documents:'intake','document-review':'reviewer',prepayment:'finance','prepayment-wait':'finance',design:'designer','design-review':'reviewer',surgeon:'surgeon','second-expert':'expert',settlement:'finance','settlement-wait':'finance',mould:'production','mould-review':'reviewer',print:'production','print-review':'reviewer','print-approval':'expert',test1:'quality','test1-review':'reviewer','test1-approval':'expert',test2:'quality','test2-review':'reviewer','test2-approval':'expert',photo:'delivery',wash:'delivery',delivery:'delivery'};
const main=['documents','document-review','prepayment','financial-approve','design','design-review','surgeon','second-expert','settlement','mould','mould-review','print','print-review','print-approval','test1','test1-review','test1-approval','test2-decision','test2','test2-review','test2-approval','photo','wash','delivery','won','final'];
const until=node=>main.slice(0,main.indexOf(node)+1);
const examples=[
 {path:until('documents'),age:.25},
 {path:['documents','document-review','documents'],age:3,note:'مدارک ناقص؛ برگشت به ثبت مدارک، بدون پایان ناموفق.'},
 {path:until('document-review'),age:1},
 {path:until('prepayment'),age:4},
 {path:[...until('prepayment'),'prepayment-wait'],age:2,followUp:'2026-10-08T10:00:00+03:30'},
 {path:[...until('prepayment'),'prepayment-wait','prepayment-assign','prepayment','financial-approve','design'],age:2,note:'انتظار پیش‌فاکتور تمام شده و پرونده پس از پیگیری به طراحی رسیده است.'},
 {path:[...until('surgeon'),'design'],age:6,note:'عدم تأیید جراح؛ اصلاح طراحی لازم است. این پرونده شکست نخورده است.'},
 {path:until('design-review'),age:1},
 {path:until('surgeon'),age:2},
 {path:until('second-expert'),age:1},
 {path:until('settlement'),age:4},
 {path:[...until('settlement'),'settlement-wait'],age:5,followUp:'2026-10-09T10:00:00+03:30'},
 {path:[...until('mould-review'),'mould'],age:2},
 {path:[...until('print-approval'),'print-review'],age:3,note:'عدم تأیید پرینت اصلی، به بررسی پرینت برگشته است؛ هنوز به پرینت مجدد ارجاع نشده.'},
 {path:until('test1-approval'),age:1},
 {path:until('test2-review'),age:3,needsSecondTest:true},
 {path:[...until('test2-decision'),'photo'],age:1,needsSecondTest:false,note:'تست دوم طبق شرط نیاز نداشته؛ عبور مستقیم به عکاسی مسیر معتبر است.'},
 {path:until('wash'),age:.5,needsSecondTest:true},
 {path:[...until('test2-decision'),'photo','wash','delivery'],age:1,needsSecondTest:false},
 {path:main,age:2,needsSecondTest:true},
 {path:[...until('test2-decision'),'photo','wash','delivery','won','final'],age:3,needsSecondTest:false},
 {path:[...until('settlement'),'financial-reject','lost','final'],age:4,note:'لغو در پیگیری تسویه، رد مالی و پایان ناموفق؛ نهایی به معنی موفق نیست.'}
];
const dayMs=86400000;
export const processCases=examples.map((example,i)=>{
 const history=[];let cursor=Date.parse(processAsOf)-example.age*dayMs;
 for(let j=example.path.length-1;j>=0;j--){const stageId=example.path[j],node=processDefinition.stages.find(s=>s.id===stageId);const duration=['action','decision','status','end'].includes(node.kind)?.01:(.5+(i+j)%3*.5);
 const exitedAt=j===example.path.length-1?(node.terminal?new Date(cursor+.01*dayMs).toISOString():null):new Date(cursor+duration*dayMs).toISOString();
 history.unshift({id:`visit-${i+1}-${j+1}`,stageId,enteredAt:new Date(cursor).toISOString(),exitedAt,assigneeId:assign[stageId]||'system',transitionOutcome:example.path[j-1]?.endsWith('-wait')?'expire':null});
 if(j>0){const previousNode=processDefinition.stages.find(s=>s.id===example.path[j-1]);cursor-=(['action','decision','status','end'].includes(previousNode.kind)?.01:(.5+(i+j-1)%3*.5))*dayMs;}}
 return {id:`case-${String(i+1).padStart(2,'0')}`,reference:`نمونه ${String(i+1).padStart(2,'0')}`,title:`کیس آزمایشی ${i+1}`,service:['implant','guide','ortho','cosmetic'][i%4],clientId:i%8,createdAt:history[0].enteredAt,history,historyComplete:true,needsSecondTest:example.needsSecondTest??null,followUpAt:example.followUp||null,priority:[6,10,15].includes(i)?'high':'normal',note:example.note||'این کیس، مسئولان و زمان‌ها صرفاً برای آزمایش رابط کاربری ساخته شده‌اند.'};
});
export const processDemoData={definition:processDefinition,people:processPeople,cases:processCases,asOf:processAsOf,demo:true,connected:false};
