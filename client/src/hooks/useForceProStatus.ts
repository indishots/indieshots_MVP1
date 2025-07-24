import { useEffect } from 'react';
import { useAuth } from '@/components/auth/UltimateAuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export const useForceProStatus = () => {
  const { user, refreshUserData } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    // Check for payment success in URL
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentSuccess = urlParams.get('status') === 'success';
    
    if (isPaymentSuccess && user?.email) {
      console.log('🔒 FORCE PRO: Payment success detected, forcing pro status');
      
      // Mark user as pro immediately in localStorage
      localStorage.setItem(`pro_user_${user.email}`, 'true');
      localStorage.setItem(`payment_success_time_${user.email}`, Date.now().toString());
      
      // Override all authentication queries to return pro status
      const forceProData = {
        id: user.id,
        email: user.email,
        tier: 'pro',
        totalPages: -1,
        maxShotsPerScene: -1,
        canGenerateStoryboards: true,
        displayName: user.displayName
      };
      
      // Force set query data for all auth endpoints
      queryClient.setQueryData(['/api/auth/user'], forceProData);
      queryClient.setQueryData(['/api/upgrade/status'], {
        tier: 'pro',
        limits: {
          tier: 'pro',
          totalPages: -1,
          usedPages: 0,
          maxShotsPerScene: -1,
          canGenerateStoryboards: true
        }
      });
      queryClient.setQueryData(['/api/upgrade/plans'], {
        currentTier: 'pro',
        features: {
          unlimitedPages: true,
          unlimitedShots: true,
          storyboardGeneration: true
        }
      });
      
      // Show success message
      toast({
        title: "Payment Successful!",
        description: "Your Pro account is now active with unlimited features.",
        duration: 5000,
      });
      
      // Clean URL
      const newUrl = window.location.pathname;
      window.history.replaceState(null, '', newUrl);
      
      console.log('✅ FORCE PRO: Pro status forced successfully');
    }
  }, [user?.email, queryClient, toast]);

  // Check if user should be forced to pro status
  const shouldForceProStatus = user?.email && localStorage.getItem(`pro_user_${user.email}`) === 'true';
  
  return {
    isForceProUser: shouldForceProStatus,
    forceProData: shouldForceProStatus ? {
      tier: 'pro',
      totalPages: -1,
      maxShotsPerScene: -1,
      canGenerateStoryboards: true
    } : null
  };
};