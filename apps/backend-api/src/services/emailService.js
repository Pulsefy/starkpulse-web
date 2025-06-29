const nodemailer = require("nodemailer")

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  async sendWelcomeEmail(email, firstName) {
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: "Welcome to Our Platform!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin-bottom: 10px;">Welcome ${firstName}!</h1>
            <p style="color: #666; font-size: 16px;">Thank you for joining our platform</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Getting Started</h2>
            <p style="color: #666; line-height: 1.6;">
              We're excited to have you on board! You can now access all features of your account and customize your experience according to your preferences.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background-color: #007cba; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 14px; text-align: center;">
              If you have any questions, feel free to contact our support team.<br>
              Best regards,<br>The Team
            </p>
          </div>
        </div>
      `,
    }

    return await this.transporter.sendMail(mailOptions)
  }

  async sendPasswordResetEmail(email, firstName, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin-bottom: 10px;">Password Reset Request</h1>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p style="color: #666; font-size: 16px;">Hi ${firstName},</p>
            <p style="color: #666; line-height: 1.6;">
              You requested a password reset for your account. Click the button below to reset your password:
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>Security Notice:</strong> This link will expire in 1 hour for security reasons.
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 14px; text-align: center;">
              If you didn't request this password reset, please ignore this email.<br>
              Your password will remain unchanged.<br><br>
              Best regards,<br>The Team
            </p>
          </div>
        </div>
      `,
    }

    return await this.transporter.sendMail(mailOptions)
  }

  async sendAccountDeletionEmail(email, firstName) {
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: "Account Deletion Confirmation",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin-bottom: 10px;">Account Deletion Confirmation</h1>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p style="color: #666; font-size: 16px;">Hi ${firstName},</p>
            <p style="color: #666; line-height: 1.6;">
              Your account has been successfully deleted as requested.
            </p>
          </div>
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="color: #155724; margin: 0; font-size: 14px;">
              <strong>GDPR Compliance:</strong> All your personal data has been permanently removed from our systems in compliance with GDPR regulations.
            </p>
          </div>
          
          <div style="margin: 20px 0;">
            <p style="color: #666; line-height: 1.6;">
              We're sorry to see you go. If you have any questions or concerns about the deletion process, 
              please contact our support team within the next 30 days.
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 14px; text-align: center;">
              Thank you for being part of our community.<br><br>
              Best regards,<br>The Team
            </p>
          </div>
        </div>
      `,
    }

    return await this.transporter.sendMail(mailOptions)
  }

  async sendEmailVerificationEmail(email, firstName, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: "Please Verify Your Email Address",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin-bottom: 10px;">Verify Your Email Address</h1>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p style="color: #666; font-size: 16px;">Hi ${firstName},</p>
            <p style="color: #666; line-height: 1.6;">
              Please click the button below to verify your email address and complete your account setup:
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="color: #0c5460; margin: 0; font-size: 14px;">
              <strong>Note:</strong> This verification link will expire in 24 hours.
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 14px; text-align: center;">
              If you didn't create this account, please ignore this email.<br><br>
              Best regards,<br>The Team
            </p>
          </div>
        </div>
      `,
    }

    return await this.transporter.sendMail(mailOptions)
  }
}

module.exports = new EmailService()
