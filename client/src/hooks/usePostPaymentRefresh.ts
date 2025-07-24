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
          console.log('🔄 POST-PAYMENT: Starting comprehensive data refresh...');
          
          // 1. Clear all cached data first
          queryClient.clear();
          console.log('✅ POST-PAYMENT: Cleared all cached queries');
          
          // 2. Multiple attempts to refresh user data
          for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`🔄 POST-PAYMENT: Auth refresh attempt ${attempt}/3`);
            
            try {
              // Force refresh auth provider state
              await refreshUserData();
              console.log(`✅ POST-PAYMENT: Auth provider refreshed (attempt ${attempt})`);
              
              // Force refetch specific endpoints with no cache
              await Promise.all([
                queryClient.refetchQueries({ 
                  queryKey: ["/api/auth/user"],
                  type: 'all'
                }),
                queryClient.refetchQueries({ 
                  queryKey: ["/api/upgrade/status"],
                  type: 'all' 
                }),
                queryClient.refetchQueries({ 
                  queryKey: ["/api/upgrade/plans"],
                  type: 'all'
                })
              ]);
              console.log(`✅ POST-PAYMENT: All endpoints refetched (attempt ${attempt})`);
              
              break; // Success, exit retry loop
              
            } catch (retryError) {
              console.warn(`⚠️ POST-PAYMENT: Refresh attempt ${attempt} failed:`, retryError);
              if (attempt === 3) {
                console.error('❌ POST-PAYMENT: All refresh attempts failed');
              } else {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
          
          // 3. Force page reload as last resort to ensure fresh data
          console.log('🔄 POST-PAYMENT: Forcing page reload to ensure fresh authentication...');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          
          console.log('✅ POST-PAYMENT: All auth data refresh completed');
          
          // 4. Show success notification
          toast({
            title: "Payment Successful!",
            description: `${decodeURIComponent(message)} Your account has been upgraded to Pro!`,
            variant: "default",
          });
          
        } catch (error) {
          console.error('❌ POST-PAYMENT: Error refreshing auth data:', error);
          // Force reload even on error to ensure fresh state
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      };
      
      // Execute refresh immediately
      refreshAllData();
      
      // Clean up URL parameters after processing
      setTimeout(() => {
        const newUrl = window.location.pathname;
        window.history.replaceState(null, '', newUrl);
      }, 3000);
    }
  }, [queryClient, refreshUserData, toast]);
};