// ============================================
// NAVBATCHI SAHIFASI — LOGIKA (TO'LIQ TO'G'RILANGAN)
// ============================================

const params = new URLSearchParams(window.location.search);
const kvId = params.get('id');

let vazifalar = [];
let sozlama = null;
let ijarachiList = [];
let jarimaMap = {}; 
let navbatchiTarix = []; 

// ---------- YORDAMCHI FUNKSIYALAR ----------

// Sanani mahalliy vaqt bo'yicha YYYY-MM-DD formatida olish
function bugunISO() {
  const d = new Date();
  const yil = d.getFullYear();
  const oy = String(d.getMonth() + 1).padStart(2, '0');
  const kun = String(d.getDate()).padStart(2, '0');
  return `${yil}-${oy}-${kun}`;
}

// Sanani 2 nuqta bilan chiqarish (DD.MM.YYYY)
function formatSana(s) {
  if (!s) return '—';
  const parts = s.split('-'); // YYYY-MM-DD
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return s;
}

function sanaQosh(sanaISO, kun) {
  const d = new Date(sanaISO);
  d.setDate(d.getDate() + kun);
  const yil = d.getFullYear();
  const oy = String(d.getMonth() + 1).padStart(2, '0');
  const k = String(d.getDate()).padStart(2, '0');
  return `${yil}-${oy}-${k}`;
}

// Ikki sana orasidagi kunlar farqini hisoblash (toza string bo'yicha)
function kunlarFarqi(sana1, sana2) {
  const d1 = new Date(sana1 + 'T00:00:00');
  const d2 = new Date(sana2 + 'T00:00:00');
  return Math.round((d1 - d2) / 86400000);
}

function holatNomi(h) {
  return { 
    bajardi: '✅ Bajardi', 
    bajarmadi: '❌ Bajarmadi',
    almashtirildi: '🔄 Almashtirildi', 
    kutilmoqda: '⏳ Kutilmoqda' 
  }[h] || h;
}

// ---------- TABLARNI ALMASHTIRISH ----------

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    const contentId = 'tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
    document.getElementById(contentId).classList.add('active');
  });
});

// ---------- MA'LUMOT YUKLASH ----------

async function malumotYukla() {
  const { data: v } = await supabaseClient.from('vazifa').select('*').order('yaratilgan');
  vazifalar = v || [];

  const { data: s } = await supabaseClient.from('navbatchi_sozlama').select('*')
    .order('yangilangan_vaqt', { ascending: false }).limit(1);
  sozlama = s && s[0] ? s[0] : null;

  let q = supabaseClient.from('ijarachi').select('*');
  if (kvId) q = q.eq('id_kv', kvId);
  const { data: ij } = await q.order('ismi');
  ijarachiList = ij || [];

  const { data: j } = await supabaseClient.from('jarima').select('*');
  jarimaMap = {};
  (j || []).forEach(x => {
    jarimaMap[x.ijarachi_id] = {
      qiymat: x.qiymat || 0,
      navbat_soni: x.navbat_soni || 0
    };
  });

  await navbatchiRoyxatYukla();
  vazifaRender();
  sozlamaForma();
}

// ---------- NAVBATCHILAR RO'YXATINI YUKLASH ----------

async function navbatchiRoyxatYukla() {
  if (!sozlama) {
    ['avvalgiList','bugungiList','keyingiList'].forEach(id => {
      document.getElementById(id).innerHTML = '<p class="loading">Sozlama yo\'q. 2-tabda sozlang.</p>';
    });
    return;
  }

  const { data } = await supabaseClient.from('navbatchi_tarix')
    .select('*, vazifa:vazifa_id(nomi), ijarachi:ijarachi_id(ismi)')
    .order('sana');

  navbatchiTarix = data || [];
  const bugun = bugunISO();

  // Sanalarni toza string ko'rinishida olish
  const sanalar = [...new Set(navbatchiTarix.map(n => n.sana))].sort();

  // 1. Avvalgi sana (bugundan oldingi eng yaqin sana)
  const avvalgiSana = sanalar.filter(s => s < bugun).pop();

  // 2. Markaziy sana (Bugungi yoki unga eng yaqin kun)
  let markaziySana = sanalar.find(s => s === bugun);
  
  if (!markaziySana) {
    const oldingi = sanalar.filter(s => s < bugun).pop();
    const keyingisi = sanalar.find(s => s > bugun);
    
    if (oldingi && keyingisi) {
      const farqOldingi = Math.abs(kunlarFarqi(bugun, oldingi));
      const farqKeyingi = Math.abs(kunlarFarqi(keyingisi, bugun));
      markaziySana = (farqOldingi <= farqKeyingi) ? oldingi : keyingisi;
    } else if (oldingi) {
      markaziySana = oldingi;
    } else if (keyingisi) {
      markaziySana = keyingisi;
    }
  }

  // 3. Keyingi sana (markaziy sanadan keyingi)
  const keyingiSana = sanalar.find(s => s > markaziySana);

  // Render qilish
  renderGroupSana('avvalgiList', 'titleAvvalgi', '⏮️ Avvalgi navbatchilik', avvalgiSana, 'avvalgi');
  renderGroupSana('bugungiList', 'titleBugungi', '🔵 Navbatchilik', markaziySana, 'bugungi');
  renderGroupSana('keyingiList', 'titleKeyingi', '⏭️ Keyingi navbatchilik', keyingiSana, 'keyingi');
}

// Sana va guruh sarlavhasini render qilish
function renderGroupSana(listId, titleId, defaultTitle, sana, tur) {
  const titleEl = document.getElementById(titleId);
  const listEl = document.getElementById(listId);

  if (!sana) {
    titleEl.textContent = defaultTitle;
    listEl.innerHTML = '<p class="loading">Ma\'lumot yo\'q</p>';
    return;
  }

  // Sanani bugunga nisbatan solishtirish (vaqt zonasiz, aniq kunlar bo'yicha)
  const farq = kunlarFarqi(sana, bugunISO());

  let sanaNomi = "";
  if (farq === -1) sanaNomi = "Kechagi navbatchilik";
  else if (farq === 0) sanaNomi = "Bugungi navbatchilik";
  else if (farq === 1) sanaNomi = "Ertangi navbatchilik";
  else if (farq < -1) sanaNomi = `${Math.abs(farq)} kun oldingi navbatchilik`;
  else if (farq > 1) sanaNomi = `${farq} kundan keyingi navbatchilik`;

  // Sarlavhani yangilash
  const icon = tur === 'avvalgi' ? '⏮️' : (tur === 'keyingi' ? '⏭️' : '🔵');
  titleEl.textContent = `${icon} ${sanaNomi} (${formatSana(sana)})`;

  // Ro'yxatni chiqarish
  const shuSanaNavbatchilar = navbatchiTarix.filter(n => n.sana === sana);
  if (shuSanaNavbatchilar.length === 0) {
    listEl.innerHTML = '<p class="loading">Ma\'lumot yo\'q</p>';
    return;
  }

  listEl.innerHTML = shuSanaNavbatchilar.map(n => {
    const ijarachi = n.ijarachi ? n.ijarachi.ismi : 'Noma\'lum';
    const vazifa = n.vazifa ? n.vazifa.nomi : 'Noma\'lum';

    if (tur === 'bugungi') {
      const btnlar = n.holat === 'kutilmoqda' ? `
        <div class="nav-actions" id="act-${n.id}">
          <button class="btn-bajarmadi" onclick="holatBelgila('${n.id}','bajarmadi')">❌ Bajarmadi</button>
          <button class="btn-almashtir" onclick="almashtir('${n.id}')">🔄 Almashtirish</button>
          <button class="btn-bajardi" onclick="holatBelgila('${n.id}','bajardi')">✅ Bajardi</button>
        </div>` : '';
      return `<div class="nav-card">
        <div class="nav-card-header" onclick="toggleActions('${n.id}')">
          <div>
            <h3>👤 ${ijarachi}</h3>
            <div class="vazifa">${vazifa}</div>
          </div>
          <div class="sana">${formatSana(n.sana)}</div>
        </div>
        <div><span class="holat-badge ${n.holat}">${holatNomi(n.holat)}</span></div>
        ${btnlar}
      </div>`;
    }

    return `<div class="nav-card">
      <div class="nav-card-header">
        <div>
          <h3>👤 ${ijarachi}</h3>
          <div class="vazifa">${vazifa}</div>
        </div>
        <div class="sana">${formatSana(n.sana)}</div>
      </div>
      <div><span class="holat-badge ${n.holat}">${holatNomi(n.holat)}</span></div>
    </div>`;
  }).join('');
}

function toggleActions(id) {
  const el = document.getElementById('act-' + id);
  if (el) el.classList.toggle('hidden');
}

// ---------- HOLAT BELGILASH ----------

async function holatBelgila(navId, holat) {
  const { data: nav } = await supabaseClient.from('navbatchi_tarix')
    .select('*').eq('id', navId).single();
  if (!nav) return;

  await supabaseClient.from('navbatchi_tarix').update({ holat }).eq('id', navId);

  if (holat === 'bajarmadi') {
    await jarimaYangila(nav.ijarachi_id, +2, 0);
  } else if (holat === 'bajardi') {
    await jarimaYangila(nav.ijarachi_id, -1, +1);
  }

  navbatchiRoyxatYukla();
}

async function jarimaYangila(ijarachiId, jarimaDelta, navbatDelta) {
  const { data: mavjud } = await supabaseClient.from('jarima')
    .select('*').eq('ijarachi_id', ijarachiId).single();

  if (mavjud) {
    let yangiJarima = (mavjud.qiymat || 0) + jarimaDelta;
    if (yangiJarima < 0) yangiJarima = 0;
    let yangiNavbat = (mavjud.navbat_soni || 0) + navbatDelta;
    
    await supabaseClient.from('jarima').update({
      qiymat: yangiJarima,
      navbat_soni: yangiNavbat,
      yangilangan_vaqt: new Date().toISOString()
    }).eq('ijarachi_id', ijarachiId);
  } else {
    await supabaseClient.from('jarima').insert({
      ijarachi_id: ijarachiId,
      qiymat: Math.max(0, jarimaDelta),
      navbat_soni: Math.max(0, navbatDelta)
    });
  }
}

// ---------- ALMASHTIRISH ----------

async function almashtir(navId) {
  const { data: nav } = await supabaseClient.from('navbatchi_tarix')
    .select('*').eq('id', navId).single();
  if (!nav) return;

  const joriyIdx = ijarachiList.findIndex(i => i.id === nav.ijarachi_id);
  const keyingiIdx = (joriyIdx + 1) % ijarachiList.length;
  const keyingiIjarachi = ijarachiList[keyingiIdx];

  if (!keyingiIjarachi) { alert("Keyingi ijarachi topilmadi!"); return; }

  await supabaseClient.from('navbatchi_tarix').update({ holat: 'almashtirildi' }).eq('id', navId);

  await supabaseClient.from('navbatchi_tarix').insert({
    ijarachi_id: keyingiIjarachi.id,
    vazifa_id: nav.vazifa_id,
    sana: nav.sana,
    holat: 'kutilmoqda'
  });

  navbatchiRoyxatYukla();
}

// ---------- VAZIFALAR ----------

function vazifaRender() {
  const el = document.getElementById('vazifaList');
  if (vazifalar.length === 0) {
    el.innerHTML = '<p class="loading">Vazifa yo\'q</p>';
  } else {
    el.innerHTML = vazifalar.map((v, i) => `
      <div class="vazifa-item">
        <span>${i+1}. ${v.nomi}</span>
        <button onclick="vazifaOchir('${v.id}')">🗑️</button>
      </div>
    `).join('');
  }
  document.getElementById('vazifaSon').textContent = `Jami: ${vazifalar.length} vazifa → ${vazifalar.length} navbatchi`;
}

document.getElementById('btnAddVazifa').addEventListener('click', async () => {
  const nomi = document.getElementById('yangiVazifa').value.trim();
  if (!nomi) return;
  await supabaseClient.from('vazifa').insert({ nomi });
  document.getElementById('yangiVazifa').value = '';
  const { data } = await supabaseClient.from('vazifa').select('*').order('yaratilgan');
  vazifalar = data || [];
  vazifaRender();
});

async function vazifaOchir(id) {
  if (!confirm("Vazifani o'chirmoqchimisiz?")) return;
  await supabaseClient.from('vazifa').delete().eq('id', id);
  const { data } = await supabaseClient.from('vazifa').select('*').order('yaratilgan');
  vazifalar = data || [];
  vazifaRender();
}

// ---------- SOZLAMA VA SAQLASH ----------

function sozlamaForma() {
  if (sozlama) {
    document.getElementById('sozlamaBoshlanish').value = sozlama.boshlanish_sana;
    document.getElementById('sozlamaOraliq').value = sozlama.oraliq_kun;
  }
}

document.getElementById('btnSaqlash').addEventListener('click', async () => {
  const bosh = document.getElementById('sozlamaBoshlanish').value;
  const oraliq = parseInt(document.getElementById('sozlamaOraliq').value);

  if (!bosh || !oraliq || oraliq < 1) {
    alert("Boshlanish sanasi va oraliqni to'ldiring!");
    return;
  }
  if (vazifalar.length === 0) {
    alert("Kamida 1 ta vazifa qo'shing!");
    return;
  }
  if (ijarachiList.length === 0) {
    alert("Ijarachilar yo'q!");
    return;
  }

  if (sozlama) {
    await supabaseClient.from('navbatchi_sozlama').update({
      boshlanish_sana: bosh, oraliq_kun: oraliq,
      yangilangan_vaqt: new Date().toISOString()
    }).eq('id', sozlama.id);
  } else {
    const { data: yangi } = await supabaseClient.from('navbatchi_sozlama').insert({
      boshlanish_sana: bosh, oraliq_kun: oraliq
    }).select().single();
    sozlama = yangi;
  }

  await supabaseClient.from('navbatchi_tarix').delete().in('holat', ['kutilmoqda', 'almashtirildi']);

  const bugun = bugunISO();
  const sanalar = [
    sanaQosh(bugun, -oraliq),
    bugun,
    sanaQosh(bugun, oraliq)
  ];

  for (const sana of sanalar) {
    await navbatchiTanlash(sana);
  }

  alert("Muvaffaqiyatli saqlandi!");
  document.querySelector('.tab[data-tab="navbatchilar"]').click();
  malumotYukla();
});

// ---------- NAVBATCHI TANLASH LOGIKASI ----------

async function navbatchiTanlash(sana) {
  const vazifaSoni = vazifalar.length;
  if (vazifaSoni === 0 || ijarachiList.length === 0) return;

  const navbatchiSoni = Math.min(vazifaSoni, ijarachiList.length);

  const jarimalilar = Object.entries(jarimaMap)
    .filter(([id, j]) => j.qiymat > 0 && ijarachiList.some(i => i.id === id))
    .sort((a, b) => b[1].qiymat - a[1].qiymat)
    .map(([id]) => id);

  const tanlangan = [];
  jarimalilar.forEach(id => {
    if (tanlangan.length < navbatchiSoni) tanlangan.push(id);
  });

  const navbatBoshlanish = navbatIndeksi(sana);

  let idx = navbatBoshlanish;
  let urinish = 0;
  while (tanlangan.length < navbatchiSoni && urinish < ijarachiList.length * 2) {
    const ij = ijarachiList[idx % ijarachiList.length];
    if (ij && !tanlangan.includes(ij.id)) {
      tanlangan.push(ij.id);
    }
    idx++;
    urinish++;
  }

  const ishlatilganVazifalar = new Set();

  for (let i = 0; i < tanlangan.length; i++) {
    const ijId = tanlangan[i];
    let navbatSoni = (jarimaMap[ijId]?.navbat_soni) || 0;
    if (navbatSoni < 0) navbatSoni = 0;

    let vazifaIndeks = navbatSoni % vazifaSoni;
    if (vazifaIndeks < 0) vazifaIndeks = 0;

    let urinish2 = 0;
    while (ishlatilganVazifalar.has(vazifaIndeks) && urinish2 < vazifaSoni) {
      vazifaIndeks = (vazifaIndeks + 1) % vazifaSoni;
      urinish2++;
    }

    if (ishlatilganVazifalar.has(vazifaIndeks)) continue;

    const vazifa = vazifalar[vazifaIndeks];
    if (!vazifa || !vazifa.id) continue;

    ishlatilganVazifalar.add(vazifaIndeks);

    await supabaseClient.from('navbatchi_tarix').insert({
      ijarachi_id: ijId,
      vazifa_id: vazifa.id,
      sana: sana,
      holat: sana < bugunISO() ? 'bajardi' : 'kutilmoqda'
    });
  }
}

function navbatIndeksi(sana) {
  if (!sozlama || ijarachiList.length === 0) return 0;
  const boshlanish = new Date(sozlama.boshlanish_sana);
  const joriy = new Date(sana);
  const kunlar = Math.floor((joriy - boshlanish) / 86400000);
  const davrSoni = Math.floor(kunlar / sozlama.oraliq_kun);
  const navbatchiSoni = Math.min(vazifalar.length, ijarachiList.length);
  
  let indeks = (davrSoni * navbatchiSoni) % ijarachiList.length;
  if (indeks < 0) indeks = (indeks + ijarachiList.length) % ijarachiList.length;
  return indeks;
}

// ---------- PASTKI NAVIGATSIYA ----------

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    window.location.href = `${page}.html?id=${kvId || ''}`;
  });
});

// ---------- ISHGA TUSHIRISH ----------

malumotYukla();