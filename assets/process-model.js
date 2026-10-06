// Pure domain logic shared by the demo UI and a future authenticated adapter.
const dayMs=86400000;
export const currentVisit=record=>record.history.at(-1);
export const stageFor=(data,record)=>data.definition.stages.find(s=>s.id===currentVisit(record).stageId);
export const personFor=(data,id)=>data.people.find(p=>p.id===id);
export const previousVisit=record=>record.history.at(-2)||null;
export function phaseAt(data,record,index=record.history.length-1){
 for(let i=index;i>=0;i--){const node=data.definition.stages.find(s=>s.id===record.history[i].stageId);if(node?.phaseId)return data.definition.phases.find(p=>p.id===node.phaseId);}
 return null;
}
export const phaseFor=(data,record)=>phaseAt(data,record);
export function caseOutcome(data,record){
 if(!stageFor(data,record).terminal)return 'active';
 const phase=phaseFor(data,record);return phase?.id==='won'?'won':phase?.id==='lost'?'lost':'unknown';
}
export function elapsedDays(visit,asOf){
 const start=Date.parse(visit?.enteredAt),end=Date.parse(visit?.exitedAt||asOf);
 return Number.isFinite(start)&&Number.isFinite(end)?Math.max(0,(end-start)/dayMs):null;
}
export function phaseDays(data,record){
 if(!record.historyComplete)return null;
 const phase=phaseFor(data,record);let start=record.history.length-1;
 while(start>0&&phaseAt(data,record,start-1)?.id===phase?.id)start--;
 return elapsedDays({enteredAt:record.history[start].enteredAt,exitedAt:currentVisit(record).exitedAt},data.asOf);
}
export function overdueDays(data,record){
 const node=stageFor(data,record),elapsed=elapsedDays(currentVisit(record),data.asOf);
 return !node.terminal&&node.targetDays!==null&&elapsed!==null?Math.max(0,elapsed-node.targetDays):0;
}
export function returnCount(data,record){
 if(!record.historyComplete)return null;
 return record.history.slice(1).filter((v,i)=>data.definition.transitions.some(e=>e.from===record.history[i].stageId&&e.to===v.stageId&&e.kind==='return')).length;
}
export function waitDays(data,record,phaseId){
 if(!record.historyComplete)return null;
 return record.history.filter(v=>{const node=data.definition.stages.find(s=>s.id===v.stageId);return node.kind==='wait'&&(!phaseId||node.phaseId===phaseId);}).reduce((n,v)=>n+elapsedDays(v,data.asOf),0);
}
const normalize=value=>String(value).replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).trim().toLowerCase();
export function selectCases(data,filters={}){
 return data.cases.filter(record=>{
 const node=stageFor(data,record),owner=personFor(data,currentVisit(record).assigneeId),outcome=caseOutcome(data,record);
 const text=`${record.reference} ${record.title} ${owner?.name||''} ${node.label} ${phaseFor(data,record)?.label||''} ${filters.clientName?.(record.clientId)||''}`;
 return (!filters.service||filters.service==='all'||record.service===filters.service)&&(!filters.owner||filters.owner==='all'||owner?.id===filters.owner)&&
 (!filters.stage||phaseFor(data,record)?.id===filters.stage)&&(!filters.queue||filters.queue==='all'||node.id===filters.queue)&&
 (!filters.search||normalize(text).includes(normalize(filters.search)))&&
 (filters.scope!=='attention'||overdueDays(data,record)>0)&&(filters.scope!=='active'||outcome==='active')&&
 (filters.scope!=='closed'||outcome==='won')&&(filters.scope!=='lost'||outcome==='lost')&&
 (filters.scope!=='waiting'||node.kind==='wait')&&(filters.scope!=='rework'||returnCount(data,record)>0);
 });
}
export function processMetrics(data,records){
 const active=records.filter(r=>caseOutcome(data,r)==='active'),known=active.map(r=>elapsedDays(currentVisit(r),data.asOf)).filter(v=>v!==null);
 return {total:records.length,active:active.length,attention:active.filter(r=>overdueDays(data,r)>0).length,completed:records.filter(r=>caseOutcome(data,r)==='won').length,
 failed:records.filter(r=>caseOutcome(data,r)==='lost').length,waiting:active.filter(r=>stageFor(data,r).kind==='wait').length,rework:records.filter(r=>returnCount(data,r)>0).length,
 averageStageDays:known.length?known.reduce((a,b)=>a+b,0)/known.length:null,knownDurationCount:known.length};
}
export function validateProcessData(data){
 if(!data?.definition?.stages?.length||!Number.isFinite(Date.parse(data.asOf)))throw new Error('Invalid workflow definition');
 const nodes=new Set(data.definition.stages.map(s=>s.id)),people=new Set(data.people.map(p=>p.id)),phases=new Set(data.definition.phases.map(p=>p.id)),cases=new Set(),visits=new Set();
 if(nodes.size!==data.definition.stages.length||people.size!==data.people.length||phases.size!==data.definition.phases.length)throw new Error('Duplicate workflow identifier');
 for(const node of data.definition.stages){if(node.phaseId&&!phases.has(node.phaseId))throw new Error('Invalid phase');if(node.targetDays!==null&&(!Number.isFinite(node.targetDays)||node.targetDays<=0))throw new Error('Invalid sample target');}
 for(const edge of data.definition.transitions)if(!nodes.has(edge.from)||!nodes.has(edge.to))throw new Error('Unknown transition');
 for(const record of data.cases){
 if(cases.has(record.id)||!record.history.length)throw new Error('Invalid case');cases.add(record.id);
 record.history.forEach((visit,i)=>{
 const entered=Date.parse(visit.enteredAt),exit=visit.exitedAt?Date.parse(visit.exitedAt):null;
 if(visits.has(visit.id)||!nodes.has(visit.stageId)||!people.has(visit.assigneeId)||!Number.isFinite(entered)||entered>Date.parse(data.asOf)||exit!==null&&(!Number.isFinite(exit)||exit<entered||exit>Date.parse(data.asOf)))throw new Error('Invalid visit');visits.add(visit.id);
 if(i>0){const previous=record.history[i-1],edge=data.definition.transitions.find(e=>e.from===previous.stageId&&e.to===visit.stageId&&(!e.outcome||e.outcome===visit.transitionOutcome));
 if(!previous.exitedAt||Date.parse(previous.exitedAt)>entered||!edge)throw new Error('Invalid handoff');
 if(edge.kind==='conditional'&&edge.condition!==record.needsSecondTest)throw new Error('Invalid second-test branch');}
 if(i<record.history.length-1&&!visit.exitedAt)throw new Error('Unfinished past visit');});
 if(Boolean(currentVisit(record).exitedAt)!==Boolean(stageFor(data,record).terminal))throw new Error('Inconsistent completion');
 if(stageFor(data,record).terminal&&caseOutcome(data,record)==='unknown')throw new Error('Final node lacks outcome');
 }
 return data;
}
