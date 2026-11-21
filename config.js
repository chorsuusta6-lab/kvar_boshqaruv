// ============================================
// SUPABASE SOZLAMALARI
// ============================================

const SUPABASE_URL = "https://iqewvqoxjhyyecipdohv.supabase.co";      // ← o'zingiznikini qo'ying
const SUPABASE_ANON_KEY = "sb_publishable_Dpjg-tDUt51x-8eLV2Limg_iLJC3wsk";              // ← o'zingiznikini qo'ying

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// SERVICE WORKER (PWA)
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('✅ PWA tayyor'))
      .catch(err => console.warn('⚠️ SW xatolik:', err));
  });
}