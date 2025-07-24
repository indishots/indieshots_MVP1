import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/UltimateAuthProvider';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to handle post-payment authentication refresh
 * Detects payment success and ensures all tier data is updated immediately
 */
export const usePostPaymentRefresh = () => {
  const queryClient = useQueryClient();
  const { refreshUserData } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const message = urlParams.get('message');
    
    if (status === 'success' && message) {
      console.log('🎯 POST-PAYMENT: Payment success detected, refreshing all auth data...');
      
      // Comprehensive refresh of all tier-related data sources
      const refreshAllData = async () => {
        try {
          // 1. Invalidate all cached queries
          queryClient.invalidateQueries();
          
          // 2. Force refetch of specific tier-related endpoints
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ["/api/auth/user"] }),
            queryClient.refetchQueries({ queryKey: ["/api/upgrade/status"] }),
            queryClient.refetchQueries({ queryKey: ["/api/upgrade/plans"] }),
          ]);
          
          // 3. Refresh auth provider state
          await refreshUserData();
          
          console.log('✅ POST-PAYMENT: All auth data refreshed successfully');
          
          // 4. Show success notification
          toast({
            title: "Payment Successful!",
            description: decodeURIComponent(message),
            variant: "default",
          });
          
        } catch (error) {
          console.error('❌ POST-PAYMENT: Error refreshing auth data:', error);
        }
      };
      
      // Execute refresh with slight delay to ensure server has updated
      setTimeout(refreshAllData, 500);
      
      // Clean up URL parameters after processing
      setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname);
      }, 2000);
    }
  }, [queryClient, refreshUserData, toast]);
};