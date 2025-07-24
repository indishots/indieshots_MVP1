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

      // Check if user was ever pro tier
      const wasProTier = localStorage.getItem(`pro_tier_${user.email}`) === 'true';
      
      if (user.tier === 'pro') {
        // Mark user as pro tier permanently
        localStorage.setItem(`pro_tier_${user.email}`, 'true');
        console.log('✅ PRO PROTECTION: Pro tier status saved');
      } else if (wasProTier && user.tier === 'free') {
        // EMERGENCY: Pro user detected as free - immediate fix
        console.log('🚨 PRO PROTECTION: EMERGENCY - Pro user showing as free!');
        
        // Force immediate refresh
        queryClient.clear();
        
        // Force refresh authentication
        fetch(`/api/force-refresh/${encodeURIComponent(user.email)}`, {
          method: 'POST',
          credentials: 'include',
          cache: 'no-cache'
        }).then(response => {
          if (response.ok) {
            console.log('✅ PRO PROTECTION: Emergency refresh successful');
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        }).catch(error => {
          console.log('❌ PRO PROTECTION: Emergency refresh failed, forcing reload');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        });
      }
    };

    // Run protection check immediately and every 3 seconds
    protectProTier();
    const interval = setInterval(protectProTier, 3000);

    return () => clearInterval(interval);
  }, [user?.email, user?.tier, queryClient]);

  return null;
};