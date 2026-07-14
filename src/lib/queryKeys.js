// src/lib/queryKeys.js

/**
 * Centralized Query Key Factory
 * Mencegah typo dan memastikan semua cache terisolasi berdasarkan User ID.
 */
export const QUERY_KEYS = {
  masterData: (userId) => ['masterData', userId],
  hasAccounts: (userId) => ['hasAccounts', userId],
  dashboard: (userId) => ['dashboardData', userId],
  transactions: (userId, filters) => ['transactions', userId, filters],
  recurring: (userId) => ['recurring', userId],
};