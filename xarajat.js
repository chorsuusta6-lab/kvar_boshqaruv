// ============================================
// XARAJAT SAHIFASI — LOGIKA
// ============================================

const params = new URLSearchParams(window.location.search);
const kvId = params.get('id');

// ---------- YORDAMCHI ----------

function pulFmt(n) {
  return Math.round(Number(n)).toLocaleString('uz-UZ') + " so'm";
}

function formatSanaVaqt(s) {
  const d = new Date(s);
  const sana = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  const vaqt = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `${sana} ${vaqt}`;
}

function kategoriyaIcon(k) {
  return { "Kommunal": "💡", "Ta'mirlash": "🔧", "Oziq-ovqat": "🍞",
           "Tozalash": "🧹", "Boshqa": "📦" }[k] || "📦";
}

// ---------- XARAJAT QO'SHISH ----------

document.getElementById('btnAddXarajat').addEventListener('click', async () => {
  const kategoriya = document.getElementById('xKategoriya').value;
  const summa = parseFloat(document.getElementById('xSumma').value);
  const izoh = document.getElementById('xIzoh').value.trim();

  if (!summa || summa <= 0) { alert("To'lov miqdorini kiriting!"); return; }

  const { error } = await supabaseClient.from('xarajat').insert({
    kategoriya, summa, izoh: izoh || null
  });

  if (error) { alert("Xatolik: " + error.message); return; }

  document.getElementById('xSumma').value = '';
  document.getElementById('xIzoh').value = '';
  xarajatYukla();
});

// ---------- OXIRGI 10 TA YUKLASH ----------

async function xarajatYukla() {
  const { data, error } = await supabaseClient
    .from('xarajat').select('*')
    .order('sana', { ascending: false })
    .limit(10);

  const list = document.getElementById('xarajatList');

  if (error) { list.innerHTML = '<p class="loading">Xatolik yuz berdi</p>'; return; }
  if (!data || data.length === 0) {
    list.innerHTML = '<p class="loading">Hozircha xarajat yo\'q</p>';
    return;
  }

  list.innerHTML = data.map(x => `
    <div class="x-item ${x.bekor ? 'bekor' : ''}">
      <div class="x-item-info">
        <h3>${kategoriyaIcon(x.kategoriya)} ${x.kategoriya}</h3>
        <span class="x-summa">${pulFmt(x.summa)}</span>
        ${x.izoh ? `<p>${x.izoh}</p>` : ''}
        <p>${formatSanaVaqt(x.sana)}</p>
      </div>
      ${!x.bekor ? `<button class="cancel-btn" onclick="bekorQilish('${x.id}')">❌ Bekor</button>` : ''}
    </div>
  `).join('');
}

// ---------- BEKOR QILISH ----------

async function bekorQilish(id) {
  if (!confirm("Bu xarajatni bekor qilmoqchimisiz?\n(Tarixda qoladi, lekin hisobotda hisoblanmaydi)")) return;

  const { error } = await supabaseClient.from('xarajat')
    .update({ bekor: true }).eq('id', id);

  if (error) { alert("Xatolik: " + error.message); return; }
  xarajatYukla();
}

// ---------- PASTKI NAVIGATSIYA ----------

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    window.location.href = `${page}.html?id=${kvId || ''}`;
  });
});

// ---------- ISHGA TUSHIRISH ----------

xarajatYukla();