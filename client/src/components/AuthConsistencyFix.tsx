import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/UltimateAuthProvider';
import { useQueryClient } from '@tanstack/react-query';

export const AuthConsistencyFix = () => {
  const { user, refreshUserData } = useAuth();
  const queryClient = useQueryClient();
  const [fixAttempts, setFixAttempts] = useState(0);
  const [isFixing, setIsFixing] = useState(false);

  useEffect(() => {
    // Check for authentication inconsistency every 5 seconds
    const checkConsistency = async () => {
      if (!user?.email || isFixing || fixAttempts >= 3) return;

      try {
        setIsFixing(true);
        
        // Check current upgrade status
        const upgradeResponse = await fetch('/api/upgrade/status', {
          credentials: 'include',
          cache: 'no-cache'
        });

        if (!upgradeResponse.ok) {
          console.log('🔧 AUTH CONSISTENCY: Token invalid, forcing refresh...');
          
          // Force comprehensive refresh
          queryClient.clear();
          await refreshUserData();
          setFixAttempts(prev => prev + 1);
          
          // Wait 2 seconds then check again
          setTimeout(() => {
            setIsFixing(false);
          }, 2000);
          
          return;
        }

        const upgradeData = await upgradeResponse.json();
        console.log('🔍 AUTH CONSISTENCY: Current status:', upgradeData);

        // Check if tier is consistent
        if (upgradeData.tier !== user.tier) {
          console.log('🔧 AUTH CONSISTENCY: Tier mismatch detected, fixing...');
          
          // Clear cache and refresh
          queryClient.clear();
          await refreshUserData();
          setFixAttempts(prev => prev + 1);
        }
        
      } catch (error) {
        console.log('❌ AUTH CONSISTENCY: Check failed:', error);
      } finally {
        setIsFixing(false);
      }
    };

    // Run consistency check every 5 seconds for first 30 seconds after mount
    const interval = setInterval(checkConsistency, 5000);
    
    // Stop after 30 seconds to avoid infinite checking
    setTimeout(() => {
      clearInterval(interval);
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.email, user?.tier, refreshUserData, queryClient, fixAttempts, isFixing]);

  // Don't render anything visible - this is a background service
  return null;
};