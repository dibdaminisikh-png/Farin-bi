import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {processDemoData as data} from '../assets/process-demo.js';
import {demoData,services} from '../assets/demo-data.js';
import {validateProcessData,currentVisit,previousVisit,stageFor,phaseFor,phaseAt,caseOutcome,returnCount,waitDays} from '../assets/process-model.js';
validateProcessData(data);
const output=resolve(process.argv[2]||'powerbi/demo');await mkdir(output,{recursive:true});
// Machine-readable CSV: numeric values use invariant decimal format for import.
// Values are sourced solely from static fictional data. No CRM calls or secrets.
async function csv(name,columns,rows){
 const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 await writeFile(resolve(output,name+'.csv'),'\uFEFF'+[columns,...rows].map(r=>r.map(quote).join(',')).join('\n')+'\n');
}
await csv('FactCase',['CaseId','CaseLabel','CurrentPhaseId','CurrentNodeId','CurrentOwnerId','PreviousOwnerId','ServiceId','ClientId','CreatedAtUtc','CurrentEnteredAtUtc','Outcome','NeedsSecondTest','CompletedTest2','HistoryComplete','SampleTargetDays','PrepaymentWaitDays','SettlementWaitDays','ReturnCount'],data.cases.map(r=>{
 const v=currentVisit(r),p=previousVisit(r);
 return [r.id,r.title,phaseFor(data,r)?.id,v.stageId,v.assigneeId,p?.assigneeId,r.service,r.clientId,r.createdAt,v.enteredAt,caseOutcome(data,r),r.needsSecondTest,r.history.some((visit,i)=>visit.stageId==='photo'&&r.history[i-1]?.stageId==='test2-approval'),r.historyComplete,stageFor(data,r).targetDays,waitDays(data,r,'prepayment'),waitDays(data,r,'settlement'),returnCount(data,r)];
}));
await csv('FactVisit',['VisitId','CaseId','NodeId','PhaseId','OwnerId','EnteredAtUtc','ExitedAtUtc','TransitionKind','TransitionOutcome'],data.cases.flatMap(r=>r.history.map((v,i)=>{
 const p=r.history[i-1],edge=p?data.definition.transitions.find(e=>e.from===p.stageId&&e.to===v.stageId&&(!e.outcome||e.outcome===v.transitionOutcome)):null;
 return [v.id,r.id,v.stageId,phaseAt(data,r,i)?.id,v.assigneeId,v.enteredAt,v.exitedAt,edge?.kind||'start',edge?.outcome||edge?.label||''];
})));
await csv('DimPhase',['PhaseId','DisplayLabel','SourceLabel','BusinessOrder','Optional'],data.definition.phases.map((p,i)=>[p.id,p.label,p.sourceLabel,i+1,Boolean(p.optional)]));
await csv('DimNode',['NodeId','PhaseId','DisplayLabel','Kind','SampleTargetDays'],data.definition.stages.map(n=>[n.id,n.phaseId,n.label,n.kind,n.targetDays]));
await csv('DimOwner',['OwnerId','DisplayLabel','Role'],data.people.map(p=>[p.id,p.name,p.role]));
await csv('DimService',['ServiceId','DisplayLabel'],services.map(s=>[s.id,s.label]));
await csv('DimClient',['ClientId','DisplayLabel','City'],demoData.clients.map(c=>[c.id,c.name,c.city]));
await csv('Snapshot',['AsOfUtc','Demo','Connected'],[[new Date(data.asOf).toISOString(),true,false]]);
console.log('Exported 8 fictional Power BI CSV tables to '+output);
