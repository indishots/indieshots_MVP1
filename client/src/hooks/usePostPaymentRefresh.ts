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
  const { refreshUserData, user } = useAuth();
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
          
          // 2. Force refresh authentication to fix inconsistency
          if (user?.email) {
            try {
              console.log('🔧 POST-PAYMENT: Force refreshing authentication for:', user.email);
              
              const forceRefreshResponse = await fetch(`/api/force-refresh/${encodeURIComponent(user.email)}`, {
                method: 'POST',
                credentials: 'include',
                cache: 'no-cache'
              });
              
              if (forceRefreshResponse.ok) {
                const refreshData = await forceRefreshResponse.json();
                console.log('✅ POST-PAYMENT: Force refresh successful:', refreshData);
                
                // Now refresh user data with fixed authentication
                await refreshUserData();
                console.log('✅ POST-PAYMENT: User data refreshed after force refresh');
              } else {
                console.log('❌ POST-PAYMENT: Force refresh failed, falling back to normal refresh');
                await refreshUserData();
              }
            } catch (forceError) {
              console.log('❌ POST-PAYMENT: Force refresh error, using fallback:', forceError);
              await refreshUserData();
            }
          }
          
          // 3. Force refetch all auth-related queries
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
          console.log('✅ POST-PAYMENT: All endpoints force refetched');
          
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
  }, [queryClient, refreshUserData, user?.email, toast]);
};