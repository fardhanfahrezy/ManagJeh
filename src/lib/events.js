// src/lib/events.js
/**
 * Arsitektur Event Bus Ringan untuk Sinkronisasi State Lintas Halaman
 * Menghindari re-fetching Supabase API secara berlebihan.
 */
export const financialEvents = {
  events: {},
  
  subscribe(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    
    // Kembalikan fungsi unsubscribe untuk mencegah memory leak di useEffect
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  },
  
  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
};