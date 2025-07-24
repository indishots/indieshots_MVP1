import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

declare global {
  interface Window {
    proStatusLocked?: boolean;
    interceptorInstalled?: boolean;
  }
}

export const InstantProLock = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Check for payment success immediately
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentSuccess = urlParams.get('status') === 'success';
    
    if (isPaymentSuccess && !window.proStatusLocked) {
      console.log('⚡ INSTANT LOCK: Payment success detected - activating immediate pro lock');
      
      // Mark as locked immediately
      window.proStatusLocked = true;
      localStorage.setItem('instant_pro_lock', 'true');
      localStorage.setItem('pro_lock_timestamp', Date.now().toString());
      
      // Install fetch interceptor IMMEDIATELY before any auth requests
      installProFetchInterceptor();
      
      // Force set all query data immediately
      setProQueryData();
      
      // Clean URL without refresh
      setTimeout(() => {
        const newUrl = window.location.pathname;
        window.history.replaceState(null, '', newUrl);
      }, 1000);
    }
    
    // Always maintain pro status if previously locked
    if (localStorage.getItem('instant_pro_lock') === 'true' && !window.interceptorInstalled) {
      installProFetchInterceptor();
      setProQueryData();
    }
  }, [queryClient]);

  const installProFetchInterceptor = () => {
    if (window.interceptorInstalled) return;
    
    console.log('🔒 Installing pro fetch interceptor');
    window.interceptorInstalled = true;
    
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      let url: string;
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof Request) {
        url = input.url;
      } else {
        url = String(input);
      }
      
      // Always force pro responses when locked
      if (localStorage.getItem('instant_pro_lock') === 'true') {
        if (url.includes('/api/auth/user')) {
          console.log('🔒 BLOCKING auth/user - returning pro data');
          return new Response(JSON.stringify({
            tier: 'pro',
            totalPages: -1,
            maxShotsPerScene: -1,
            canGenerateStoryboards: true,
            email: 'pro@user.com'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (url.includes('/api/upgrade/status')) {
          console.log('🔒 BLOCKING upgrade/status - returning pro data');
          return new Response(JSON.stringify({
            tier: 'pro',
            limits: {
              tier: 'pro',
              totalPages: -1,
              usedPages: 0,
              maxShotsPerScene: -1,
              canGenerateStoryboards: true
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      return originalFetch(input, init);
    };
  };

  const setProQueryData = () => {
    const proUserData = {
      tier: 'pro',
      totalPages: -1,
      maxShotsPerScene: -1,
      canGenerateStoryboards: true,
      email: 'pro@user.com'
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
    
    // Force set query cache
    queryClient.setQueryData(['/api/auth/user'], proUserData);
    queryClient.setQueryData(['/api/upgrade/status'], proStatusData);
    queryClient.setQueryData(['/api/upgrade/plans'], { currentTier: 'pro' });
    
    // Invalidate and refetch to trigger updates
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    queryClient.invalidateQueries({ queryKey: ['/api/upgrade/status'] });
  };

  return null;
};