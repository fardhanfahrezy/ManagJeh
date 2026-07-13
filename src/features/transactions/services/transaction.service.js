import { supabase } from '../../../lib/supabase';
import { queueOfflineAction } from '../../../lib/db';

export const transactionService = {
  async createTransaction(payload, userId) {
    const finalPayload = {
      ...payload,
      id: payload.id || crypto.randomUUID(), // Standar modern browser
      user_id: userId
    };

    // Pendekatan Offline-First
    if (!navigator.onLine) {
      await queueOfflineAction('INSERT', finalPayload.id, userId, finalPayload);
      return { status: 'offline', data: finalPayload };
    }

    const { error } = await supabase.from('transactions').insert([finalPayload]);
    if (error) throw error;
    
    return { status: 'online', data: finalPayload };
  }
};