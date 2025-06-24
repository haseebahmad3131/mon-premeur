import * as functions from 'firebase-functions';
import { CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FirebaseError } from 'firebase-admin';
import * as nodemailer from 'nodemailer';

// Initialize Firebase Admin
admin.initializeApp();

// Create SMTP transporter with retry logic
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: functions.config().email.user,
      pass: functions.config().email.pass
    },
    pool: true, // Use pooled connections
    maxConnections: 5,
    maxMessages: 100
  });
};

// Verify SMTP connection
const verifyTransporter = async (transporter: nodemailer.Transporter) => {
  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('SMTP connection verification failed:', error);
    return false;
  }
};

// Send email with retry logic
const sendEmailWithRetry = async (
  transporter: nodemailer.Transporter,
  mailOptions: nodemailer.SendMailOptions,
  maxRetries = 3
): Promise<void> => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully on attempt ${attempt}`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`Failed to send email on attempt ${attempt}:`, error);
      if (attempt < maxRetries) {
        // Wait for 2 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  throw lastError;
};

interface OtpData {
  code: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  attempts: number;
}

interface OtpRequest {
  email: string;
  otp?: string;
}

/**
 * Send OTP email to user
 */
export const sendOtpEmail = functions.https.onCall(async (data: CallableRequest<OtpRequest>) => {
  const { email } = data.data;

  // Validate email
  if (!email || !email.includes('@')) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid email address'
    );
  }

  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in Firestore
    const otpData: OtpData = {
      code: otp,
      email,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      attempts: 0
    };

    await admin.firestore()
      .collection('otps')
      .doc(email)
      .set(otpData);

    // Create and verify transporter
    const transporter = createTransporter();
    const isVerified = await verifyTransporter(transporter);
    
    if (!isVerified) {
      throw new Error('Failed to verify SMTP connection');
    }

    // Send email with improved formatting
    const mailOptions = {
      from: functions.config().email.user,
      to: email,
      subject: 'Your Login Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Your Login Code</h1>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; text-align: center;">
            <p style="font-size: 24px; font-weight: bold; color: #2196F3;">${otp}</p>
          </div>
          <p style="color: #666; margin-top: 20px;">This code will expire in 5 minutes.</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `
    };

    await sendEmailWithRetry(transporter, mailOptions);

    return { success: true };
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send OTP'
    );
  }
});

/**
 * Verify OTP and create/update user
 */
export const verifyOtp = functions.https.onCall(async (data: CallableRequest<OtpRequest>) => {
  const { email, otp } = data.data;

  // Validate inputs
  if (!email || !email.includes('@')) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid email address'
    );
  }

  if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid OTP format'
    );
  }

  try {
    // Get OTP data from Firestore
    const otpDoc = await admin.firestore()
      .collection('otps')
      .doc(email)
      .get();

    if (!otpDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'OTP not found or expired'
      );
    }

    const otpData = otpDoc.data() as OtpData;
    const now = new Date();

    // Check expiration
    if (new Date(otpData.expiresAt) < now) {
      await otpDoc.ref.delete();
      throw new functions.https.HttpsError(
        'failed-precondition',
        'OTP expired'
      );
    }

    // Check attempts
    if (otpData.attempts >= 3) {
      await otpDoc.ref.delete();
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Too many attempts'
      );
    }

    // Verify OTP
    if (otpData.code !== otp) {
      await otpDoc.ref.update({
        attempts: admin.firestore.FieldValue.increment(1)
      });
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid OTP'
      );
    }

    // Delete used OTP
    await otpDoc.ref.delete();

    // Create or get user
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if ((error as FirebaseError).code === 'auth/user-not-found') {
        // Create new user
        userRecord = await admin.auth().createUser({
          email,
          emailVerified: true
        });
      } else {
        throw error;
      }
    }

    // Create custom token
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    return { customToken };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to verify OTP'
    );
  }
}); 