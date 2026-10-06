import {formatDate,durationLabel} from '../assets/ui-utils.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {processDemoData as data} from '../assets/process-demo.js';
import {validateProcessData,processMetrics,selectCases,currentVisit,stageFor,phaseFor,caseOutcome,returnCount,waitDays,phaseDays,elapsedDays} from '../assets/process-model.js';
import {ProcessWorkspace} from '../assets/process-workspace.js';
import {demoData} from '../assets/demo-data.js';
import {csvText} from '../assets/csv.js';
const copy=()=>structuredClone(data);
test('all representative histories obey supplied process topology and timestamps',()=>assert.equal(validateProcessData(data),data));
test('current unique cases and repeated entries are independent',()=>{
 const m=processMetrics(data,data.cases);assert.deepEqual([m.total,m.active,m.completed,m.failed,m.waiting,m.rework],[22,19,2,1,2,4]);
 const counts=data.definition.phases.map(p=>data.cases.filter(r=>phaseFor(data,r)?.id===p.id).length);assert.equal(counts.reduce((a,b)=>a+b,0),22);
 const r=data.cases[6];assert.equal(returnCount(data,r),1);assert.equal(r.history.filter(v=>v.stageId==='design').length,2);assert.equal(caseOutcome(data,r),'active');
});
test('stage and current workbasket differ, with independent duration',()=>{
 const r=data.cases[8];assert.equal(phaseFor(data,r).id,'design');assert.equal(stageFor(data,r).id,'surgeon');assert.ok(phaseDays(data,r)>elapsedDays(currentVisit(r),data.asOf));
});
test('common final node keeps success and failure distinct',()=>{
 for(const r of data.cases.slice(-3))assert.equal(stageFor(data,r).id,'final');
 assert.deepEqual(data.cases.slice(-3).map(r=>caseOutcome(data,r)),['won','won','lost']);assert.equal(selectCases(data,{scope:'closed'}).length,2);assert.equal(selectCases(data,{scope:'lost'}).length,1);
});
test('waits remain active and resumed waits return to their original basket',()=>{
 const waiting=selectCases(data,{scope:'waiting'});assert.equal(waiting.length,2);assert.ok(waiting.every(r=>caseOutcome(data,r)==='active'));
 const pre=data.cases[4],settle=data.cases[11];assert.equal(waitDays(data,pre,'prepayment'),2);assert.equal(waitDays(data,pre,'settlement'),0);assert.equal(waitDays(data,settle,'settlement'),5);
 const resumed=data.cases[5];assert.ok(resumed.history.some(v=>v.stageId==='prepayment-assign'));assert.equal(caseOutcome(data,resumed),'active');
 for(const id of ['prepayment-wait','settlement-wait'])assert.deepEqual(data.definition.transitions.filter(e=>e.from===id).map(e=>e.outcome),['expire','break']);
});
test('optional second-test bypass is valid and a contradictory branch is rejected',()=>{
 const r=data.cases[16];assert.equal(r.needsSecondTest,false);assert.ok(!r.history.some(v=>v.stageId==='test2'));assert.equal(stageFor(data,r).id,'photo');
 const broken=copy();broken.cases[16].needsSecondTest=true;assert.throws(()=>validateProcessData(broken),/second-test/);
});
test('main print approval rejects to review, not directly to printing',()=>{
 const r=data.cases[13];assert.equal(stageFor(data,r).id,'print-review');assert.equal(r.history.at(-2).stageId,'print-approval');
 const broken=copy();broken.cases[13].history.at(-1).stageId='print';assert.throws(()=>validateProcessData(broken),/handoff/);
});
test('missing audit data never fabricates wait, rework or phase durations',()=>{
 const r=structuredClone(data.cases[6]);r.historyComplete=false;r.history=[{...currentVisit(r),enteredAt:null}];assert.equal(returnCount(data,r),null);assert.equal(waitDays(data,r,'prepayment'),null);assert.equal(phaseDays(data,r),null);assert.equal(elapsedDays(currentVisit(r),data.asOf),null);
 const m=processMetrics(data,[r]);assert.equal(m.averageStageDays,null);assert.equal(m.knownDurationCount,0);
});
test('phase, basket, owner, service and Persian search filters agree with CSV and KPI totals',()=>{
 const w=new ProcessWorkspace(data,demoData.clients,()=>{});w.selectedStage='design';assert.equal(w.rows().length,5);assert.equal(w.csvRows().length-2,5);
 w.filters.service='ortho';const rows=w.rows();assert.ok(rows.every(r=>r.service==='ortho'&&phaseFor(data,r).id==='design'));assert.equal(w.csvRows().length-2,processMetrics(data,rows).total);
 assert.equal(selectCases(data,{search:'آزمایشی ۲۲'}).length,1);assert.equal(selectCases(data,{queue:'surgeon',owner:'surgeon'}).length,1);
});
test('case details show branch history and keep untrusted labels escaped',()=>{
 const changed=copy();changed.people[2].name='<script>alert(1)</script>';let content;const w=new ProcessWorkspace(changed,demoData.clients,html=>content=html);w.openCase('case-07');assert.ok(content.includes('بازگشت برای اصلاح'));assert.ok(content.includes('&lt;script&gt;'));assert.ok(!content.includes('<script>'));
 w.openCase('case-17');assert.ok(content.includes('عبور مستقیم'));w.openCase('case-22');assert.ok(content.includes('ناموفق'));
});
test('CSV includes BOM and quoted multiline values, and neutralizes spreadsheet formulas',()=>{
 const csv=csvText([['=1+1','a"b','line\nb']]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("\"'=1+1\""));assert.ok(csv.includes('"a""b"'));assert.ok(csv.includes('"line\nb"'));
});

test('unknown dates remain unknown and brief automatic steps are not inflated to one hour',()=>{assert.equal(formatDate(null),'داده موجود نیست');assert.equal(formatDate('invalid'),'داده موجود نیست');assert.match(durationLabel(.01),/دقیقه/);assert.match(durationLabel(2.5),/۲٫۵ روز/);});
