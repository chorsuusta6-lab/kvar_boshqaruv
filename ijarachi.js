// ============================================
// IJARACHI SAHIFASI — LOGIKA (TUZATILGAN + O'CHIRISH)
// ============================================

const params = new URLSearchParams(window.location.search);
const kvId = params.get('id');

let ijarachiList = [];
let jarimaMap = {};
let currentKv = null;
let deleteTargetId = null;

// ---------- YORDAMCHI ----------

function oyKunlari(sana = new Date()) {
  return new Date(sana.getFullYear(), sana.getMonth() + 1, 0).getDate();
}

function hisoblaBalans(ij) {
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const oxirgi = new Date(ij.yangilangan_vaqt || ij.kelgan_kun); oxirgi.setHours(0, 0, 0, 0);
  let oTganKun = Math.floor((bugun - oxirgi) / 86400000);
  if (oTganKun < 0) oTganKun = 0;
  const kunlik = Number(ij.oylik_tolov) / oyKunlari();
  const yangiBalans = Number(ij.balans) - (kunlik * oTganKun);
  const nechiKun = kunlik > 0 ? yangiBalans / kunlik : 0;
  return { balans: yangiBalans, nechiKun, kunlik, oTganKun };
}

function ijarachiRangi(ij) {
  if ((jarimaMap[ij.id] || 0) >= 10) return 'qora';
  const { balans, nechiKun } = hisoblaBalans(ij);
  if (balans < 0) return 'qizil';
  if (nechiKun <= 3) return 'sariq';
  return 'yashil';
}

function pulFmt(n) {
  const num = Math.round(Number(n));
  return num.toLocaleString('uz-UZ') + " so'm";
}

function rangTartib(r) {
  return { qora: 1, qizil: 2, sariq: 3, yashil: 4 }[r] || 5;
}

function formatSana(s) {
  if (!s) return '—';
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

// ---------- MA'LUMOT YUKLASH ----------

async function malumotYukla() {
  if (!kvId) {
    document.getElementById('listContainer').innerHTML = '<p class="loading">KV tanlanmagan</p>';
    return;
  }

  // KV nomi
  const { data: kvData } = await supabaseClient.from('kv').select('*').eq('id', kvId).single();
  if (kvData) {
    currentKv = kvData;
    document.getElementById('kvTitle').textContent = kvData.nomi + " — Ijarachilar";
  }

  // Ijarachilar
  const { data: ijData, error } = await supabaseClient
    .from('ijarachi').select('*').eq('id_kv', kvId);
  if (error) { console.error(error); return; }
  ijarachiList = ijData || [];

  // Jarima
  const { data: jarimaData } = await supabaseClient.from('jarima').select('*');
  jarimaMap = {};
  (jarimaData || []).forEach(j => { jarimaMap[j.ijarachi_id] = j.qiymat; });

  // Balans yangilash (o'tgan kunlar bo'lsa)
  for (const ij of ijarachiList) {
    const { balans, oTganKun } = hisoblaBalans(ij);
    if (oTganKun > 0) {
      await supabaseClient.from('ijarachi')
        .update({ balans: balans, yangilangan_vaqt: new Date().toISOString() })
        .eq('id', ij.id);
      ij.balans = balans;
      ij.yangilangan_vaqt = new Date().toISOString();
    }
  }

  // KV bosh_joy ni yangilash
  await boshJoyYangila();

  render();
}

// ---------- KV BOSH JOY YANGILASH ----------

async function boshJoyYangila() {
  if (!currentKv) return;
  const ijarachilarSoni = ijarachiList.length;
  const boshJoy = currentKv.sigimi - ijarachilarSoni;
  if (Number(currentKv.bosh_joy) !== boshJoy) {
    await supabaseClient.from('kv').update({ bosh_joy: boshJoy }).eq('id', kvId);
    currentKv.bosh_joy = boshJoy;
  }
}

// ---------- RENDER ----------

function render() {
  const container = document.getElementById('listContainer');

  if (ijarachiList.length === 0) {
    container.innerHTML = '<p class="loading">Hozircha ijarachi yo\'q. "+ Ijarachi" ni bosing.</p>';
    return;
  }

  const tartiblangan = [...ijarachiList].sort((a, b) => {
    return rangTartib(ijarachiRangi(a)) - rangTartib(ijarachiRangi(b));
  });

  const guruhlar = { qora: [], qizil: [], sariq: [], yashil: [] };
  tartiblangan.forEach(ij => guruhlar[ijarachiRangi(ij)].push(ij));

  const nomlar = {
    qora: '⚫ Qora — chiqishi kerak',
    qizil: '🔴 Qizil — qarzdor',
    sariq: '🟡 Sariq — to\'lovi yaqin',
    yashil: '🟢 Yashil — hammasi joyida'
  };

  let html = '';
  for (const rang of ['qora', 'qizil', 'sariq', 'yashil']) {
    if (guruhlar[rang].length === 0) continue;
    html += `<div class="group-title ${rang}">${nomlar[rang]} (${guruhlar[rang].length})</div>`;
    guruhlar[rang].forEach(ij => { html += kartaHtml(ij, rang); });
  }
  container.innerHTML = html;
}

function kartaHtml(ij, rang) {
  const { balans, nechiKun } = hisoblaBalans(ij);
  const avatar = ij.profil_rasm
    ? `<img src="${ij.profil_rasm}" class="ij-avatar" alt="">`
    : `<div class="ij-avatar placeholder">👤</div>`;

  const balansClass = balans < 0 ? 'balans-manfiy' : '';
  const tel = ij.nomer ? `<button onclick="window.location.href='tel:${ij.nomer.replace(/\s/g, '')}'">📞</button>` : '';
  const tg = ij.telegram ? `<button onclick="window.open('https://t.me/${ij.telegram.replace('@', '')}','_blank')">✈️</button>` : '';

  return `
    <div class="ij-card ${rang}">
      ${avatar}
      <div class="ij-info">
        <h3>${ij.ismi}</h3>
        <p>📅 Kelgan: ${formatSana(ij.kelgan_kun)}</p>
        <p>💰 Oylik: ${pulFmt(ij.oylik_tolov)}</p>
        <p class="${balansClass}">💵 Balans: ${pulFmt(balans)}</p>
        <p>⏳ Yetadi: ${Math.round(nechiKun)} kun</p>
        <div class="ij-actions">
          <button onclick="xujjatlar('${ij.id}')">📄 Xujjatlar</button>
          ${tel} ${tg}
          <button class="btn-edit" onclick="tahrirla('${ij.id}')">✏️ Tahrirlash</button>
          <button class="btn-pay" onclick="tolovOch('${ij.id}')">💰 To'lov</button>
          <button class="btn-delete" onclick="ochirishIjarachi('${ij.id}', '${ij.ismi.replace(/'/g, "\\'")}')">🗑️ O'chirish</button>
        </div>
      </div>
    </div>
  `;
}

// ---------- RASM YUKLASH ----------

async function rasmYukla(file) {
  if (!file) return null;
  const ext = file.name.split('.').pop();
  const nom = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseClient.storage.from('rasmlar').upload(nom, file);
  if (error) { console.error(error); return null; }
  const { data } = supabaseClient.storage.from('rasmlar').getPublicUrl(nom);
  return data.publicUrl;
}

// ---------- IJARACHI FORMASI ----------

const formModal = document.getElementById('formModal');

document.getElementById('btnAdd').addEventListener('click', () => {
  // Bo'sh joy tekshiruvi
  if (currentKv && ijarachiList.length >= currentKv.sigimi) {
    alert(`Bu KV da sig'im to'lgan! (${currentKv.sigimi} kishi)\nBo'sh joy: 0`);
    return;
  }

  document.getElementById('formTitle').textContent = "Ijarachi qo'shish";
  ['fId', 'fIsmi', 'fNomer', 'fTelegram', 'fOylik', 'fKelgan', 'fHona', 'fKaravat'].forEach(id => {
    document.getElementById(id).value = '';
  });
  ['fProfil', 'fPasOld', 'fPasOrqa'].forEach(id => document.getElementById(id).value = '');
  formModal.classList.add('active');
});

function tahrirla(id) {
  const ij = ijarachiList.find(i => i.id === id);
  if (!ij) return;
  document.getElementById('formTitle').textContent = "Ijarachi tahrirlash";
  document.getElementById('fId').value = ij.id;
  document.getElementById('fIsmi').value = ij.ismi;
  document.getElementById('fNomer').value = ij.nomer || '';
  document.getElementById('fTelegram').value = ij.telegram || '';
  document.getElementById('fOylik').value = ij.oylik_tolov;
  document.getElementById('fKelgan').value = ij.kelgan_kun;
  document.getElementById('fHona').value = ij.hona;
  document.getElementById('fKaravat').value = ij.karavat;
  ['fProfil', 'fPasOld', 'fPasOrqa'].forEach(id => document.getElementById(id).value = '');
  formModal.classList.add('active');
}

document.getElementById('formClose').addEventListener('click', () => formModal.classList.remove('active'));
document.getElementById('formCancel').addEventListener('click', () => formModal.classList.remove('active'));

document.getElementById('formSave').addEventListener('click', async () => {
  const id = document.getElementById('fId').value;
  const ismi = document.getElementById('fIsmi').value.trim();
  const oylik = parseFloat(document.getElementById('fOylik').value);
  const kelgan = document.getElementById('fKelgan').value;
  const hona = document.getElementById('fHona').value.trim();
  const karavat = document.getElementById('fKaravat').value.trim();

  // Majburiy maydonlar tekshiruvi
  if (!ismi || !oylik || !kelgan || !hona || !karavat) {
    alert("Yulduzcha (*) bilan belgilangan maydonlarni to'ldiring!");
    return;
  }

  // Bo'sh joy tekshiruvi (faqat yangi qo'shishda)
  if (!id) {
    if (currentKv && ijarachiList.length >= currentKv.sigimi) {
      alert(`Bu KV da sig'im to'lgan! (${currentKv.sigimi} kishi)\nBo'sh joy: 0`);
      return;
    }
  }

  const data = {
    id_kv: kvId, ismi,
    nomer: document.getElementById('fNomer').value.trim() || null,
    telegram: document.getElementById('fTelegram').value.trim() || null,
    oylik_tolov: oylik, kelgan_kun: kelgan, hona, karavat
  };

  // Rasmlar
  const profilFile = document.getElementById('fProfil').files[0];
  const pasOldFile = document.getElementById('fPasOld').files[0];
  const pasOrqaFile = document.getElementById('fPasOrqa').files[0];

  if (profilFile) data.profil_rasm = await rasmYukla(profilFile);
  if (pasOldFile) data.pasport_old = await rasmYukla(pasOldFile);
  if (pasOrqaFile) data.pasport_orqa = await rasmYukla(pasOrqaFile);

  if (id) {
    // Tahrirlash — yangilangan_vaqt ni o'zgartirmaymiz
    await supabaseClient.from('ijarachi').update(data).eq('id', id);
  } else {
    // Yangi ijarachi: balans = 0, yangilangan_vaqt = kelgan_kun
    data.balans = 0;
    data.yangilangan_vaqt = new Date(kelgan + 'T00:00:00').toISOString();

    const { data: yangi, error } = await supabaseClient.from('ijarachi').insert(data).select().single();
    if (error) { alert("Xatolik: " + error.message); return; }
    if (yangi) {
      await supabaseClient.from('jarima').insert({ ijarachi_id: yangi.id, qiymat: 0 });
    }
  }

  formModal.classList.remove('active');
  malumotYukla();
});

// ---------- O'CHIRISH ----------

function ochirishIjarachi(id, ismi) {
  deleteTargetId = id;
  document.getElementById('deleteIjarachiNomi').textContent = ismi;
  document.getElementById('deleteModal').classList.add('active');
}

document.getElementById('deleteCancel').addEventListener('click', () => {
  document.getElementById('deleteModal').classList.remove('active');
  deleteTargetId = null;
});

document.getElementById('deleteConfirm').addEventListener('click', async () => {
  if (!deleteTargetId) return;
  await supabaseClient.from('ijarachi').delete().eq('id', deleteTargetId);
  document.getElementById('deleteModal').classList.remove('active');
  deleteTargetId = null;
  malumotYukla();
});

// ---------- TO'LOV ----------

const payModal = document.getElementById('payModal');

function tolovOch(id) {
  const ij = ijarachiList.find(i => i.id === id);
  if (!ij) return;
  document.getElementById('payId').value = id;
  document.getElementById('payName').textContent = ij.ismi;
  document.getElementById('paySumma').value = '';
  document.getElementById('payIzoh').value = '';
  payModal.classList.add('active');
}

document.getElementById('payClose').addEventListener('click', () => payModal.classList.remove('active'));
document.getElementById('payCancel').addEventListener('click', () => payModal.classList.remove('active'));

document.getElementById('paySave').addEventListener('click', async () => {
  const id = document.getElementById('payId').value;
  const summa = parseFloat(document.getElementById('paySumma').value);
  const izoh = document.getElementById('payIzoh').value.trim();

  if (!summa || summa <= 0) { alert("Summani kiriting!"); return; }

  const ij = ijarachiList.find(i => i.id === id);
  if (!ij) return;

  const { balans } = hisoblaBalans(ij);
  const yangiBalans = balans + summa;

  // 1. Tarixga yozish
  await supabaseClient.from('tolov_tarixi').insert({
    ijarachi_id: id, summa, izoh: izoh || null
  });

  // 2. Balansga qo'shish
  await supabaseClient.from('ijarachi').update({
    balans: yangiBalans, yangilangan_vaqt: new Date().toISOString()
  }).eq('id', id);

  payModal.classList.remove('active');
  malumotYukla();
});

// ---------- XUJJATLAR ----------

function xujjatlar(id) {
  const ij = ijarachiList.find(i => i.id === id);
  if (!ij) return;

  const body = document.getElementById('docBody');
  let html = '';

  if (ij.pasport_old) {
    html += `<div class="doc-item"><h4>Pasport oldi</h4>
      <img src="${ij.pasport_old}"><a href="${ij.pasport_old}" download target="_blank">📥 Yuklab olish</a></div>`;
  } else {
    html += `<div class="doc-item"><h4>Pasport oldi</h4><p>Yuklanmagan</p></div>`;
  }

  if (ij.pasport_orqa) {
    html += `<div class="doc-item"><h4>Pasport orqasi</h4>
      <img src="${ij.pasport_orqa}"><a href="${ij.pasport_orqa}" download target="_blank">📥 Yuklab olish</a></div>`;
  } else {
    html += `<div class="doc-item"><h4>Pasport orqasi</h4><p>Yuklanmagan</p></div>`;
  }

  body.innerHTML = html;
  document.getElementById('docModal').classList.add('active');
}

document.getElementById('docClose').addEventListener('click', () => document.getElementById('docModal').classList.remove('active'));

// ---------- PASTKI NAVIGATSIYA ----------

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    window.location.href = `${page}.html?id=${kvId}`;
  });
});

// ---------- ISHGA TUSHIRISH ----------

malumotYukla();