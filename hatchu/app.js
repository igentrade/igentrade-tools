const yen = (n) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Math.round(n || 0));

const todayISO = () => new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Tokyo"}).format(new Date());

const stateKey = "igentrade-hatchu-draft-v1";

function el(id) {
  return document.getElementById(id);
}

function defaultItem() {
  return { name: "", qty: 1, unit: "式", price: 0 };
}

let items = [defaultItem(), defaultItem(), defaultItem()];

function renderItemInputs() {
  const root = el("items");
  root.innerHTML = "";
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <input data-k="name" data-i="${idx}" aria-label="品目" placeholder="品目" value="${escapeAttr(item.name)}" />
      <input data-k="qty" data-i="${idx}" type="number" min="0" step="0.001" aria-label="数量" value="${item.qty}" />
      <input data-k="unit" data-i="${idx}" aria-label="単位" placeholder="単位" value="${escapeAttr(item.unit)}" />
      <input data-k="price" data-i="${idx}" type="number" min="0" step="1" aria-label="税抜単価" value="${item.price}" />
      <button type="button" data-del="${idx}" title="削除">×</button>
    `;
    root.appendChild(row);
  });
}

function escapeAttr(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function readForm() {
  return {
    issueDate: el("issueDate").value,
    dueDate: el("dueDate").value,
    docNumber: el("docNumber").value.trim(),
    sellerName: el("sellerName").value.trim(),
    sellerAddress: el("sellerAddress").value.trim(),
    sellerContact: el("sellerContact").value.trim(),
    contactPerson: el("contactPerson").value.trim(),
    paymentTerms: el("paymentTerms").value.trim(),
    buyerName: el("buyerName").value.trim(),
    buyerAddress: el("buyerAddress").value.trim(),
    taxRate: Number(el("taxRate").value),
    notes: el("notes").value.trim(),
    deliveryAddress: el("deliveryAddress").value.trim(),
    showBrand: el("showBrand").checked,
    items: items.map((x) => ({
      name: x.name,
      qty: Number(x.qty) || 0,
      unit: x.unit,
      price: Number(x.price) || 0,
    })),
  };
}

function calc(data) {
  const lines = data.items.filter((i) => i.name.trim() || i.price);
  const subtotal = lines.reduce((sum, i) => sum + Math.round(i.qty * i.price), 0);
  const tax = Math.floor(subtotal * data.taxRate);
  const total = subtotal + tax;
  return { lines, subtotal, tax, total };
}

function refreshPreview() {
  const data = readForm();
  const { lines, subtotal, tax, total } = calc(data);
  const isInvoice = false;

  el("docLabel").textContent = "発注書";
  el("dueLabel").textContent = "納品希望日";
  el("pDocNumber").textContent = data.docNumber || "—";
  el("pIssueDate").textContent = data.issueDate || "—";
  el("pDueDate").textContent = data.dueDate || "—";
  el("pBuyerName").textContent = data.buyerName ? data.buyerName.replace(/\s*御中$/, "") + " 御中" : "（発注先）";
  el("pBuyerAddress").textContent = data.buyerAddress;
  el("pSellerName").textContent = data.sellerName || "（自社名）";
  el("pSellerAddress").textContent = data.sellerAddress;
  el("pSellerContact").textContent = data.sellerContact;
  el("pContactPerson").textContent = data.contactPerson
    ? `担当者: ${data.contactPerson}`
    : "";
  document.querySelector(".honor").textContent = "下記の通り発注いたします。";

  const tbody = el("pItems");
  tbody.innerHTML = "";
  if (!lines.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#5b6475">明細を入力してください</td></tr>`;
  } else {
    lines.forEach((i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeAttr(i.name)}</td>
        <td>${i.qty}</td>
        <td>${escapeAttr(i.unit || "")}</td>
        <td>${yen(i.price)}</td>
        <td>${yen(Math.round(i.qty * i.price))}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  const ratePct = Math.round(data.taxRate * 100);
  el("pTaxLabel").textContent =
    data.taxRate === 0 ? "消費税" : `消費税（${ratePct}%）`;
  el("pSubtotal").textContent = yen(subtotal);
  el("pTax").textContent = yen(tax);
  el("pTotal").textContent = yen(total);
  el("pGrandTotal").textContent = yen(total);
  el("pNotes").textContent = data.notes || "—";
  el("pPaymentTerms").textContent = data.paymentTerms || "—";
  el("pDeliveryAddress").textContent = data.deliveryAddress || "—";
}


function syncBrandFoot() {
  const foot = el("brandFoot");
  const on = el("showBrand") && el("showBrand").checked;
  if (!foot) return;
  foot.classList.toggle("is-hidden", !on);
}

function bind() {
  el("issueDate").value = todayISO();
  el("dueDate").value = "";
  el("docNumber").value = `PO-${todayISO().slice(0,4)}-001`;
  el("sellerName").value = "合同会社威源国際貿易";
  el("notes").value = "";

  renderItemInputs();
  refreshPreview();

  el("items").addEventListener("input", (e) => {
    const t = e.target;
    if (!t.dataset.k) return;
    const i = Number(t.dataset.i);
    const k = t.dataset.k;
    items[i][k] = t.type === "number" ? Math.max(0,Number(t.value)||0) : t.value;
    refreshPreview();
  });
  el("items").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    const i = Number(btn.dataset.del);
    items.splice(i, 1);
    if (!items.length) items.push(defaultItem());
    renderItemInputs();
    refreshPreview();
  });

  el("addItem").addEventListener("click", () => {
    items.push(defaultItem());
    renderItemInputs();
    refreshPreview();
  });

  [
    "issueDate",
    "dueDate",
    "docNumber",
    "sellerName",
    "sellerAddress",
    "sellerContact",
    "contactPerson",
    "paymentTerms",
    "buyerName",
    "buyerAddress",
    "taxRate",
    "notes",
    "deliveryAddress",
  ].forEach((id) => el(id).addEventListener("input", refreshPreview));

  el("showBrand").addEventListener("change", syncBrandFoot);
  syncBrandFoot();
  el("printBtn").addEventListener("click", () => {
    if (typeof window.iGenTradeRecordTry === "function") window.iGenTradeRecordTry();
    window.print();
  });
  el("saveLocal").addEventListener("click", () => {try{localStorage.setItem(stateKey, JSON.stringify(readForm()));report("下書きをこのブラウザに保存しました。");}catch{report("保存できませんでした。バックアップ保存をご利用ください。");}});
  el("loadLocal").addEventListener("click",()=>{try{const raw=localStorage.getItem(stateKey);if(!raw){report("保存された下書きがありません。");return;}applyDraft(JSON.parse(raw));}catch{report("下書きを読み込めませんでした。");}});
  el("exportDraft").addEventListener("click",()=>{const data=readForm(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download=(data.docNumber.replace(/[^a-zA-Z0-9_-]/g,"_")||"purchase-order")+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);report("バックアップのダウンロードを開始しました。");});
  el("importDraft").addEventListener("click",()=>el("draftFile").click());
  el("draftFile").addEventListener("change",async()=>{const file=el("draftFile").files[0];if(!file)return;try{if(file.size>2000000)throw Error();applyDraft(JSON.parse(await file.text()));}catch{report("正しい発注書バックアップ（JSON）を選択してください。");}finally{el("draftFile").value="";}});
}
function report(message){el("status").textContent=message;}
function applyDraft(data){
 if(!data||typeof data!=="object"||!Array.isArray(data.items)||data.items.length>300)throw Error("Invalid draft");
 const normalized=data.items.map(x=>{if(!x||typeof x!=="object"||!Number.isFinite(Number(x.qty))||!Number.isFinite(Number(x.price))||Number(x.qty)<0||Number(x.price)<0)throw Error("Invalid item");return {name:String(x.name||"").slice(0,1000),unit:String(x.unit||"").slice(0,50),qty:Number(x.qty),price:Number(x.price)};});
 const fields=["issueDate","dueDate","docNumber","sellerName","sellerAddress","sellerContact","contactPerson","paymentTerms","buyerName","buyerAddress","deliveryAddress","notes"];
 fields.forEach(id=>el(id).value=String(data[id]||"").slice(0,10000));el("taxRate").value=[0,.08,.1].includes(Number(data.taxRate))?String(data.taxRate):"0.1";el("showBrand").checked=data.showBrand===true;
 items=normalized.length?normalized:[defaultItem()];renderItemInputs();refreshPreview();syncBrandFoot();report("下書きを読み込みました。");
}
bind();
