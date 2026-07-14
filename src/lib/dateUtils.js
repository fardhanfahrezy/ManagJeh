// src/lib/dateUtils.js
import {
  format,
  startOfDay,
  subWeeks,
  subMonths,
  subYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachYearOfInterval,
  parseISO,
  isValid
} from 'date-fns';
import { id } from 'date-fns/locale'; // Untuk pelabelan bahasa Indonesia ('Jan', 'Sen')

/**
 * Menentukan tingkat detail agregasi grafik
 */
export const getGranularity = (type, value) => {
  if (type === 'minggu' || (type === 'bulan' && value <= 3)) return 'daily';
  if (type === 'bulan') return 'monthly';
  return 'yearly';
};

/**
 * Menghitung tanggal mulai secara presisi dan aman dari anomali Timezone/DST
 */
export const calculateStartDate = (type, value) => {
  const now = new Date();
  let targetDate;

  if (type === 'minggu') targetDate = subWeeks(now, value);
  else if (type === 'bulan') targetDate = subMonths(now, value);
  else if (type === 'tahun') targetDate = subYears(now, value);
  else targetDate = now;

  return startOfDay(targetDate).toISOString(); 
};

/**
 * Membangun struktur data bucket (Wadah Grafik) dengan kompleksitas O(1) Lookup
 */
export const generateBuckets = (type, value) => {
  const bucketList = [];
  const bucketMap = new Map();
  const now = new Date();
  const granularity = getGranularity(type, value);
  const startDate = new Date(calculateStartDate(type, value));

  if (granularity === 'daily') {
    // eachDayOfInterval otomatis menangani Leap Year & DST
    const days = eachDayOfInterval({ start: startDate, end: now });
    days.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      const bucket = {
        label: format(day, 'd MMM', { locale: id }), // Contoh: "14 Jul"
        matchKey: key,
        income: 0,
        expense: 0
      };
      bucketList.push(bucket);
      bucketMap.set(key, bucket);
    });
  } 
  else if (granularity === 'monthly') {
    const months = eachMonthOfInterval({ start: startDate, end: now });
    months.forEach(month => {
      const key = format(month, 'yyyy-MM');
      const bucket = {
        label: format(month, 'MMM', { locale: id }), // Contoh: "Jul"
        year: month.getFullYear(),
        matchKey: key,
        income: 0,
        expense: 0
      };
      bucketList.push(bucket);
      bucketMap.set(key, bucket);
    });
  } 
  else if (granularity === 'yearly') {
    const years = eachYearOfInterval({ start: startDate, end: now });
    years.forEach(year => {
      const key = format(year, 'yyyy');
      const bucket = {
        label: key,
        matchKey: key,
        income: 0,
        expense: 0
      };
      bucketList.push(bucket);
      bucketMap.set(key, bucket);
    });
  }
  
  return { bucketList, bucketMap };
};

/**
 * Helper untuk normalisasi kunci pencarian dari ISO timestamp Supabase
 */
export const getBucketSearchKey = (dateString, granularity) => {
  if (!dateString) return null;
  const d = parseISO(dateString);
  if (!isValid(d)) return null;

  if (granularity === 'daily') return format(d, 'yyyy-MM-dd');
  if (granularity === 'monthly') return format(d, 'yyyy-MM');
  if (granularity === 'yearly') return format(d, 'yyyy');
  
  return null;
};