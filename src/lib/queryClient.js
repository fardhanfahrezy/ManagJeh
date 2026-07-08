import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { parseSupabaseError, triggerGlobalToast } from './errorHandler';

export const queryClient = new QueryClient({
    // Tangkap error saat mengambil data (GET)
    queryCache: new QueryCache({
        onError: (error) => {
            const parsedMessage = parseSupabaseError(error);
            triggerGlobalToast(parsedMessage, 'error');
        },
    }),
    // Tangkap error saat memanipulasi data (POST/PUT/DELETE)
    mutationCache: new MutationCache({
        onError: (error) => {
            const parsedMessage = parseSupabaseError(error);
            triggerGlobalToast(parsedMessage, 'error');
        },
    }),
    defaultOptions: {
        queries: {
            // Optimasi Performa & Keamanan
            retry: (failureCount, error) => {
                // Jangan lakukan retry jika error adalah masalah Otorisasi (403/RLS) atau Custom RPC
                if (error.code === '42501' || error.code === 'P0001') return false;
                return failureCount < 2; // Hanya retry maksimal 2x untuk network error
            },
            refetchOnWindowFocus: false, // Hemat bandwidth
            staleTime: 1000 * 60 * 5, // Data dianggap segar selama 5 menit
        },
    },
});