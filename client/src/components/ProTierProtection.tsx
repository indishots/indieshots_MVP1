import { useEffect } from 'react';
import { useAuth } from '@/components/auth/UltimateAuthProvider';
import { useQueryClient } from '@tanstack/react-query';

export const ProTierProtection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    // EMERGENCY PRO TIER PROTECTION: Prevent any reversion to free account
    const protectProTier = () => {
      if (!user?.email) return;

      // Check if user was ever pro tier or has payment success
      const wasProTier = localStorage.getItem(`pro_tier_${user.email}`) === 'true';
      const forceProStatus = localStorage.getItem(`force_pro_${user.email}`) === 'true';
      const hasPaymentSuccess = localStorage.getItem(`payment_success_${user.email}`);
      
      if (user.tier === 'pro') {
        // Mark user as pro tier permanently
        localStorage.setItem(`pro_tier_${user.email}`, 'true');
        console.log('✅ PRO PROTECTION: Pro tier status saved');
      } else if ((wasProTier || forceProStatus || hasPaymentSuccess) && user.tier === 'free') {
        // EMERGENCY: Pro user detected as free - immediate fix
        console.log('🚨 PRO PROTECTION: EMERGENCY - Pro user showing as free after payment!');
        
        // Force database update to pro first
        fetch('/api/auth-bypass/force-pro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
          credentials: 'include'
        }).then(response => {
          if (response.ok) {
            console.log('✅ PRO PROTECTION: Database forced to pro');
            
            // Then force refresh authentication
            return fetch(`/api/force-refresh/${encodeURIComponent(user.email)}`, {
              method: 'POST',
              credentials: 'include',
              cache: 'no-cache'
            });
          }
        }).then(response => {
          if (response && response.ok) {
            console.log('✅ PRO PROTECTION: Emergency refresh successful');
            queryClient.clear();
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        }).catch(error => {
          console.log('❌ PRO PROTECTION: Emergency fix failed, forcing reload');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        });
      }
    };

    // Run protection check immediately and every 2 seconds for more aggressive protection
    protectProTier();
    const interval = setInterval(protectProTier, 2000);

    return () => clearInterval(interval);
  }, [user?.email, user?.tier, queryClient]);

  return null;
};