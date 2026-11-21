// ============================================
// HISOBOT SAHIFASI — LOGIKA
// ============================================

const params = new URLSearchParams(window.location.search);
const kvId = params.get('id');

let barchaIjarachi = [];

const OYLAR = ["Yanvar","Fevral","Mart","Aprel","May","Iyun",
               "Iyul","Avgust","Sentabr","Oktyabr","Noyabr","Dekabr"];

// ---------- YORDAMCHI ----------

function pulFmt(n) {
  return Math.round(Number(n)).toLocaleString('uz-UZ') + " so'm";
}

function oyNomi(d) {
  return `${OYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

function bugungiOyBosh() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ---------- JORIY OY STATISTIKA ----------

async function joriyOyStatistika() {
  const bosh = bugungiOyBosh().toISOString();
  const oxir = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23,59,59).toISOString();

  const { data: tolovlar } = await supabaseClient.from('tolov_tarixi')
    .select('summa').gte('sana', bosh).lte('sana', oxir);
  const tushum = (tolovlar || []).reduce((s, t) => s + Number(t.summa), 0);

  const { data: xarajatlar } = await supabaseClient.from('xarajat')
    .select('summa').eq('bekor', false).gte('sana', bosh).lte('sana', oxir);
  const xarajat = (xarajatlar || []).reduce((s, x) => s + Number(x.summa), 0);

  document.getElementById('statTushum').textContent = pulFmt(tushum);
  document.getElementById('statXarajat').textContent = pulFmt(xarajat);
  document.getElementById('statFoyda').textContent = pulFmt(tushum - xarajat);
}

// ---------- OYLAR KESIMIDA JADVAL ----------

async function oylarKesimida(boshSana, oxirSana) {
  // Barcha to'lovlar va xarajatlarni olish
  const { data: tolovlar } = await supabaseClient.from('tolov_tarixi')
    .select('summa, sana').gte('sana', boshSana).lte('sana', oxirSana);
  const { data: xarajatlar } = await supabaseClient.from('xarajat')
    .select('summa, sana').eq('bekor', false)
    .gte('sana', boshSana).lte('sana', oxirSana);

  // Oy bo'yicha guruhlash
  const map = {};
  function addOy(sana, tushum, xarajat) {
    const d = new Date(sana);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!map[key]) map[key] = { sana: d, tushum: 0, xarajat: 0 };
    map[key].tushum += tushum;
    map[key].xarajat += xarajat;
  }

  (tolovlar || []).forEach(t => addOy(t.sana, Number(t.summa), 0));
  (xarajatlar || []).forEach(x => addOy(x.sana, 0, Number(x.summa)));

  const rows = Object.values(map).sort((a, b) => b.sana - a.sana);
  const tbody = document.querySelector('#oylarTable tbody');

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Ma\'lumot yo\'q</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const foyda = r.tushum - r.xarajat;
    return `<tr>
      <td>${oyNomi(r.sana)}</td>
      <td>${pulFmt(r.tushum)}</td>
      <td class="red">${pulFmt(r.xarajat)}</td>
      <td class="${foyda >= 0 ? 'green' : 'red'}">${pulFmt(foyda)}</td>
    </tr>`;
  }).join('');
}

// ---------- XARAJATLAR RO'YXATI (OYLAR BO'YICHA) ----------

async function xarajatlarRoyxat(boshSana, oxirSana) {
  const { data } = await supabaseClient.from('xarajat')
    .select('*').eq('bekor', false)
    .gte('sana', boshSana).lte('sana', oxirSana)
    .order('sana', { ascending: false });

  const container = document.getElementById('xarajatRoyxat');
  if (!data || data.length === 0) {
    container.innerHTML = '<p class="loading">Xarajat yo\'q</p>';
    return;
  }

  // Oy bo'yicha guruhlash
  const guruh = {};
  data.forEach(x => {
    const d = new Date(x.sana);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!guruh[key]) guruh[key] = { sana: d, items: [], jami: 0 };
    guruh[key].items.push(x);
    guruh[key].jami += Number(x.summa);
  });

  const keys = Object.keys(guruh).sort((a,b) => {
    return new Date(guruh[b].sana) - new Date(guruh[a].sana);
  });

  container.innerHTML = keys.map(k => {
    const g = guruh[k];
    const items = g.items.map(x => `
      <div class="x-row">
        <span>${x.kategoriya}${x.izoh ? ` — <span class="x-izoh">${x.izoh}</span>` : ''}</span>
        <span>${pulFmt(x.summa)}</span>
      </div>
    `).join('');
    return `<div class="oy-group">
      <h3>${oyNomi(g.sana)}</h3>
      ${items}
      <div class="oy-jami">Jami: ${pulFmt(g.jami)}</div>
    </div>`;
  }).join('');
}

// ---------- .XLS HISOBOT YUKLASH ----------

document.getElementById('btnXlsHisobot').addEventListener('click', async () => {
  let bosh = document.getElementById('davrBosh').value;
  let oxir = document.getElementById('davrOxir').value;

  if (!bosh || !oxir) {
    // Agar tanlanmagan bo'lsa — joriy oy
    const b = bugungiOyBosh();
    bosh = b.toISOString().slice(0,10);
    oxir = new Date(b.getFullYear(), b.getMonth()+1, 0).toISOString().slice(0,10);
  }

  const boshISO = new Date(bosh).toISOString();
  const oxirISO = new Date(oxir + 'T23:59:59').toISOString();

  const { data: tolovlar } = await supabaseClient.from('tolov_tarixi')
    .select('summa, sana').gte('sana', boshISO).lte('sana', oxirISO);
  const { data: xarajatlar } = await supabaseClient.from('xarajat')
    .select('*').eq('bekor', false)
    .gte('sana', boshISO).lte('sana', oxirISO);

  // Sheet 1: Oylar kesimida
  const map = {};
  function addOy(sana, tushum, xarajat) {
    const d = new Date(sana);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!map[key]) map[key] = { nom: oyNomi(d), tushum: 0, xarajat: 0 };
    map[key].tushum += tushum;
    map[key].xarajat += xarajat;
  }
  (tolovlar || []).forEach(t => addOy(t.sana, Number(t.summa), 0));
  (xarajatlar || []).forEach(x => addOy(x.sana, 0, Number(x.summa)));

  const sheet1 = [["Oy","Tushum","Xarajat","Sof foyda"]];
  Object.values(map).forEach(r => {
    sheet1.push([r.nom, r.tushum, r.xarajat, r.tushum - r.xarajat]);
  });

  // Sheet 2: Xarajatlar ro'yxati
  const sheet2 = [["Sana","Kategoriya","Summa","Izoh"]];
  (xarajatlar || []).forEach(x => {
    const d = new Date(x.sana);
    const sana = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    sheet2.push([sana, x.kategoriya, Number(x.summa), x.izoh || ""]);
  });

  // Excel yaratish
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1), "Oylar kesimida");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2), "Xarajatlar");

  XLSX.writeFile(wb, `hisobot_${bosh}_${oxir}.xlsx`);
});

// ---------- IJARACHI TO'LOV TARIXI .XLS ----------

async function ijarachilarYukla() {
  const { data } = await supabaseClient.from('ijarachi').select('id, ismi').order('ismi');
  barchaIjarachi = data || [];

  const select = document.getElementById('ijarachiSelect');
  select.innerHTML = '<option value="">— Tanlang —</option>' +
    barchaIjarachi.map(i => `<option value="${i.id}">${i.ismi}</option>`).join('');
}

document.getElementById('btnXlsTolov').addEventListener('click', async () => {
  const id = document.getElementById('ijarachiSelect').value;
  if (!id) { alert("Ijarachini tanlang!"); return; }

  const ij = barchaIjarachi.find(i => i.id === id);
  const { data } = await supabaseClient.from('tolov_tarixi')
    .select('*').eq('ijarachi_id', id).order('sana', { ascending: false });

  if (!data || data.length === 0) { alert("Bu ijarachida to'lov yo'q!"); return; }

  const rows = [["Sana","Summa","Izoh"]];
  data.forEach(t => {
    const d = new Date(t.sana);
    const sana = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    rows.push([sana, Number(t.summa), t.izoh || ""]);
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "To'lovlar");
  XLSX.writeFile(wb, `tolov_${ij.ismi.replace(/\s+/g,'_')}.xlsx`);
});

// ---------- PASTKI NAVIGATSIYA ----------

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    window.location.href = `${page}.html?id=${kvId || ''}`;
  });
});

// ---------- ISHGA TUSHIRISH ----------

async function init() {
  // Standart davr: joriy oy
  const b = bugungiOyBosh();
  const oxir = new Date(b.getFullYear(), b.getMonth()+1, 0);
  document.getElementById('davrBosh').value = b.toISOString().slice(0,10);
  document.getElementById('davrOxir').value = oxir.toISOString().slice(0,10);

  await joriyOyStatistika();
  await oylarKesimida(b.toISOString(), oxir.toISOString());
  await xarajatlarRoyxat(b.toISOString(), oxir.toISOString());
  await ijarachilarYukla();
}

init();