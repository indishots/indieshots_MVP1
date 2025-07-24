import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/components/auth/UltimateAuthProvider';
import { useQueryClient } from '@tanstack/react-query';

export const PostPaymentLock = () => {
  const [location] = useLocation();
  const { user, refreshUserData } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Check if we're on dashboard after payment success
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentSuccess = urlParams.get('status') === 'success';
    const isDashboard = location === '/dashboard';
    
    if (isPaymentSuccess && isDashboard && user?.email) {
      console.log('🔒 POST-PAYMENT LOCK: Payment success detected, locking pro status');
      
      // Immediately lock pro status
      localStorage.setItem(`payment_success_${user.email}`, Date.now().toString());
      localStorage.setItem(`force_pro_${user.email}`, 'true');
      
      // Override authentication checks for this user
      const lockProStatus = async () => {
        try {
          // Force database tier update first
          const updateResponse = await fetch('/api/auth-bypass/force-pro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email }),
            credentials: 'include'
          });
          
          if (updateResponse.ok) {
            console.log('✅ POST-PAYMENT LOCK: Database updated to pro');
            
            // Force new token generation
            const tokenResponse = await fetch(`/api/force-refresh/${encodeURIComponent(user.email)}`, {
              method: 'POST',
              credentials: 'include'
            });
            
            if (tokenResponse.ok) {
              console.log('✅ POST-PAYMENT LOCK: Pro token generated');
              
              // Clear all caches
              queryClient.clear();
              
              // Refresh user data
              await refreshUserData();
              
              // Remove payment params from URL
              const newUrl = window.location.pathname;
              window.history.replaceState(null, '', newUrl);
              
              console.log('🔒 POST-PAYMENT LOCK: Pro status locked successfully');
            }
          }
        } catch (error) {
          console.error('❌ POST-PAYMENT LOCK: Failed:', error);
        }
      };
      
      // Execute immediately
      lockProStatus();
    }
  }, [location, user?.email, refreshUserData, queryClient]);

  return null;
};