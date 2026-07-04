/**
 * @fileoverview Service layer untuk menarik harga aset volatil (Kripto, Emas).
 * Dioptimalkan dengan Local Caching dan Timeout Controller untuk menjaga skor LCP < 2.5s.
 */

const CACHE_KEY = 'managjeh_market_prices';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 Menit
const FETCH_TIMEOUT_MS = 5000; // 5 Detik maksimal waktu tunggu jaringan

// Default fallback jika API gagal dan cache kosong (Estimasi statis)
const FALLBACK_PRICES = {
  IDR: 1,
  BTC: 1100000000, // Rp 1.1 M
  XAU: 1450000,    // Rp 1.45 Juta / Gram
};

/**
 * Utilitas untuk mengeksekusi fetch dengan batas waktu (Timeout)
 * Mencegah hanging request yang membunuh performa INP/LCP
 */
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

/**
 * Mengambil harga pasar terkini dengan mekanisme Caching
 * @returns {Promise<Object>} Objek berisi rasio harga terhadap IDR
 */
export const getLivePrices = async () => {
  // 1. Validasi Cache Memori Lokal
  try {
    const cachedItem = localStorage.getItem(CACHE_KEY);
    if (cachedItem) {
      const { timestamp, data } = JSON.parse(cachedItem);
      // Jika umur cache masih di bawah TTL 5 Menit, kembalikan data lokal (Zero Network Latency)
      if (Date.now() - timestamp < CACHE_TTL_MS) {
        return data;
      }
    }
  } catch (error) {
    console.warn('Gagal membaca cache lokal, memuat ulang data jaringan.', error);
  }

  // 2. Eksekusi Jaringan Konkuren
  // Gunakan API Key dari Environment Variable (.env) khusus untuk layanan berbayar seperti Emas
  const goldApiKey = import.meta.env.VITE_GOLD_API_KEY; 

  const currentPrices = { ...FALLBACK_PRICES };

  try {
    // Promise.allSettled memastikan jika satu API mati, yang lain tetap berjalan
    const results = await Promise.allSettled([
      // Fetch Crypto (CoinGecko - Public API)
      fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr'),
      
      // Fetch Gold (Contoh menggunakan metalpriceapi.com atau goldapi.io)
      // Jika key tidak ada, kita lewati eksekusi API Emas ini.
      ...(goldApiKey ? [
        fetchWithTimeout('https://api.metalpriceapi.com/v1/latest?base=XAU&currencies=IDR', {
          headers: { 'Authorization': `Bearer ${goldApiKey}` }
        })
      ] : [])
    ]);

    // 3. Sanitasi & Parsing Respon Kripto
    if (results[0].status === 'fulfilled' && results[0].value.ok) {
      const cryptoData = await results[0].value.json();
      if (cryptoData?.bitcoin?.idr) {
        // Strict Number parsing untuk keamanan matematis
        currentPrices.BTC = Number(cryptoData.bitcoin.idr); 
      }
    }

    // 4. Sanitasi & Parsing Respon Emas (Jika API dikonfigurasi)
    if (goldApiKey && results[1]?.status === 'fulfilled' && results[1].value.ok) {
      const goldData = await results[1].value.json();
      if (goldData?.rates?.IDR) {
        // Gram XAU konversi (1 Troy Ounce = ~31.1035 Gram)
        const pricePerOunce = Number(goldData.rates.IDR);
        currentPrices.XAU = Number((pricePerOunce / 31.1035).toFixed(2));
      }
    }

    // 5. Perbarui Cache (Write to LocalStorage)
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: currentPrices
      }));
    } catch (e) {
      console.warn('Gagal menyimpan cache memori.', e);
    }

    return currentPrices;

  } catch (error) {
    console.error('Kegagalan fatal pada priceService, menggunakan fallback:', error);
    
    // Jika fetch total gagal, coba gunakan cache kedaluwarsa jika ada, atau fallback statis
    const staleCache = localStorage.getItem(CACHE_KEY);
    return staleCache ? JSON.parse(staleCache).data : currentPrices;
  }
};