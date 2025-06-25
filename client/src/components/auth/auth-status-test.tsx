import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthStatusTest() {
  const [status, setStatus] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const addStatus = (message: string) => {
    setStatus(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testAuthentication = async () => {
    setTesting(true);
    setStatus([]);
    
    addStatus("Starting comprehensive authentication test...");
    
    try {
      // Test 1: Firebase configuration
      const { auth } = await import("@/lib/firebase");
      addStatus(`Firebase app initialized: ${auth.app.name}`);
      addStatus(`Auth domain: ${auth.app.options.authDomain}`);
      addStatus(`Current domain: ${window.location.hostname}`);
      
      // Test 2: Check for existing redirect result
      const { getRedirectResult, GoogleAuthProvider, signInWithRedirect } = await import("firebase/auth");
      
      addStatus("Checking for existing redirect result...");
      const redirectResult = await getRedirectResult(auth);
      
      if (redirectResult?.user) {
        addStatus(`Found redirect result! User: ${redirectResult.user.email}`);
        
        // Test backend session creation
        addStatus("Testing backend session creation...");
        const idToken = await redirectResult.user.getIdToken(true);
        
        const response = await fetch('/api/auth/firebase-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            idToken,
            provider: 'google.com',
            providerUserId: redirectResult.user.uid,
            email: redirectResult.user.email,
            displayName: redirectResult.user.displayName,
            photoURL: redirectResult.user.photoURL,
          }),
        });
        
        if (response.ok) {
          addStatus("✅ Backend session created successfully!");
          addStatus("🎉 Authentication test PASSED - redirecting to dashboard...");
          setTimeout(() => window.location.href = '/dashboard', 2000);
        } else {
          const errorData = await response.json();
          addStatus(`❌ Backend session failed: ${errorData.message}`);
        }
      } else {
        addStatus("No existing redirect result found");
        
        // Test 3: Initiate new authentication
        addStatus("Initiating new Google authentication...");
        
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        provider.setCustomParameters({
          'prompt': 'select_account'
        });
        
        addStatus("Starting redirect authentication...");
        await signInWithRedirect(auth, provider);
        addStatus("Redirect initiated - should be redirected to Google now...");
      }
      
    } catch (error: any) {
      addStatus(`❌ Error: ${error.code} - ${error.message}`);
      
      if (error.code === 'auth/unauthorized-domain') {
        addStatus("🔧 SOLUTION: Domain needs to be added to Firebase authorized domains");
        addStatus(`Current domain: ${window.location.hostname}`);
      } else if (error.code === 'auth/operation-not-allowed') {
        addStatus("🔧 SOLUTION: Enable Google sign-in in Firebase console");
      }
    } finally {
      setTesting(false);
    }
  };

  // Auto-run test on component mount to check for redirect results
  useEffect(() => {
    if (window.location.search.includes('google') || window.location.hash.includes('google')) {
      testAuthentication();
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Authentication Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testAuthentication}
          disabled={testing}
          className="w-full"
        >
          {testing ? "Testing..." : "Test Google Authentication"}
        </Button>
        
        {status.length > 0 && (
          <Alert>
            <AlertDescription>
              <div className="font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                {status.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}