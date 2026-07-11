// src/lib/dateHelpers.js

export const generateBuckets = (periodType, periodValue) => {
    const buckets = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (periodType === 'minggu') {
        const totalDays = periodValue * 7;
        for (let i = totalDays - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            buckets.push({
                label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                matchKey: d.toLocaleDateString('en-CA'), // Format YYYY-MM-DD (Universal)
                year: d.getFullYear(),
                income: 0,
                expense: 0
            });
        }
    } else if (periodType === 'bulan') {
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        for (let i = periodValue - 1; i >= 0; i--) {
            const d = new Date(firstDayOfMonth);
            d.setMonth(d.getMonth() - i);
            buckets.push({
                label: d.toLocaleDateString('id-ID', { month: 'short' }),
                matchKey: `${d.getFullYear()}-${d.getMonth()}`, // Format YYYY-M
                year: d.getFullYear(),
                income: 0,
                expense: 0
            });
        }
    } else if (periodType === 'tahun') {
        for (let i = periodValue - 1; i >= 0; i--) {
            const targetYear = today.getFullYear() - i;
            buckets.push({
                label: targetYear.toString(),
                matchKey: targetYear.toString(),
                year: targetYear,
                income: 0,
                expense: 0
            });
        }
    }
    return buckets;
};

export const findBucket = (buckets, dateString, periodType) => {
    const txDate = new Date(dateString);
    let key;
    
    if (periodType === 'minggu') key = txDate.toLocaleDateString('en-CA');
    else if (periodType === 'bulan') key = `${txDate.getFullYear()}-${txDate.getMonth()}`;
    else if (periodType === 'tahun') key = txDate.getFullYear().toString();

    return buckets.find(b => b.matchKey === key);
};

export const calculateStartDate = (periodType, periodValue) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);

    if (periodType === 'minggu') d.setDate(d.getDate() - (periodValue * 7) + 1);
    else if (periodType === 'bulan') {
        d.setMonth(d.getMonth() - periodValue + 1);
        d.setDate(1);
    } 
    else if (periodType === 'tahun') {
        d.setFullYear(d.getFullYear() - periodValue + 1);
        d.setMonth(0, 1);
    }
    return d.toISOString();
};