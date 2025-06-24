import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'sandbox.smtp.mailtrap.io',
  port: 2525,
  secure: false,
  auth: {
    user:  '145b8c59f37cba',
    pass: 'c01f3976bfe377'
  }
});

export async function sendOTPEmail(email: string, otp: string) {
  try {
    const mailOptions = {
        from: {
          name: 'Ali Raza',
          address: 'dev@mon-primeur.net'
        },
        to: email,
        subject: 'Your Login OTP Code',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your Login OTP Code</h2>
          <p>Please use the following OTP code to complete your login:</p>
          <h1 style="font-size: 32px; letter-spacing: 5px; color: #4a90e2; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 5px;">${otp}</h1>
          <p>This OTP will expire in 5 minutes.</p>
          <p>If you didn't request this OTP, please ignore this email.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send OTP email');
  }
} 