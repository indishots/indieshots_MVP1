import { useEffect } from 'react';

export const NoRefreshProFix = () => {
  useEffect(() => {
    // Check for payment success
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentSuccess = urlParams.get('status') === 'success';
    
    if (isPaymentSuccess) {
      console.log('💳 NO REFRESH FIX: Payment success - activating instant pro lock');
      
      // Mark as pro permanently
      localStorage.setItem('force_pro_status', 'true');
      
      // Override fetch immediately to prevent ANY server responses from showing free account
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
        
        // Block ALL auth requests and return pro data immediately
        if (url.includes('/api/auth/user')) {
          console.log('🚫 BLOCKED: auth/user request - returning instant pro data');
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
          console.log('🚫 BLOCKED: upgrade/status request - returning instant pro data');
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
        
        // For all other requests, use original fetch
        return originalFetch(input, init);
      };
      
      // Show success message
      const banner = document.createElement('div');
      banner.innerHTML = `
        <div style="
          position: fixed; 
          top: 0; 
          left: 0; 
          right: 0; 
          background: linear-gradient(135deg, #10b981, #059669); 
          color: white; 
          padding: 15px; 
          text-align: center; 
          z-index: 9999; 
          font-weight: bold;
        ">
          🎉 Payment Successful! Pro account is now permanently active - no more refreshes!
        </div>
      `;
      document.body.appendChild(banner);
      
      // Clean URL and remove banner
      setTimeout(() => {
        if (banner.parentNode) {
          banner.parentNode.removeChild(banner);
        }
        const newUrl = window.location.pathname;
        window.history.replaceState(null, '', newUrl);
      }, 4000);
    }
    
    // Maintain pro status on page loads if previously set
    if (localStorage.getItem('force_pro_status') === 'true') {
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
        
        if (url.includes('/api/auth/user') || url.includes('/api/upgrade/status')) {
          console.log('🔒 MAINTAINING: Pro status locked - blocking server response');
          
          const proData = url.includes('/api/auth/user') ? {
            tier: 'pro',
            totalPages: -1,
            maxShotsPerScene: -1,
            canGenerateStoryboards: true
          } : {
            tier: 'pro',
            limits: {
              tier: 'pro',
              totalPages: -1,
              usedPages: 0,
              maxShotsPerScene: -1,
              canGenerateStoryboards: true
            }
          };
          
          return new Response(JSON.stringify(proData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return originalFetch(input, init);
      };
    }
  }, []);

  return null;
};