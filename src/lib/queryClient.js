// src/lib/queryClient.js
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { parseSupabaseError, triggerGlobalToast } from './errorHandler';

// Cegah pemanggilan ganda dalam jeda waktu 3 detik
let isSessionExpiredDispatched = false;

const handleAuthErrorInterceptor = (error) => {
    if (error.status === 401 || error.status === 403 || error.message?.toLowerCase().includes('jwt')) {
        if (!isSessionExpiredDispatched) {
            console.warn('[Security] Token kedaluwarsa. Memaksa pembersihan sesi.');
            isSessionExpiredDispatched = true;
            window.dispatchEvent(new Event('session-expired'));
            
            // Reset status setelah 3 detik agar event bisa dipicu lagi jika diperlukan
            setTimeout(() => { isSessionExpiredDispatched = false; }, 3000);
        }
        return true; // Berhenti memproses error lebih lanjut
    }
    return false;
};

export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error, query) => {
            if (query.meta?.disableGlobalError) return;
            if (handleAuthErrorInterceptor(error)) return;

            const parsedMessage = parseSupabaseError(error);
            triggerGlobalToast(parsedMessage, 'error');
        },
    }),
    mutationCache: new MutationCache({
        onError: (error, variables, context, mutation) => {
            if (mutation.meta?.disableGlobalError) return;
            if (handleAuthErrorInterceptor(error)) return;
            
            const parsedMessage = parseSupabaseError(error);
            triggerGlobalToast(parsedMessage, 'error');
        },
    }),
    defaultOptions: {
        queries: {
            retry: (failureCount, error) => {
                // Jangan retry jika error otorisasi atau pelanggaran RLS
                if (error.code === '42501' || error.status === 401 || error.status === 403) return false;
                return failureCount < 2; // Retry maksimal 2x untuk error lainnya
            },
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60 * 5, // 5 menit
        },
    },
});