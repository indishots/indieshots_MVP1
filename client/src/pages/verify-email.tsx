import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface VerifyEmailProps {
  email?: string;
}

export default function VerifyEmail({ email: propEmail }: VerifyEmailProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [isHybridMode, setIsHybridMode] = useState(false);

  // Get email and mode from URL parameters
  useEffect(() => {
    if (propEmail) {
      setEmail(propEmail);
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const emailParam = urlParams.get('email');
      const modeParam = urlParams.get('mode');
      if (emailParam) {
        setEmail(decodeURIComponent(emailParam));
      }
      if (modeParam === 'hybrid') {
        setIsHybridMode(true);
      }
    }
  }, [propEmail]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Verify email mutation
  const verifyMutation = useMutation({
    mutationFn: async (data: { email: string; otp: string }) => {
      const endpoint = isHybridMode ? '/api/auth/hybrid-verify-otp' : '/api/auth/verify-email';
      
      try {
        const response = await apiRequest('POST', endpoint, data);
        return response.json();
      } catch (error: any) {
        // Parse the error response to get structured error data
        if (error.message && error.message.includes(':')) {
          try {
            const errorText = error.message.split(': ')[1];
            const errorData = JSON.parse(errorText);
            throw { response: { status: parseInt(error.message.split(':')[0]), data: errorData } };
          } catch (parseError) {
            // If JSON parsing fails, throw original error
            throw error;
          }
        }
        throw error;
      }
    },
    onSuccess: async (data) => {
      toast({
        title: "Email Verified!",
        description: "Your account has been created successfully.",
      });
      
      // Use custom token to authenticate with Firebase (hybrid mode)
      if (data.token && isHybridMode) {
        try {
          // Import authManager to use signInWithToken
          const { authManager } = await import('@/lib/authManager');
          const result = await authManager.signInWithToken(data.token);
          
          if (!result.success) {
            console.error('Custom token authentication failed:', result.error);
            // Fallback to storing token
            localStorage.setItem('authToken', data.token);
          }
        } catch (error) {
          console.error('Error during custom token signin:', error);
          // Fallback to storing token
          localStorage.setItem('authToken', data.token);
        }
      } else if (data.token) {
        // Legacy mode - store token
        localStorage.setItem('authToken', data.token);
      }
      
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      let errorMessage = "Invalid or expired verification code";
      let errorTitle = "Verification Failed";
      
      // Parse server error response
      if (error?.response?.status === 400) {
        const errorData = error.response.data;
        if (errorData?.code === 'OTP_EXPIRED') {
          errorTitle = "Code Expired";
          errorMessage = "Your verification code has expired. Please request a new code.";
        } else if (errorData?.code === 'INVALID_OTP') {
          errorTitle = "Invalid Code";
          errorMessage = errorData.attemptsLeft 
            ? `The verification code is incorrect. You have ${errorData.attemptsLeft} attempts remaining.`
            : "The verification code you entered is incorrect. Please try again.";
        } else if (errorData?.code === 'TOO_MANY_ATTEMPTS') {
          errorTitle = "Too Many Attempts";
          errorMessage = "Too many failed attempts. Please request a new verification code.";
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } else if (error?.message?.includes('OTP expired')) {
        errorTitle = "Code Expired";
        errorMessage = "Your verification code has expired. Please request a new code.";
      } else if (error?.message?.includes('Invalid OTP')) {
        errorTitle = "Invalid Code";
        errorMessage = "The verification code you entered is incorrect. Please try again.";
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  // Resend OTP mutation
  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const endpoint = isHybridMode ? '/api/auth/hybrid-resend-otp' : '/api/auth/resend-otp';
      
      try {
        const response = await apiRequest('POST', endpoint, { email });
        return response.json();
      } catch (error: any) {
        // Parse the error response to get structured error data
        if (error.message && error.message.includes(':')) {
          try {
            const errorText = error.message.split(': ')[1];
            const errorData = JSON.parse(errorText);
            throw { response: { status: parseInt(error.message.split(':')[0]), data: errorData } };
          } catch (parseError) {
            // If JSON parsing fails, throw original error
            throw error;
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Code Resent",
        description: "A new verification code has been sent to your email.",
      });
      setTimeLeft(300); // Reset timer
      setOtp(""); // Clear current OTP
    },
    onError: (error: any) => {
      let errorMessage = "Failed to resend verification code";
      let errorTitle = "Resend Failed";
      
      // Parse server error response
      if (error?.response?.status === 400) {
        const errorData = error.response.data;
        if (errorData?.code === 'EMAIL_NOT_FOUND') {
          errorTitle = "Email Not Found";
          errorMessage = "No pending verification found for this email. Please sign up again.";
        } else if (errorData?.code === 'RATE_LIMITED') {
          errorTitle = "Too Many Requests";
          errorMessage = "Please wait before requesting another code.";
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and verification code",
        variant: "destructive"
      });
      return;
    }
    verifyMutation.mutate({ email, otp });
  };

  const handleResend = () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive"
      });
      return;
    }
    resendMutation.mutate(email);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a 6-digit verification code to your email address. 
            Enter it below to complete your registration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                placeholder="Enter 6-digit code"
                className="text-center text-lg tracking-widest"
                maxLength={6}
                required
              />
            </div>

            {timeLeft > 0 && (
              <div className="text-center text-sm text-muted-foreground">
                Code expires in {formatTime(timeLeft)}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={verifyMutation.isPending || otp.length !== 6}
            >
              {verifyMutation.isPending ? "Verifying..." : "Verify Email"}
            </Button>
          </form>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Didn't receive the code?
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={resendMutation.isPending || timeLeft > 270} // Allow resend after 30 seconds
              className="text-sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {resendMutation.isPending ? "Sending..." : "Resend Code"}
            </Button>
          </div>

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/auth')}
              className="text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sign Up
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}