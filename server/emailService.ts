import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Create transporter using Gmail SMTP (free)
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'indieshots@theindierise.com',
      pass: process.env.EMAIL_PASS || 'your-app-password'
    }
  });
};

// Generate 6-digit OTP
export const generateOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

// Send OTP email
export const sendOTPEmail = async (email: string, otp: string, name?: string): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'indieshots@theindierise.com',
      to: email,
      subject: 'Verify Your IndieShots Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Account</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3F51B5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp { font-size: 32px; font-weight: bold; color: #3F51B5; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; letter-spacing: 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to IndieShots!</h1>
            </div>
            <div class="content">
              <p>Hello ${name || 'there'},</p>
              <p>Thank you for signing up for IndieShots! To complete your registration and verify your email address, please use the following verification code:</p>
              
              <div class="otp">${otp}</div>
              
              <p>This code will expire in 10 minutes for security purposes.</p>
              
              <p>If you didn't create an account with IndieShots, please ignore this email.</p>
              
              <p>Welcome aboard!<br>
              The IndieShots Team</p>
            </div>
            <div class="footer">
              <p>© 2025 IndieShots. All rights reserved.</p>
              <p>Transform your scripts into professional shot lists with AI-powered precision.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent successfully to ${email}`);
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