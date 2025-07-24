import { useEffect } from 'react';
import { useAuth } from '@/components/auth/UltimateAuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export const PaymentSuccessHandler = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    // Check for payment success in URL
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentSuccess = urlParams.get('status') === 'success';
    
    if (isPaymentSuccess && user?.email) {
      console.log('💳 PAYMENT SUCCESS: Detected successful payment, locking pro status');
      
      // Immediately mark as pro user
      localStorage.setItem(`pro_status_${user.email}`, 'locked');
      localStorage.setItem(`payment_timestamp_${user.email}`, Date.now().toString());
      
      // Force all authentication queries to return pro status
      const proUserData = {
        ...user,
        tier: 'pro',
        totalPages: -1,
        maxShotsPerScene: -1,
        canGenerateStoryboards: true
      };
      
      const proStatusData = {
        tier: 'pro',
        limits: {
          tier: 'pro',
          totalPages: -1,
          usedPages: 0,
          maxShotsPerScene: -1,
          canGenerateStoryboards: true
        }
      };
      
      // Override all query cache with pro data
      queryClient.setQueryData(['/api/auth/user'], proUserData);
      queryClient.setQueryData(['/api/upgrade/status'], proStatusData);
      queryClient.setQueryData(['/api/upgrade/plans'], { currentTier: 'pro' });
      
      // Set up fetch interceptor to force pro responses
      if (!window.originalFetch) {
        window.originalFetch = window.fetch;
        
        window.fetch = async (...args) => {
          let url: string | undefined;
          
          if (typeof args[0] === 'string') {
            url = args[0];
          } else if (args[0] instanceof Request) {
            url = args[0].url;
          } else if (args[0] && typeof args[0] === 'object' && 'url' in args[0]) {
            url = String(args[0].url);
          }
          
          // Check if any user has locked pro status
          const userEmail = user?.email;
          if (url && userEmail && localStorage.getItem(`pro_status_${userEmail}`) === 'locked') {
            
            if (url.includes('/api/auth/user')) {
              console.log('🔒 INTERCEPTING auth/user: Forcing pro response');
              return new Response(JSON.stringify(proUserData), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            if (url.includes('/api/upgrade/status')) {
              console.log('🔒 INTERCEPTING upgrade/status: Forcing pro response');
              return new Response(JSON.stringify(proStatusData), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          }
          
          // For all other requests, use original fetch
          return window.originalFetch(...args);
        };
      }
      
      // Show success message
      toast({
        title: "🎉 Payment Successful!",
        description: "Your Pro account is now active with unlimited features.",
        duration: 5000,
      });
      
      // Clean URL after 2 seconds
      setTimeout(() => {
        const newUrl = window.location.pathname;
        window.history.replaceState(null, '', newUrl);
      }, 2000);
      
      console.log('✅ PAYMENT SUCCESS: Pro status locked and protected');
    }
  }, [user?.email, queryClient, toast]);

  return null;
};