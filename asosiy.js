// ============================================
// ASOSIY SAHIFA — LOGIKA (TUZATILGAN)
// ============================================

let kvList = [];
let ijarachiList = [];
let deleteTargetId = null;

// ---------- YORDAMCHI FUNKSIYALAR ----------

function oyKunlari(sana = new Date()) {
  return new Date(sana.getFullYear(), sana.getMonth() + 1, 0).getDate();
}

function hisoblaBalans(ij) {
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  const oxirgi = new Date(ij.yangilangan_vaqt || ij.kelgan_kun);
  oxirgi.setHours(0, 0, 0, 0);

  let oTganKun = Math.floor((bugun - oxirgi) / 86400000);
  if (oTganKun < 0) oTganKun = 0;

  const kunlik = Number(ij.oylik_tolov) / oyKunlari();
  const yangiBalans = Number(ij.balans) - (kunlik * oTganKun);
  const nechiKun = kunlik > 0 ? yangiBalans / kunlik : 0;

  return { balans: yangiBalans, nechiKun, kunlik };
}

function ijarachiRangi(ij, jarimaQiymat = 0) {
  if (jarimaQiymat >= 10) return 'qora';
  const { balans, nechiKun } = hisoblaBalans(ij);
  if (balans < 0) return 'qizil';
  if (nechiKun <= 3) return 'sariq';
  return 'yashil';
}

function kvRangi(kvId, jarimaMap) {
  const ijarachilar = ijarachiList.filter(i => i.id_kv === kvId);
  if (ijarachilar.length === 0) return 'yashil';

  const ranglar = ijarachilar.map(i => ijarachiRangi(i, jarimaMap[i.id] || 0));
  if (ranglar.includes('qora')) return 'qora';
  if (ranglar.includes('qizil')) return 'qizil';
  if (ranglar.includes('sariq')) return 'sariq';
  return 'yashil';
}

function pulFmt(n) {
  return Math.round(Number(n)).toLocaleString('uz-UZ') + " so'm";
}

// ---------- MA'LUMOT YUKLASH ----------

async function malumotYukla() {
  const { data: kvData, error: kvErr } = await supabaseClient
    .from('kv').select('*').order('nomi');
  if (kvErr) { console.error(kvErr); return; }
  kvList = kvData || [];

  const { data: ijData, error: ijErr } = await supabaseClient
    .from('ijarachi').select('*');
  if (ijErr) { console.error(ijErr); return; }
  ijarachiList = ijData || [];

  const { data: jarimaData } = await supabaseClient
    .from('jarima').select('*');
  const jarimaMap = {};
  (jarimaData || []).forEach(j => { jarimaMap[j.ijarachi_id] = j.qiymat; });

  // bosh_joy ni avtomatik yangilash
  await boshJoyYangila();

  renderStatistika(jarimaMap);
  renderKvKartalari(jarimaMap);
}

// ---------- BOSH JOY AVTOMATIK YANGILASH ----------

async function boshJoyYangila() {
  for (const kv of kvList) {
    const soni = ijarachiList.filter(i => i.id_kv === kv.id).length;
    const boshJoy = kv.sigimi - soni;
    if (Number(kv.bosh_joy) !== boshJoy) {
      await supabaseClient.from('kv').update({ bosh_joy: boshJoy }).eq('id', kv.id);
      kv.bosh_joy = boshJoy;
    }
  }
}

// ---------- STATISTIKA ----------

async function renderStatistika(jarimaMap) {
  document.getElementById('statJami').textContent = ijarachiList.length;

  let yaqin = 0, qarzdor = 0;
  ijarachiList.forEach(ij => {
    const r = ijarachiRangi(ij, jarimaMap[ij.id] || 0);
    if (r === 'sariq') yaqin++;
    if (r === 'qizil' || r === 'qora') qarzdor++;
  });
  document.getElementById('statYaqin').textContent = yaqin;
  document.getElementById('statQarzdor').textContent = qarzdor;

  const bugun = new Date();
  const oyBosh = new Date(bugun.getFullYear(), bugun.getMonth(), 1).toISOString();
  const oyOxir = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data: tolovlar } = await supabaseClient
    .from('tolov_tarixi').select('summa')
    .gte('sana', oyBosh).lte('sana', oyOxir);
  const tushum = (tolovlar || []).reduce((s, t) => s + Number(t.summa), 0);

  const { data: xarajatlar } = await supabaseClient
    .from('xarajat').select('summa')
    .eq('bekor', false)
    .gte('sana', oyBosh).lte('sana', oyOxir);
  const xarajat = (xarajatlar || []).reduce((s, x) => s + Number(x.summa), 0);

  document.getElementById('statFoyda').textContent = pulFmt(tushum - xarajat);
}

// ---------- KV KARTALARI ----------

function renderKvKartalari(jarimaMap) {
  const grid = document.getElementById('kvGrid');
  if (kvList.length === 0) {
    grid.innerHTML = '<p class="loading">Hozircha KV yo\'q. "+ KV qo\'shish" ni bosing.</p>';
    return;
  }

  grid.innerHTML = kvList.map(kv => {
    const rang = kvRangi(kv.id, jarimaMap);
    const ijarachilarSoni = ijarachiList.filter(i => i.id_kv === kv.id).length;
    const boshJoy = kv.sigimi - ijarachilarSoni;
    return `
      <div class="kv-card ${rang}" data-id="${kv.id}">
        <div class="kv-card-actions">
          <button title="Tahrirlash" onclick="event.stopPropagation(); tahrirlaKv('${kv.id}')">✏️</button>
          <button title="O'chirish" onclick="event.stopPropagation(); ochirishKv('${kv.id}', '${kv.nomi}')">🗑️</button>
        </div>
        <h3>${kv.nomi}</h3>
        <p>👥 Sig'im: ${kv.sigimi} kishi</p>
        <p>🟢 Bo'sh joy: ${boshJoy}</p>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.kv-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `ijarachi.html?id=${card.dataset.id}`;
    });
  });
}

// ---------- KV MODAL ----------

const kvModal = document.getElementById('kvModal');

document.getElementById('btnAddKv').addEventListener('click', () => {
  document.getElementById('kvModalTitle').textContent = "KV qo'shish";
  document.getElementById('kvId').value = '';
  document.getElementById('kvNomi').value = '';
  document.getElementById('kvSigimi').value = '';
  kvModal.classList.add('active');
});

function tahrirlaKv(id) {
  const kv = kvList.find(k => k.id === id);
  if (!kv) return;
  document.getElementById('kvModalTitle').textContent = "KV tahrirlash";
  document.getElementById('kvId').value = kv.id;
  document.getElementById('kvNomi').value = kv.nomi;
  document.getElementById('kvSigimi').value = kv.sigimi;
  kvModal.classList.add('active');
}

document.getElementById('kvModalClose').addEventListener('click', () => kvModal.classList.remove('active'));
document.getElementById('kvCancel').addEventListener('click', () => kvModal.classList.remove('active'));

document.getElementById('kvSave').addEventListener('click', async () => {
  const id = document.getElementById('kvId').value;
  const nomi = document.getElementById('kvNomi').value.trim();
  const sigimi = parseInt(document.getElementById('kvSigimi').value);

  if (!nomi || !sigimi || sigimi < 1) {
    alert("Nomi va sig'imni to'ldiring!");
    return;
  }

  // Bo'sh joy = sig'im - (shu KV dagi ijarachilar soni)
  let ijarachilarSoni = 0;
  if (id) {
    ijarachilarSoni = ijarachiList.filter(i => i.id_kv === id).length;
  }
  const boshJoy = sigimi - ijarachilarSoni;

  if (boshJoy < 0) {
    alert(`Sig'im ${sigimi} dan kam! Bu KV da ${ijarachilarSoni} ta ijarachi bor.`);
    return;
  }

  if (id) {
    await supabaseClient.from('kv').update({ nomi, sigimi, bosh_joy: boshJoy }).eq('id', id);
  } else {
    await supabaseClient.from('kv').insert({ nomi, sigimi, bosh_joy: sigimi });
  }

  kvModal.classList.remove('active');
  malumotYukla();
});

// ---------- O'CHIRISH ----------

const deleteModal = document.getElementById('deleteModal');

function ochirishKv(id, nomi) {
  deleteTargetId = id;
  document.getElementById('deleteKvNomi').textContent = nomi;
  deleteModal.classList.add('active');
}

document.getElementById('deleteCancel').addEventListener('click', () => deleteModal.classList.remove('active'));

document.getElementById('deleteConfirm').addEventListener('click', async () => {
  if (!deleteTargetId) return;
  await supabaseClient.from('kv').delete().eq('id', deleteTargetId);
  deleteModal.classList.remove('active');
  deleteTargetId = null;
  malumotYukla();
});

// ---------- ISHGA TUSHIRISH ----------

malumotYukla();