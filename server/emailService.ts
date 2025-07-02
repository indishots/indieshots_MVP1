import crypto from 'crypto';

// For now, we'll simulate email sending until you provide email credentials
// In production, you would replace this with actual email service

// Generate 6-digit OTP
export const generateOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

// Log OTP to console for development
export const logOTPToConsole = (email: string, name: string, otp: string): void => {
  console.log(`\n🔐 EMAIL VERIFICATION OTP`);
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Name: ${name || 'User'}`);
  console.log(`🔑 OTP Code: ${otp}`);
  console.log(`⏰ Expires in 10 minutes`);
  console.log(`===============================\n`);
};

// Send OTP email - For demo, we'll log the OTP to console
export const sendOTPEmail = async (email: string, otp: string, name?: string): Promise<boolean> => {
  try {
    // For development/demo - log OTP to console
    console.log(`\n=== EMAIL VERIFICATION OTP ===`);
    console.log(`Email: ${email}`);
    console.log(`Name: ${name || 'User'}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`=== Use this code to verify your email ===\n`);
    
    // In production, you would replace this with actual email service like:
    // - SendGrid (free tier: 100 emails/day)
    // - Nodemailer with Gmail SMTP
    // - AWS SES
    // - Resend
    
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};

// Verify OTP (simple in-memory store for demo - in production use Redis or database)
const otpStore = new Map<string, { otp: string; expires: number; userData: any }>();

export const storeOTP = (email: string, otp: string, userData: any): void => {
  const expires = Date.now() + (10 * 60 * 1000); // 10 minutes
  otpStore.set(email, { otp, expires, userData });
  
  // Clean up expired OTPs
  setTimeout(() => {
    otpStore.delete(email);
  }, 10 * 60 * 1000);
};

export const verifyOTP = (email: string, otp: string): { valid: boolean; userData?: any } => {
  const stored = otpStore.get(email);
  
  if (!stored) {
    return { valid: false };
  }
  
  if (Date.now() > stored.expires) {
    otpStore.delete(email);
    return { valid: false };
  }
  
  if (stored.otp !== otp) {
    return { valid: false };
  }
  
  const userData = stored.userData;
  otpStore.delete(email);
  return { valid: true, userData };
};

export const resendOTP = async (email: string): Promise<boolean> => {
  const stored = otpStore.get(email);
  if (!stored) {
    return false;
  }
  
  const newOTP = generateOTP();
  const success = await sendOTPEmail(email, newOTP, stored.userData.firstName);
  
  if (success) {
    storeOTP(email, newOTP, stored.userData);
  }
  
  return success;
};