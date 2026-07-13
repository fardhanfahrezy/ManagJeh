// Instansiasi tunggal (Single Instance) untuk menghemat alokasi memori di dalam loop
const rupiahFormatter = new Intl.NumberFormat('id-ID');

export const formatRupiah = (number) => rupiahFormatter.format(number);