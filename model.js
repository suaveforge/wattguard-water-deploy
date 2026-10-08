const ASSETS = [
  {id:'P101',name:'취수펌프 P-101',area:'취수 시설',kind:'pump',order:1,values:{power:42.6,flow:310,pressure:3.8},units:{power:'kW',flow:'m³/h',pressure:'bar'}},
  {id:'P202',name:'송수펌프 P-202',area:'송수 계통',kind:'pump',order:2,values:{power:35.1,flow:268,pressure:4.2},units:{power:'kW',flow:'m³/h',pressure:'bar'}},
  {id:'D301',name:'배수펌프 D-301',area:'우수 배수',kind:'pump',order:3,values:{power:28.3,flow:240,pressure:2.5},units:{power:'kW',flow:'m³/h',pressure:'bar'}},
  {id:'G01',name:'비상발전기 G-01',area:'전원 계통',kind:'generator',order:4,values:{readiness:100,voltage:380},units:{readiness:'%',voltage:'V'}},
  {id:'L01',name:'배수지 수위 L-01',area:'저류 시설',kind:'reservoir',order:5,values:{level:3.2},units:{level:'m'}},
  {id:'R01',name:'하천 관측 R-01',area:'하천 관측',kind:'river',order:6,values:{level:2.1,rise:0.06},units:{level:'m',rise:'m/10분'}}
];
const SCENARIOS=[
{id:'brazil',title:'배수펌프 정지',case:'브라질 · 2024',tag:'가동 명령과 전력 불일치',explanation:'가동 명령은 유지되지만 전류 신호와 배수 유량이 나타나지 않는 상황을 가정합니다.',able:'정지 의심 설비와 후속 점검 대상을 빠르게 표시',limit:'폭우 피해와 원인을 소프트웨어만으로 예측하거나 해결하지 못함',patches:{D301:{power:0,flow:0,pressure:0.1,command:true,online:true}},code:'WG-R01',ref:'CASE-BR'},
{id:'gure',title:'사전 가동준비 실패',case:'구례 · 2025',tag:'전원 미공급',explanation:'폭우 전 점검 시점에 배수펌프의 전원 공급 상태가 준비되지 않은 상황을 가정합니다.',able:'점검 전에 전원·시험운전 미완료를 확인 대상으로 올림',limit:'전원선 자체를 연결하거나 실제 한전 수전 가능 여부를 대신 판단하지 못함',patches:{D301:{power:0,flow:0,pressure:0,command:false,supply:false,online:true}},code:'WG-R02',ref:'CASE-GU'},
{id:'sacheon',title:'주전원·예비전원',case:'사천 · 2026',tag:'주전원 이상 / 발전기 점검',explanation:'주전원 값이 끊기고 비상발전기 시험 이력에 문제가 있는 별도 가상 상황입니다.',able:'주전원·예비전원 신호를 함께 보여 현장 확인 순서를 안내',limit:'실제 사천 사고 당시 발전기 센서 이력이나 결함을 알고 있다는 뜻이 아님',patches:{P202:{power:0,flow:0,pressure:0.5,command:true,supply:false,online:true},G01:{readiness:38,voltage:0,testFailed:true,online:true},L01:{level:1.8}},code:'WG-R03',ref:'CASE-SA'},
{id:'nepal',title:'수위 급상승 감시',case:'네팔 · 2026',tag:'외부 수문센서 연동 가정',explanation:'연동된 수위센서가 평소보다 빠른 상승을 관측하는 가상 데이터입니다.',able:'수위·상승속도와 경보 기준의 차이를 한눈에 보여줌',limit:'빙하 붕괴 자체나 재난 발생 시점의 예측 기능이 아님',patches:{R01:{level:5.4,rise:1.2}},code:'WG-R04',ref:'CASE-NE'},
{id:'normal',title:'정상 운전',case:'기준 상태',tag:'전체 설비 정상',explanation:'모든 설비가 시연용 정상 범위에서 운전되는 데이터입니다.',able:'정상 패턴과 경보 발생 상태의 차이를 비교',limit:'실제 시설 안전이나 시스템 탐지성능을 보장하지 않음',patches:{},code:'',ref:''}
];

const fmt=(x)=> typeof x==='number'?x.toLocaleString('ko-KR',{maximumFractionDigits:2}):x;
function evaluateAsset(asset){
 const a={...asset,status:'normal',rule:'',reason:'시연 기준 범위',difference:'',evidence:null};
 const v=a.values;
 // A failed sensor must NOT be converted into a zero reading or a NORMAL state.
 if(v.online===false || (a.kind==='pump' && (v.power==null || v.flow==null))){
   return {...a,status:'unknown',rule:'WG-DATA',reason:'계측 데이터가 없어 상태 판정을 보류합니다.',difference:'데이터 없음 · 통신/센서 확인',evidence:null};
 }
 if(a.kind==='pump' && v.supply===false){
   return a.id==='P202'
    ? {...a,status:'danger',rule:'WG-R03',reason:'가동 명령 ON · 주전원 공급 안 됨 · 계측 전력 0 kW',difference:'주전원 공급 상태 확인 필요',evidence:'RULE-02'}
    : {...a,status:'danger',rule:'WG-R02',reason:'전원 공급 준비 실패 · 펌프 시험운전 불가',difference:'전원 확인 실패',evidence:'RULE-02'};
 }
 if(a.kind==='pump' && v.command===true && v.power<=0.5 && v.flow<=3){
   return {...a,status:'danger',rule:'WG-R01',reason:'가동 명령 ON · 전력 0 kW · 유량 0 m³/h',difference:'가동 명령과 계측 신호 불일치',evidence:'RULE-01'};
 }
 if(a.kind==='generator' && v.testFailed===true){
   return {...a,status:'watch',rule:'WG-R03',reason:'비상발전기 시험 상태 확인 필요',difference:'시연 준비도 '+v.readiness+'%',evidence:'RULE-02'};
 }
 if(a.kind==='reservoir' && v.level<2.2){
   return {...a,status:'watch',rule:'WG-R03',reason:'배수지 수위가 평소보다 낮음',difference:'평소 3.2 m → '+v.level+' m',evidence:'RULE-02'};
 }
 if(a.kind==='river' && v.level>4 && v.rise>0.7){
   return {...a,status:'danger',rule:'WG-R04',reason:'수위 '+v.level+' m · 10분 상승량 '+v.rise+' m',difference:'가정된 시연 임계값 초과',evidence:'RULE-03'};
 }
 return a;
}
function derive(sid='brazil'){
 const scenario=SCENARIOS.find(x=>x.id===sid)||SCENARIOS[0];
 const assets=ASSETS.map(a=>evaluateAsset({...a,values:{...a.values,...(scenario.patches[a.id]||{})}}));
 const counts={danger:assets.filter(x=>x.status==='danger').length,watch:assets.filter(x=>x.status==='watch').length,unknown:assets.filter(x=>x.status==='unknown').length,normal:assets.filter(x=>x.status==='normal').length};
 const alerts=assets.filter(x=>x.status!=='normal').sort((a,b)=>({danger:0,unknown:1,watch:2}[a.status])-({danger:0,unknown:1,watch:2}[b.status]));
 return {scenario,assets,counts,alerts,priority:alerts[0]||null};
}
function graphSeries(asset,scenarioId){const base=ASSETS.find(x=>x.id===asset.id);let key=asset.kind==='pump'?'power':asset.kind==='generator'?'readiness':'level';const ordinary=base.values[key],current=asset.values[key];if(!Number.isFinite(current)||!Number.isFinite(ordinary))return {key,arr:[]};const arr=Array.from({length:22},(_,i)=>({t:i,baseline:ordinary*(1+0.025*Math.sin(i*.7)),actual:i<14?ordinary*(1+0.02*Math.sin(i*.7+1)):ordinary+(current-ordinary)*Math.min(1,(i-13)/3)}));return {key,arr};}


