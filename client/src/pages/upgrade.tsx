import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/components/auth/UltimateAuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, X, Crown, Zap, Image, Infinity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export default function Upgrade() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);

  // Get upgrade plans and current status
  const { data: plansData, isLoading } = useQuery({
    queryKey: ['/api/upgrade/plans'],
    enabled: !!user
  });

  const { data: statusData } = useQuery({
    queryKey: ['/api/upgrade/status'],
    enabled: !!user
  });

  // Create checkout session mutation
  const createCheckoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/upgrade/create-checkout-session');
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log('Payment response:', data);
      
      if (data.success && data.redirectUrl) {
        console.log('Redirecting to PayU payment gateway:', data.redirectUrl);
        
        toast({
          title: "Redirecting to Payment Gateway",
          description: "Please wait while we redirect you to PayU...",
        });
        
        // Direct redirect to our server endpoint that handles PayU form submission
        window.location.href = data.redirectUrl;
        
      } else if (data.paymentParams && data.paymentUrl) {
        console.log('Creating PayU payment form with parameters:', Object.keys(data.paymentParams));
        
        try {
          // Create a form and submit it directly to PayU
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = data.paymentUrl;
          form.style.display = 'none';
          
          // Add all payment parameters as hidden inputs
          Object.entries(data.paymentParams).forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = String(value);
            form.appendChild(input);
            
            console.log('Adding field:', key, '=', String(value).length > 50 ? String(value).substring(0, 50) + '...' : String(value));
          });
          
          // Verify required fields are present
          const requiredFields = ['key', 'amount', 'email', 'hash', 'txnid'];
          const missingFields = requiredFields.filter(field => !data.paymentParams[field]);
          
          if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
          }
          
          document.body.appendChild(form);
          console.log('Submitting PayU form to:', form.action);
          console.log('Transaction ID:', data.paymentParams.txnid);
          
          // Show loading message
          toast({
            title: "Redirecting to Payment Gateway",
            description: "Please wait while we redirect you to PayU...",
          });
          
          form.submit();
          
        } catch (formError) {
          console.error('Form creation error:', formError);
          toast({
            title: "Payment Form Error",
            description: "Failed to create payment form. Please try again.",
            variant: "destructive",
          });
        }
      } else if (data.checkoutUrl || data.redirectUrl) {
        const url = data.redirectUrl || data.checkoutUrl;
        console.log('Redirecting to checkout URL:', url);
        window.location.href = url;
      } else if (data.error) {
        console.error('Payment error from server:', data.error);
        toast({
          title: "Payment Error",
          description: data.error,
          variant: "destructive",
        });
      } else {
        console.error('Unknown payment response:', data);
        toast({
          title: "Payment System Error",
          description: "Unable to process payment. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout Failed",
        description: error.message || "Failed to start checkout process",
        variant: "destructive",
      });
    }
  });

  const handleUpgrade = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upgrade your account",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      await createCheckoutMutation.mutateAsync();
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="h-96 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const plans = (plansData as any)?.plans || [];
  const currentTier = (plansData as any)?.currentTier || 'free';
  const usage = (plansData as any)?.usage || {};

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          Unlock the full power of IndieShots for your filmmaking projects
        </p>
      </div>

      {/* Current Usage Display */}
      {currentTier === 'free' && (
        <Card className="mb-8 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              Current Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Pages Used</span>
                  <span>{usage.pagesUsed || 0}/{usage.totalPages || 5} pages</span>
                </div>
                <Progress 
                  value={usage.totalPages ? (usage.pagesUsed / usage.totalPages) * 100 : 0} 
                  className="h-2"
                />
              </div>
              {(statusData as any)?.needsUpgrade?.forMorePages && (
                <p className="text-sm text-amber-600">
                  You're approaching your page limit. Upgrade to Pro for unlimited pages.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {plans.map((plan: any) => (
          <Card 
            key={plan.id} 
            className={`relative ${plan.popular ? 'border-primary ring-2 ring-primary/20' : ''} ${plan.current ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {plan.id === 'pro' ? (
                      <Crown className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Zap className="h-5 w-5" />
                    )}
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    <span className="text-3xl font-bold">
                      ${plan.price}
                    </span>
                    {plan.price > 0 && <span className="text-muted-foreground">/{plan.interval}</span>}
                  </CardDescription>
                </div>
                {plan.current && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Current Plan
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Features Included:</h4>
                  <ul className="space-y-2">
                    {plan.features.map((feature: string, index: number) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {plan.limitations.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-muted-foreground">Limitations:</h4>
                    <ul className="space-y-2">
                      {plan.limitations.map((limitation: string, index: number) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <X className="h-4 w-4 flex-shrink-0" />
                          {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-4">
                  {plan.current ? (
                    <Button disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : plan.id === 'pro' ? (
                    <Button 
                      onClick={handleUpgrade}
                      disabled={isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? 'Processing...' : 'Upgrade to Pro'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feature Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Comparison</CardTitle>
          <CardDescription>
            See what you get with each plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Feature</th>
                  <th className="text-center p-2">Free</th>
                  <th className="text-center p-2">Pro</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                <tr className="border-b">
                  <td className="p-2">Pages per month</td>
                  <td className="text-center p-2">5</td>
                  <td className="text-center p-2">
                    <Infinity className="h-4 w-4 mx-auto" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Shots per scene</td>
                  <td className="text-center p-2">5</td>
                  <td className="text-center p-2">
                    <Infinity className="h-4 w-4 mx-auto" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Storyboard generation</td>
                  <td className="text-center p-2">
                    <X className="h-4 w-4 mx-auto text-red-500" />
                  </td>
                  <td className="text-center p-2">
                    <CheckCircle className="h-4 w-4 mx-auto text-green-600" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">AI image generation</td>
                  <td className="text-center p-2">
                    <X className="h-4 w-4 mx-auto text-red-500" />
                  </td>
                  <td className="text-center p-2">
                    <Image className="h-4 w-4 mx-auto text-green-600" />
                  </td>
                </tr>
                <tr>
                  <td className="p-2">Priority support</td>
                  <td className="text-center p-2">
                    <X className="h-4 w-4 mx-auto text-red-500" />
                  </td>
                  <td className="text-center p-2">
                    <CheckCircle className="h-4 w-4 mx-auto text-green-600" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <div className="mt-12 text-center">
        <h3 className="text-xl font-semibold mb-4">Questions?</h3>
        <p className="text-muted-foreground mb-4">
          Need help choosing the right plan? We're here to help.
        </p>
        <Button variant="outline" onClick={() => window.location.href = 'mailto:indieshots@theindierise.com'}>
          Get help
        </Button>
      </div>
    </div>
  );
}