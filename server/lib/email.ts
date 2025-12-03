import nodemailer from 'nodemailer';
import crypto from 'crypto';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL || '',
    pass: process.env.EMAIL_PSWD || '',
  },
});

export async function sendVerificationEmail(email: string, token: string, baseUrl: string) {
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: 'Verify your ChatFlow account',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">ChatFlow</h1>
          <p style="color: #6b7280; margin: 10px 0 0 0;">Real-time Chat Application</p>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
          <h2 style="color: #111827; margin: 0 0 20px 0;">Set your password and verify your account</h2>
          <p style="color: #374151; margin: 0 0 20px 0; line-height: 1.6;">
            Thanks for signing up for ChatFlow! To complete your registration and start chatting with friends, 
            please click the button below to set your password and verify your email address.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Set Password & Verify
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <span style="word-break: break-all;">${verificationUrl}</span>
          </p>
        </div>
        
        <div style="text-align: center; color: #9ca3af; font-size: 14px;">
          <p>This verification link will expire in 24 hours.</p>
          <p>If you didn't create a ChatFlow account, please ignore this email.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, token: string, baseUrl: string) {
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: 'Reset your ChatFlow password',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">ChatFlow</h1>
          <p style="color: #6b7280; margin: 10px 0 0 0;">Real-time Chat Application</p>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
          <h2 style="color: #111827; margin: 0 0 20px 0;">Reset your password</h2>
          <p style="color: #374151; margin: 0 0 20px 0; line-height: 1.6;">
            We received a request to reset your password for your ChatFlow account. 
            Click the button below to create a new password.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <span style="word-break: break-all;">${resetUrl}</span>
          </p>
        </div>
        
        <div style="text-align: center; color: #9ca3af; font-size: 14px;">
          <p>This reset link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
