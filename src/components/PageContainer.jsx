// src/components/PageContainer.jsx
export default function PageContainer({ children, className = '' }) {
  return (
    <div 
      // Penjelasan Kelas:
      // animate-in: Inisialisasi plugin animasi
      // fade-in: Mulai dari opacity 0
      // slide-in-from-bottom-8: Mulai dari posisi turun sejauh 2rem (32px)
      // duration-500: Durasi setengah detik
      // ease-out: Kurva pergerakan (cepat di awal, melambat di akhir -> terlihat premium)
      className={`animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out fill-both ${className}`}
    >
      {children}
    </div>
  );
}