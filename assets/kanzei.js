'use strict';
// 輸入関税・消費税 概算（税関カスタムスアンサー1111「関税、消費税等の税額計算方法」を参考にした単一申告欄の概算）
const CUR=[['USD','USD 米ドル'],['EUR','EUR ユーロ'],['CNY','CNY 人民元'],['GBP','GBP 英ポンド'],['AUD','AUD 豪ドル'],['KRW','KRW 韓国ウォン'],['THB','THB タイバーツ'],['VND','VND ベトナムドン'],['TWD','TWD 台湾ドル'],['HKD','HKD 香港ドル'],['SGD','SGD シンガポールドル'],['JPY','JPY 日本円']];
const floorTo=(v,u)=>Math.floor(v/u)*u;
function validateImportParams(p){
  if(!CUR.some(([c])=>c===p.currency)||!['FOB','CFR','CIF'].includes(p.term)||!['FC','JPY'].includes(p.freightCur)||!['auto','manual','none'].includes(p.insMode))throw Error('輸入条件を確認してください。');
  const keys=['amount','qty','dutyRate','brokerFee','delivery','otherCost'];
  if(p.currency!=='JPY')keys.push('rate');
  if(p.term==='FOB')keys.push('freight');
  if(p.term!=='CIF')keys.push(p.insMode==='auto'?'insRate':p.insMode==='manual'?'insAmount':'amount');
  for(const key of keys)if(!Number.isFinite(p[key])||p[key]<0||p[key]>Number.MAX_SAFE_INTEGER)throw Error('金額・料率は安全な範囲の0以上の数値で入力してください。');
  if(p.currency!=='JPY'&&p.rate<=0)throw Error('為替レートは0より大きい数値で入力してください。');
  if(!Number.isSafeInteger(p.qty))throw Error('数量は0以上の整数で入力してください（未入力・0は単価計算なし）。');
}
function calcImportTax(p){
  validateImportParams(p);
  const r=p.currency==='JPY'?1:p.rate,toYen=v=>v*r,frYen=v=>p.freightCur==='JPY'?v:toYen(v);
  let goods=toYen(p.amount),freight=0,ins=0;
  if(p.term!=='CIF'){freight=p.term==='FOB'?frYen(p.freight):0;
    if(p.insMode==='auto')ins=(goods+freight)*1.1*p.insRate/100;else if(p.insMode==='manual')ins=frYen(p.insAmount);}
  const cifCost=goods+freight+ins;
  if(!Number.isFinite(cifCost)||cifCost>Number.MAX_SAFE_INTEGER)throw Error('円換算額が計算可能な範囲を超えています。');
  const exempt=p.exemption==='confirmed';
  if(exempt&&cifCost>10000)throw Error('少額免税は課税価格合計1万円以下の場合のみ選択できます。');
  const cifRaw=Math.floor(cifCost);           // 円未満切捨て（申告価格）
  const taxable=floorTo(cifRaw,1000);                         // 課税価格：1,000円未満切捨て
  const dutyRaw=exempt?0:Math.floor(taxable*(p.dutyRate/100));
  const duty=floorTo(dutyRaw,100);                            // 関税額：100円未満切捨て
  const ctBase=floorTo(cifRaw+duty,1000);                     // 消費税課税標準：(端数処理前CIF+関税額)の1,000円未満切捨て
  const ctRate=p.reduced?6.24:7.8;
  const ctRaw=exempt?0:Math.floor(ctBase*(ctRate/100));
  const ct=floorTo(ctRaw,100);                                // 消費税額：100円未満切捨て
  const lctRaw=Math.floor(ct*22/78);
  const lct=floorTo(lctRaw,100);                              // 地方消費税額：100円未満切捨て
  const taxTotal=duty+ct+lct,other=p.brokerFee+p.delivery+p.otherCost,total=cifCost+taxTotal+other;
  if([goods,freight,ins,dutyRaw,duty,ctBase,ctRaw,ct,lctRaw,lct,taxTotal,other,total].some(v=>!Number.isFinite(v)||v>Number.MAX_SAFE_INTEGER))throw Error('計算結果が安全な範囲を超えています。入力を確認してください。');
  return {goods,freight,ins,cifCost,exempt,cifRaw,taxable,dutyRaw,duty,ctBase,ctRate,ctRaw,ct,lctRaw,lct,taxTotal,other,total,perUnit:p.qty>0?total/p.qty:null,perUnitExTax:p.qty>0?(cifCost+duty+other)/p.qty:null};
}
app.innerHTML='<section class="panel"><h2>輸入条件</h2><div class="grid">'
+field('item','品名（任意・印刷用）','')+select('term','価格条件',[['FOB','FOB（運賃・保険料を加算）'],['CFR','CFR / CNF（保険料を加算）'],['CIF','CIF（運賃・保険料込み）']])
+select('currency','通貨',CUR)+field('rate','為替レート（1通貨あたり円）',150,'number')
+field('amount','商品代金（インボイス金額）',10000,'number')+field('qty','数量（任意・単価計算用）','','number')+'</div>'
+'<div class="grid" id="fobBox">'+select('freightCur','運賃・保険料の通貨',[['FC','商品と同じ通貨'],['JPY','円']])+field('freight','運賃（輸入港まで）',0,'number')
+select('insMode','保険料',[['auto','自動概算（価格＋運賃）×110%×料率・実費ではありません'],['manual','手入力'],['none','付保なし（加算しない）']])+field('insRate','保険料率 %',0.3,'number')+field('insAmount','保険料（手入力）',0,'number')+'</div>'
+'<h2 style="margin-top:12px">税率</h2><div class="grid">'+field('dutyRate','関税率 %',5,'number')+select('ctType','消費税率',[['std','標準 10%（国税 7.8% + 地方 2.2%）'],['red','軽減 8%（国税 6.24% + 地方 1.76%・飲食料品）']])+'</div>'
+select('exemption','少額免税',[['unconfirmed','通常課税で試算（免税未確認）'],['confirmed','合計1万円以下・例外品目／合算規定に該当しないことを確認済み']])
+'<p class="hint">関税率は品目（HS コード）と原産国・EPA の適用で変わります。<a href="https://www.customs.go.jp/tariff/" target="_blank" rel="noopener">税関「実行関税率表」</a>で確認してください。為替は税関が公示する換算レート（週ごと）が使われます。</p>'
+'<h2 style="margin-top:12px">その他費用（任意・円）</h2><div class="grid">'+field('brokerFee','通関手数料',0,'number')+field('delivery','国内配送費',0,'number')+field('otherCost','その他（保管料・検査費など）',0,'number')+'</div>'
+'<div class="actions">'+btn('copy','結果をコピー')+btn('print','印刷 / PDF',true)+btn('reset','初期値に戻す')+'</div></section>'
+'<section class="paper"><h2>輸入関税・消費税 概算</h2><p id="cond" class="hint"></p><p id="taxNotice" class="hint"></p><div id="taxSummary"></div><div class="table-wrap"><table><thead><tr><th>項目</th><th>計算</th><th class="num">金額（円）</th></tr></thead><tbody id="breakdown"></tbody></table></div>'
+'<p class="hint" style="margin-top:16px">※ 単一申告欄・単一の従価関税率での概算です。複数品目・複数申告欄の結果を個別計算して合算する用途には対応しません。少額免税は適用確認済みを選択した場合のみ反映します。簡易税率の自動選択は行いません。総輸入コストの円換算には税額計算と同じレートを使用し、実際の決済レートとの差は反映しません。正確な税額は税関または通関業者にご確認ください。課税価格の合計が 1 万円以下の場合は原則として関税・消費税が免除され（一部品目を除く）、課税価格 20 万円以下の少額貨物では簡易税率が使われることがあります。酒税・たばこ税など他の内国消費税、従量税・アンチダンピング関税等には対応していません。</p></section>';
const ids=['item','term','currency','rate','amount','qty','freightCur','freight','insMode','insRate','insAmount','dutyRate','ctType','exemption','brokerFee','delivery','otherCost'];
const defaults=Object.fromEntries(ids.map(id=>[id,$(id).value]));
const inputLabels={amount:'商品代金',rate:'為替レート',qty:'数量',freight:'運賃',insRate:'保険料率',insAmount:'保険料',dutyRate:'関税率',brokerFee:'通関手数料',delivery:'国内配送費',otherCost:'その他費用'};
function readNumber(id){
  if(id==='rate'&&$('currency').value==='JPY')return 1;
  if(id==='freight'&&$('term').value!=='FOB')return 0;
  if((id==='insRate'||id==='insAmount')&&($('term').value==='CIF'||$('insMode').value!==(id==='insRate'?'auto':'manual')))return 0;
  const el=$(id),raw=el.value.trim();
  if(el.validity&&el.validity.badInput)throw Error(inputLabels[id]+'を数値で入力してください。');
  if(!raw){if(['amount','rate','dutyRate','insRate','insAmount'].includes(id))throw Error(inputLabels[id]+'を入力してください。');return 0;}
  const value=Number(raw);
  if(!Number.isFinite(value)||value<0)throw Error(inputLabels[id]+'は0以上の有限の数値で入力してください。');
  return value;
}
function params(){return {term:$('term').value,currency:$('currency').value,rate:readNumber('rate'),amount:readNumber('amount'),qty:readNumber('qty'),freightCur:$('freightCur').value==='JPY'?'JPY':'FC',freight:readNumber('freight'),insMode:$('insMode').value,insRate:readNumber('insRate'),insAmount:readNumber('insAmount'),dutyRate:readNumber('dutyRate'),reduced:$('ctType').value==='red',exemption:$('exemption').value,brokerFee:readNumber('brokerFee'),delivery:readNumber('delivery'),otherCost:readNumber('otherCost')};}
function vis(){const t=$('term').value,m=$('insMode').value;$('fobBox').hidden=t==='CIF';$('freight').closest('label').hidden=t!=='FOB';$('insRate').closest('label').hidden=m!=='auto';$('insAmount').closest('label').hidden=m!=='manual';$('rate').closest('label').hidden=$('currency').value==='JPY';}
let last=null;
function render(){vis();let p,r;try{p=params();r=calcImportTax(p);}catch(e){last=null;$('copy').disabled=true;$('print').disabled=true;$('cond').textContent='入力を確認してください。';$('taxNotice').textContent=e.message;$('taxSummary').innerHTML='';$('breakdown').innerHTML='';report(e.message);return false;}
$('copy').disabled=false;$('print').disabled=false;report('');last={p,r};const c=p.currency,y=v=>'¥'+fmt(v,2);
const notices=[r.exempt?'少額免税を適用（入力者による適用確認済み）。':'通常課税の試算です。少額免税は反映していません。'];
if(r.cifCost<=10000&&!r.exempt)notices.push('課税価格合計1万円以下：免税対象・例外品目・分割貨物の合算規定を確認してください。');
if(r.cifCost<=200000)notices.push('課税価格合計20万円以下：簡易税率の適用対象を確認し、該当税率を入力してください（自動選択なし）。');
if(p.dutyRate>100)notices.push('関税率が100%を超えています。税率と単位を再確認してください。');
$('taxNotice').textContent=notices.join(' ');
$('cond').textContent=[$('item').value.trim()&&('品名: '+$('item').value.trim()),`価格条件: ${p.term}`,`商品代金: ${fmt(p.amount)} ${c}`,c!=='JPY'?`レート: 1 ${c} = ${fmt(p.rate,4)} 円`:'',`関税率: ${fmt(p.dutyRate,3)}%`,`消費税: ${p.reduced?'軽減 8%':'標準 10%'}`,`計算日: ${today()}`].filter(Boolean).join('　/　');
$('taxSummary').innerHTML=metrics([[r.exempt?'免税適用後の税額':'通常課税の税額概算',y(r.taxTotal)],['総輸入コスト 概算',y(r.total)],...(r.perUnit!=null?[['1個あたり（税込コスト）',y(Math.round(r.perUnit))]]:[]),['CIF価格（端数処理前）',y(r.cifCost)]]);
const rows=[['商品代金（円換算）',c==='JPY'?'':`${fmt(p.amount)} ${c} × ${fmt(p.rate,4)}`,fmt(r.goods,2)]];
if(p.term==='FOB')rows.push(['運賃',p.freightCur==='JPY'?'円で入力':`${fmt(p.freight)} ${c} × ${fmt(p.rate,4)}`,fmt(r.freight,2)]);
if(p.term!=='CIF')rows.push(['保険料',p.insMode==='auto'?`(商品代金+運賃) × 110% × ${fmt(p.insRate,3)}%`:p.insMode==='manual'?'手入力':'付保なし',fmt(r.ins,2)]);
rows.push(['CIF価格（税額計算用）','円未満切捨て',fmt(r.cifRaw,0)],['① 関税課税標準','CIF 価格の 1,000 円未満切捨て',fmt(r.taxable,0)],['② 関税額',`${r.exempt?'免税適用・':''}① × ${fmt(p.dutyRate,3)}% = ${fmt(r.dutyRaw,0)} → 100 円未満切捨て`,fmt(r.duty,0)],['③ 消費税の課税標準',`CIF 価格（端数処理前）+ ② = ${fmt(r.cifRaw+r.duty,0)} → 1,000 円未満切捨て`,fmt(r.ctBase,0)],['④ 消費税額（国税）',`${r.exempt?'免税適用・':''}③ × ${r.ctRate}% = ${fmt(r.ctRaw,0)} → 100 円未満切捨て`,fmt(r.ct,0)],['⑤ 地方消費税額',`④ × 22/78 = ${fmt(r.lctRaw,0)} → 100 円未満切捨て`,fmt(r.lct,0)],['納付税額 合計','② + ④ + ⑤',fmt(r.taxTotal,0)]);
if(r.other)rows.push(['通関手数料・国内配送・その他',`${fmt(p.brokerFee,2)} + ${fmt(p.delivery,2)} + ${fmt(p.otherCost,2)}`,fmt(r.other,2)]);
rows.push(['総輸入コスト 概算','CIF価格（円未満を保持）+ 税額' +(r.other?' + その他費用':''),fmt(r.total,2)]);
if(r.perUnit!=null)rows.push([`1個あたり（数量 ${fmt(p.qty,0)}）`,`総輸入コスト ÷ 数量（消費税を除くと ${fmt(Math.round(r.perUnitExTax),0)} 円）`,fmt(Math.round(r.perUnit),0)]);
$('breakdown').innerHTML=rows.map(([a,b,v],i)=>`<tr${/合計|総輸入/.test(a)?' style="font-weight:700"':''}><td>${esc(a)}</td><td class="hint">${esc(b)}</td><td class="num">${v}</td></tr>`).join('');return true;}
$('qty').step='1';
let tried=false;ids.forEach(id=>{const el=$(id);el.addEventListener('input',()=>{render();if(!tried&&typeof window.iGenTradeRecordTry==='function'){tried=true;window.iGenTradeRecordTry();}});el.addEventListener('change',render);});
$('print').onclick=()=>{if(render())window.print();};
$('reset').onclick=()=>{ids.forEach(id=>$(id).value=defaults[id]);render();report('初期値に戻しました。');};
$('copy').onclick=async()=>{if(!render()||!last)return;const {r}=last;const s=`${$('cond').textContent}\nCIF価格（端数処理前）: ¥${fmt(r.cifCost,2)}\n関税課税標準: ${yen(r.taxable)}\n関税: ${yen(r.duty)}\n消費税: ${yen(r.ct)}\n地方消費税: ${yen(r.lct)}\n納付税額合計: ${yen(r.taxTotal)}\n総輸入コスト概算: ¥${fmt(r.total,2)}${r.perUnit!=null?`\n1個あたり: ${yen(Math.round(r.perUnit))}`:''}\n${$('taxNotice').textContent}\n※単一申告欄の概算・参考値。複数申告欄の合算には非対応。正確な税額は税関・通関業者にご確認ください。`;try{await navigator.clipboard.writeText(s);report('結果をコピーしました。');}catch{report('コピーできませんでした。');}};
render();
if(typeof module!=='undefined')module.exports={calcImportTax};
