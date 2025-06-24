import { generateOTP, storeOTP, verifyOTP } from '../lib/otp';

export async function sendOTP(email: string) {
  try {
    console.log('API: Sending OTP to:', email);
    
    // Generate and store OTP
    const otp = generateOTP();
    await storeOTP(email, otp);

    // Send OTP email through Express server endpoint
    console.log('API: Sending request to Express server endpoint');
    const response = await fetch('/api/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('API: Server error response:', data);
      throw new Error(data.error || 'Failed to send OTP email');
    }

    console.log('API: OTP sent successfully');
    return { success: true, message: 'OTP sent successfully' };
  } catch (error) {
    console.error('API: Error sending OTP:', error);
    throw error;
  }
}

export async function verifyOTPCode(email: string, otp: string) {
  try {
    console.log('API: Verifying OTP for:', email);
    
    const isValid = await verifyOTP(email, otp);
    
    if (!isValid) {
      throw new Error('Invalid or expired OTP');
    }

    console.log('API: OTP verified successfully');
    return { success: true, message: 'OTP verified successfully' };
  } catch (error) {
    console.error('API: Error verifying OTP:', error);
    throw error;
  }
} 