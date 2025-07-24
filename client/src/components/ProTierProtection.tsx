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
        // Log situation but don't automatically upgrade - let legitimate processes handle tier changes
        console.log('ℹ️ PRO PROTECTION: User previously had pro status but is now free tier - no automatic upgrade');
        console.log('User should contact support or complete payment process again if this is incorrect');
      }
    };

    // Run protection check immediately and every 2 seconds for more aggressive protection
    protectProTier();
    const interval = setInterval(protectProTier, 2000);

    return () => clearInterval(interval);
  }, [user?.email, user?.tier, queryClient]);

  return null;
};