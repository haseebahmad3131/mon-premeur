import React, { useState } from "react";
import { generateOTP, sendOTPEmail } from "./mailtrap";

const EmailOtp: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [generatedOtp, setGeneratedOtp] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const sendOtp = async () => {
    if (!email) {
      setMessage("Please enter your email address.");
      return;
    }

    setIsLoading(true);
    const otpCode = generateOTP();
    setGeneratedOtp(otpCode);
    console.log(otpCode);

    try {
      await sendOTPEmail(email, otpCode);
      setMessage("OTP sent to your email.");
    } catch (error) {
      console.error("Mailtrap Error:", error);
      setMessage("Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = () => {
    if (!otp) {
      setMessage("Please enter the OTP code.");
      return;
    }

    if (otp === generatedOtp) {
      setMessage("✅ OTP verified successfully!");
    } else {
      setMessage("❌ Invalid OTP. Try again.");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-2xl font-bold mb-6 text-center text-gray-800">Email OTP Verification</h3>

      <div className="space-y-4">
        <div>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>
        
        <button
          onClick={sendOtp}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? "Sending..." : "Send OTP"}
        </button>

        <div>
          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={6}
            pattern="[0-9]{6}"
          />
        </div>

        <button
          onClick={verifyOtp}
          className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition-colors"
        >
          Verify OTP
        </button>

        {message && (
          <p className={`text-center mt-4 ${
            message.includes("✅") ? "text-green-600" : 
            message.includes("❌") ? "text-red-600" : 
            "text-gray-600"
          }`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default EmailOtp;