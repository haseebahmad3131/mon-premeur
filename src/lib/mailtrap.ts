import axios from 'axios';

// Use environment variables for sensitive data
const MAILTRAP_API_URL = 'https://team-staging.softpers.com/api/send-test-email';

interface MailtrapEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendMailtrapEmail = async (params: MailtrapEmailParams) => {
  
  try {

    const response = await axios.post(
      MAILTRAP_API_URL,
      {
         email: params.to,
        text: params.text,
        html: params.html,
        category: "EmailWithText", // Adding category as per documentation
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Email sent successfully:', response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Mailtrap API Error Details:', {
        code: error.code,
        message: error.message,
        response: {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers,
        },
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        }
      });

      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please check your API token.');
      }
      if (error.response?.status === 403) {
        throw new Error('Access forbidden. Please ensure you have the correct permissions and are using an Email Sending API token.');
      }
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Unable to connect to email service. Please check your internet connection and try again.');
      }
      if (error.response) {
        const errorMessage = error.response.data?.message || error.message;
        throw new Error(`Email service error (${error.response.status}): ${errorMessage}`);
      }
      throw new Error(`Failed to send email: ${error.message}`);
    }
    console.error('Unexpected error:', error);
    throw error;
  }
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
export const sendOTPEmail = async (email: string, otp: string) => {
  const subject = 'Your OTP Code - Solution 360';
  const text = `Your OTP code is: ${otp}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Solution 360 - OTP Verification</h2>
      <p>Your OTP code is:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
        ${otp}
      </div>
      <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
    </div>
  `;

  return sendMailtrapEmail({
    to: email,
    subject,
    text,
    html,
  });
}; 