// ============================================
// NAVBATCHI SAHIFASI — LOGIKA
// ============================================

const params = new URLSearchParams(window.location.search);
const kvId = params.get('id');

let vazifalar = [];
let sozlama = null;
let ijarachiList = [];
let jarimaMap = {};

// ---------- YORDAMCHI ----------

function formatSana(s) {
  if (!s) return '—';
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function bugunISO() {
  const d = new Date(); d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}

function sanaQosh(sanaISO, kun) {
  const d = new Date(sanaISO);
  d.setDate(d.getDate() + kun);
  return d.toISOString().slice(0,10);
}

// ---------- TABLAR ----------

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.add('active');
  });
});

// ---------- MA'LUMOT YUKLASH ----------

async function malumotYukla() {
  // Vazifalar
  const { data: v } = await supabaseClient.from('vazifa').select('*').order('yaratilgan');
  vazifalar = v || [];

  // Sozlama
  const { data: s } = await supabaseClient.from('navbatchi_sozlama').select('*')
    .order('yangilangan_vaqt', { ascending: false }).limit(1);
  sozlama = s && s[0] ? s[0] : null;

  // Ijarachilar (shu KV)
  let q = supabaseClient.from('ijarachi').select('*');
  if (kvId) q = q.eq('id_kv', kvId);
  const { data: ij } = await q.order('ismi');
  ijarachiList = ij || [];

  // Jarima
  const { data: j } = await supabaseClient.from('jarima').select('*');
  jarimaMap = {};
  (j || []).forEach(x => { jarimaMap[x.ijarachi_id] = x.qiymat; });

  // Navbatchi tarix
  await navbatchiRoyxatYukla();
  vazifaRender();
  sozlamaForma();
}

// ---------- NAVBATCHI RO'YXAT ----------

async function navbatchiRoyxatYukla() {
  if (!sozlama) {
    document.getElementById('avvalgiList').innerHTML = '<p class="loading">Sozlama yo\'q</p>';
    document.getElementById('bugungiList').innerHTML = '<p class="loading">Sozlama yo\'q</p>';
    document.getElementById('keyingiList').innerHTML = '<p class="loading">Sozlama yo\'q</p>';
    return;
  }

  const { data } = await supabaseClient.from('navbatchi_tarix')
    .select('*, vazifa:vazifa_id(nomi), ijarachi:ijarachi_id(ismi)')
    .order('sana');

  const barcha = data || [];
  const bugun = bugunISO();

  // Sanalar bo'yicha guruhlash
  const sanalar = [...new Set(barcha.map(n => n.sana))].sort();
  const avvalgiSanalar = sanalar.filter(s => s < bugun);
  const bugungiSana = bugun;
  const keyingiSanalar = sanalar.filter(s => s > bugun);

  const avvalgi = barcha.filter(n => n.sana < bugun);
  const bugungi = barcha.filter(n => n.sana === bugun);
  const keyingi = barcha.filter(n => n.sana > bugun);

  renderGroup('avvalgiList', avvalgi, 'avvalgi');
  renderGroup('bugungiList', bugungi, 'bugungi');
  renderGroup('keyingiList', keyingi, 'keyingi');
}

function renderGroup(elId, list, tur) {
  const el = document.getElementById(elId);
  if (list.length === 0) {
    el.innerHTML = '<p class="loading">Ma\'lumot yo\'q</p>';
    return;
  }
  el.innerHTML = list.map(n => {
    const ijarachi = n.ijarachi ? n.ijarachi.ismi : '—';
    const vazifa = n.vazifa ? n.vazifa.nomi : '—';

    if (tur === 'bugungi') {
      const btnlar = n.holat === 'kutilmoqda' ? `
        <div class="nav-actions" id="act-${n.id}">
          <button class="btn-bajarmadi" onclick="holatBelgila('${n.id}','bajarmadi')">❌ Bajarmadi</button>
          <button class="btn-almashtir" onclick="almashtir('${n.id}')">🔄 Almashtirish</button>
          <button class="btn-bajardi" onclick="holatBelgila('${n.id}','bajardi')">✅ Bajardi</button>
        </div>` : '';
      return `<div class="nav-card">
        <div class="nav-card-header" onclick="toggleActions('${n.id}')">
          <div><h3>👤 ${ijarachi}</h3><div class="vazifa">${vazifa}</div></div>
          <div class="sana">${formatSana(n.sana)}</div>
        </div>
        <div style="margin-top:8px;"><span class="holat-badge ${n.holat}">${holatNomi(n.holat)}</span></div>
        ${btnlar}
      </div>`;
    }

    return `<div class="nav-card">
      <div class="nav-card-header">
        <div><h3>👤 ${ijarachi}</h3><div class="vazifa">${vazifa}</div></div>
        <div>
          <div class="sana">${formatSana(n.sana)}</div>
          <span class="holat-badge ${n.holat}">${holatNomi(n.holat)}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function holatNomi(h) {
  return { bajardi: '✅ Bajardi', bajarmadi: '❌ Bajarmadi',
           almashtirildi: '🔄 Almashtirildi', kutilmoqda: '⏳ Kutilmoqda' }[h] || h;
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

  await supabaseClient.from('navbatchi_tarix')
    .update({ holat }).eq('id', navId);

  // Jarima logikasi
  if (holat === 'bajarmadi') {
    await jarimaOshir(nav.ijarachi_id, +2);
  } else if (holat === 'bajardi') {
    await jarimaOshir(nav.ijarachi_id, -1);
  }

  navbatchiRoyxatYukla();
}

async function jarimaOshir(ijarachiId, delta) {
  const { data: mavjud } = await supabaseClient.from('jarima')
    .select('*').eq('ijarachi_id', ijarachiId).single();

  if (mavjud) {
    let yangi = (mavjud.qiymat || 0) + delta;
    if (yangi < 0) yangi = 0;
    await supabaseClient.from('jarima').update({
      qiymat: yangi, yangilangan_vaqt: new Date().toISOString()
    }).eq('ijarachi_id', ijarachiId);
  } else if (delta > 0) {
    await supabaseClient.from('jarima').insert({
      ijarachi_id: ijarachiId, qiymat: delta
    });
  }
}

// ---------- ALMASHTIRISH ----------

async function almashtir(navId) {
  const { data: nav } = await supabaseClient.from('navbatchi_tarix')
    .select('*').eq('id', navId).single();
  if (!nav) return;

  // Keyingi ijarachini topish (navbat bo'yicha)
  const joriyIdx = ijarachiList.findIndex(i => i.id === nav.ijarachi_id);
  const keyingiIdx = (joriyIdx + 1) % ijarachiList.length;
  const keyingiIjarachi = ijarachiList[keyingiIdx];

  if (!keyingiIjarachi) { alert("Keyingi ijarachi topilmadi!"); return; }

  // Eski navbatchini "almashtirildi" qilish
  await supabaseClient.from('navbatchi_tarix')
    .update({ holat: 'almashtirildi' }).eq('id', navId);

  // Yangi navbatchi yozuvi
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
  document.getElementById('vazifaSon').textContent =
    `Jami: ${vazifalar.length} vazifa → ${vazifalar.length} navbatchi`;
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

// ---------- SOZLAMA ----------

function sozlamaForma() {
  if (sozlama) {
    document.getElementById('sozlamaBoshlanish').value = sozlama.boshlanish_sana;
    document.getElementById('sozlamaOraliq').value = sozlama.oraliq_kun;
  }
}

// ---------- SAQLASH VA NAVBATCHI TANLASH ----------

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

  // Sozlama saqlash
  if (sozlama) {
    await supabaseClient.from('navbatchi_sozlama').update({
      boshlanish_sana: bosh, oraliq_kun: oraliq,
      yangilangan_vaqt: new Date().toISOString()
    }).eq('id', sozlama.id);
  } else {
    await supabaseClient.from('navbatchi_sozlama').insert({
      boshlanish_sana: bosh, oraliq_kun: oraliq
    });
  }

  // Eski navbatchi tarixini tozalash (kutilmoqda va almashtirildi)
  await supabaseClient.from('navbatchi_tarix')
    .delete().in('holat', ['kutilmoqda', 'almashtirildi']);

  // Navbatchilarni tanlash — 3 davr (avvalgi, bugungi, keyingi)
  const bugun = bugunISO();

  // Sanalarni hisoblash
  const sanalar = [];
  let s = bosh;
  // Boshlanish sanasidan oldin ham bir necha davr
  for (let i = 0; i < 10; i++) {
    if (s >= bugun) break;
    s = sanaQosh(s, oraliq);
  }
  // Bugungi va keyingi davrlar
  sanalar.push(bugun);
  sanalar.push(sanaQosh(bugun, oraliq));
  sanalar.push(sanaQosh(bugun, oraliq * 2));

  // Har bir davr uchun navbatchilarni tanlash
  for (const sana of sanalar) {
    await navbatchiTanlash(sana);
  }

  alert("Saqlandi! Navbatchilar tanlandi.");
  malumotYukla();
});

// ---------- NAVBATCHI TANLASH LOGIKASI ----------

async function navbatchiTanlash(sana) {
  const vazifaSoni = vazifalar.length;
  if (vazifaSoni === 0) return;

  // 1. Jarima qiymati > 0 bo'lganlarni olish
  const jarimalilar = Object.entries(jarimaMap)
    .filter(([id, qiymat]) => qiymat > 0 && ijarachiList.some(i => i.id === id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const tanlangan = [];
  jarimalilar.forEach(id => {
    if (tanlangan.length < vazifaSoni) tanlangan.push(id);
  });

  // 2. Qolgan vazifalar uchun asosiy ro'yxatdan navbat bilan
  let idx = 0;
  while (tanlangan.length < vazifaSoni && idx < ijarachiList.length * 2) {
    const ij = ijarachiList[idx % ijarachiList.length];
    if (!tanlangan.includes(ij.id)) {
      tanlangan.push(ij.id);
    }
    idx++;
  }

  // 3. Navbatchi tarixga yozish
  for (let i = 0; i < vazifaSoni; i++) {
    if (!tanlangan[i]) break;
    await supabaseClient.from('navbatchi_tarix').insert({
      ijarachi_id: tanlangan[i],
      vazifa_id: vazifalar[i].id,
      sana: sana,
      holat: sana < bugunISO() ? 'bajardi' : (sana === bugunISO() ? 'kutilmoqda' : 'kutilmoqda')
    });
  }
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