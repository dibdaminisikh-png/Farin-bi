// Topology transcribed from the user's supplied process description, not fetched
// from CRM. CRM GUIDs must be mapped on the authenticated backend before live use.
const phases=[
  ['documents','ثبت و بررسی مدارک','مرحله ثبت مدارک','files'],
  ['prepayment','پیش‌فاکتور و پیش‌پرداخت','مرحله صدور پیش فاکتور و بررسی پیش پرداخت','wallet'],
  ['design','طراحی و تأییدها','مزحله طراحی','design'],
  ['settlement','پیگیری تسویه','مرحله پیگیری تسویه','wallet'],
  ['mould','ساخت و بررسی مولاژ','مرحله مولاژ','build'],
  ['print','پرینت و تأیید پروتز','مرحله پرینت','build'],
  ['test1','تست اول','مرحله تست یک','shield'],
  ['test2','تست دوم','مرحله تست دو','shield'],
  ['photo','عکاسی','مرحله عکاسی','camera'],
  ['wash','شستشو و استریل','مرحله شتستشو','shield'],
  ['delivery','تحویل','مرحله تحویل','truck'],
  ['won','پایان موفق','موفق','flag'],
  ['lost','پایان ناموفق','مرحله ناموفق','close']
].map(([id,label,sourceLabel,icon])=>({id,label,sourceLabel,icon,optional:id==='test2'}));
const nodes=[
  ['documents','ثبت مدارک','documents','task',2,'پذیرش'],
  ['document-review','بررسی مدارک','documents','task',2,'بررسی مدارک'],
  ['prepayment','صدور پیش‌فاکتور و بررسی پیش‌پرداخت','prepayment','task',3,'مالی'],
  ['prepayment-wait','انتظار پیش‌فاکتور','prepayment','wait',null,'انتظار'],
  ['prepayment-assign','تخصیص مقدار پیش‌فاکتور','prepayment','action',null,'سامانه'],
  ['financial-approve','مالی - تأیید آیتم','prepayment','action',null,'سامانه'],
  ['financial-reject','مالی - رد آیتم',null,'action',null,'سامانه'],
  ['design','طراحی','design','task',5,'طراحی'],
  ['design-review','بررسی طراحی','design','task',2,'کنترل طراحی'],
  ['surgeon','تأیید جراح','design','task',3,'هماهنگی جراح'],
  ['second-expert','تأییدیه کارشناس دوم','design','task',2,'کارشناس دوم'],
  ['settlement','پیگیری تسویه','settlement','task',3,'مالی'],
  ['settlement-wait','انتظار تسویه','settlement','wait',null,'انتظار'],
  ['settlement-assign','تخصیص مقدار','settlement','action',null,'سامانه'],
  ['mould','مولاژ','mould','task',3,'ساخت'],
  ['mould-review','بررسی مولاژ','mould','task',2,'کنترل ساخت'],
  ['print','پرینت پروتز','print','task',4,'ساخت'],
  ['print-review','بررسی پرینت پروتز','print','task',2,'کنترل ساخت'],
  ['print-approval','تأییدیه پرینت اصلی','print','task',2,'کنترل ساخت'],
  ['test1','تست یک','test1','task',2,'آزمایش'],
  ['test1-review','بررسی تست یک','test1','task',2,'کنترل آزمایش'],
  ['test1-approval','تأییدیه تست یک','test1','task',2,'کنترل آزمایش'],
  ['test2-decision','تصمیم تست دو','test1','decision',null,'سامانه'],
  ['test2','تست دو','test2','task',2,'آزمایش'],
  ['test2-review','بررسی تست دو','test2','task',2,'کنترل آزمایش'],
  ['test2-approval','تأییدیه تست دو','test2','task',2,'کنترل آزمایش'],
  ['photo','عکاسی','photo','task',2,'آماده‌سازی'],
  ['wash','شستشو و استریل','wash','task',2,'آماده‌سازی'],
  ['delivery','تحویل','delivery','task',2,'ارسال'],
  ['won','موفق','won','status',null,'سامانه'],
  ['lost','مرحله ناموفق','lost','status',null,'سامانه'],
  ['final','نهایی',null,'end',null,'سامانه']
].map(([id,label,phaseId,kind,targetDays,department])=>({id,label,phaseId,kind,targetDays,department,terminal:kind==='end',icon:phases.find(p=>p.id===phaseId)?.icon || 'flow'}));
const transitions=[];
const edge=(from,to,label,kind='forward',extra={})=>transitions.push({from,to,label,kind,...extra});
edge('documents','document-review','ارجاع جهت بررسی مدارک');edge('documents','lost','کنسلی درخواست/ پایان','cancel');
edge('document-review','documents','ارجاع جهت اصلاح/ مدارک ناقص است','return');edge('document-review','prepayment','تأیید مدارک');
edge('prepayment','financial-approve','تایید پیش پرداخت');edge('financial-approve','design','تأیید مالی');
edge('prepayment','prepayment-wait','انتظار','wait');
for(const outcome of ['expire','break'])edge('prepayment-wait','prepayment-assign',outcome,'resume',{outcome});
edge('prepayment-assign','prepayment','پیگیری مجدد');edge('prepayment','financial-reject','کنسلی درخواست/پایان','cancel');
edge('design','design-review','طراحی انجام شد');edge('design-review','surgeon','تایید');edge('design-review','design','عدم تایید','return');
edge('surgeon','second-expert','تایید جراح');edge('surgeon','design','عدم تایید جراح','return');
edge('second-expert','settlement','تایید');edge('second-expert','design','عدم تایید','return');
edge('settlement','mould','تسویه انجام شد');edge('settlement','settlement-wait','انتظار','wait');
for(const outcome of ['expire','break'])edge('settlement-wait','settlement-assign',outcome,'resume',{outcome});
edge('settlement-assign','settlement','پیگیری مجدد');edge('settlement','financial-reject','کنسلی درخواست/پایان','cancel');edge('financial-reject','lost','رد مالی');
edge('mould','mould-review','مولاژ تولید شد');edge('mould-review','mould','عدم تایید','return');edge('mould-review','print','تایید');
edge('print','print-review','پروتز پرینت شد');edge('print-review','print','عدم تایید','return');edge('print-review','print-approval','ارجاع جهت بررسی');
edge('print-approval','print-review','عدم تایید','return');edge('print-approval','test1','تایید');
edge('test1','test1-review','تست یک انجام شد');edge('test1-review','test1','عدم تایید','return');edge('test1-review','test1-approval','تایید');
edge('test1-approval','test1-review','عدم تایید','return');edge('test1-approval','test2-decision','تایید');
edge('test2-decision','test2','بله؛ نیاز به تست دوم','conditional',{condition:true});edge('test2-decision','photo','نیاز به تست دوم ندارد','conditional',{condition:false});
edge('test2','test2-review','تست دو انجام شد');edge('test2-review','test2','عدم تایید','return');edge('test2-review','test2-approval','تایید');
edge('test2-approval','test2-review','عدم تایید','return');edge('test2-approval','photo','تایید');
edge('photo','wash','عکاسی انجام شد');edge('wash','delivery','انجام شد');edge('delivery','won','تحویل داده شد/پایان');edge('won','final','پایان');edge('lost','final','پایان');
export const processDefinition={id:'40bae1c6-7eba-4c3c-904d-243088fe6ef1',name:'فرصت طراحی',provenance:'user-supplied-description',targetProvenance:'fictional-demo',version:2,phases,stages:nodes,transitions,
  sourceFields:{needsSecondTest:'نیار به تست دوم دارد؟',prepaymentFollowUp:'تاریخ پیگیری پیش فاکتور',settlementFollowUp:'تاریخ پیگیری تسویه'},
  waits:{'prepayment-wait':{field:'تاریخ پیگیری پیش فاکتور',extraHours:0},'settlement-wait':{field:'تاریخ پیگیری تسویه',extraHours:0}}};
