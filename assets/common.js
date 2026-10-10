'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Math.max(0,Number.isFinite(Number(v))?Number(v):0),today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()),fmt=(v,d=2)=>Number(v).toLocaleString('ja-JP',{maximumFractionDigits:d}),yen=v=>'¥'+fmt(v,0);
const report=s=>$('status').textContent=s;
function download(data,name,type='application/octet-stream'){const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function csvCell(v){let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
function csvDownload(rows,name){download('\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),name,'text/csv;charset=utf-8');}
function field(id,label,value='',type='text'){return `<label>${label}<input id="${id}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="any"':''}></label>`;}
function area(id,label,value=''){return `<label>${label}<textarea id="${id}">${esc(value)}</textarea></label>`;}
function select(id,label,options){return `<label>${label}<select id="${id}">${options.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>`;}
function btn(id,label,primary=false){return `<button id="${id}" ${primary?'class="primary"':''}>${label}</button>`;}
function metrics(values){return '<div class="summary">'+values.map(([k,v])=>`<div class="metric"><span>${k}</span><strong>${v}</strong></div>`).join('')+'</div>';}
function bindInputs(ids,fn){ids.forEach(id=>$(id).addEventListener('input',fn));}
function backupControls(key,get,set){const box=document.createElement('div');box.className='actions no-print';box.innerHTML=btn('saveDraft','下書き保存')+btn('loadDraft','下書き読込')+btn('exportJson','バックアップ保存')+btn('importJson','バックアップ読込')+'<input id="jsonFile" type="file" accept=".json,application/json" hidden>';$('app').append(box);
$('saveDraft').onclick=()=>{try{localStorage.setItem(key,JSON.stringify(get()));report('このブラウザに保存しました。');}catch{report('保存できませんでした。バックアップ保存をご利用ください。');}};
$('loadDraft').onclick=()=>{try{const raw=localStorage.getItem(key);if(!raw){report('保存データがありません。');return;}set(JSON.parse(raw));report('保存データを読み込みました。');}catch{report('保存データを読み込めませんでした。');}};
$('exportJson').onclick=()=>download(JSON.stringify(get(),null,2),key+'.json','application/json');$('importJson').onclick=()=>$('jsonFile').click();$('jsonFile').onchange=async()=>{try{const f=$('jsonFile').files[0];if(!f)return;if(f.size>3000000)throw Error();set(JSON.parse(await f.text()));report('バックアップを読み込みました。');}catch{report('このツールの正しい JSON バックアップを選択してください。');}finally{$('jsonFile').value='';}};}
function validRows(data,key,max=500){if(!data||!Array.isArray(data[key])||data[key].length>max)throw Error('Invalid data');return data[key];}
function safeFileName(s){return String(s).replace(/[\\/:*?"<>|]/g,'_').slice(0,100);}
const app=$('app');
