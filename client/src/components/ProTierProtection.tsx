import { useEffect } from 'react';
import { useAuth } from '@/components/auth/UltimateAuthProvider';
import { useQueryClient } from '@tanstack/react-query';

export const ProTierProtection = () => {
  // Component disabled to prevent hardcoded tier overrides
  return null;
    };

    // Run protection check immediately and every 2 seconds for more aggressive protection
    protectProTier();
    const interval = setInterval(protectProTier, 2000);

    return () => clearInterval(interval);
  }, [user?.email, user?.tier, queryClient]);

  return null;
};