import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';

const OTP_EXPIRY_MINUTES = 5;

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeOTP(email: string, otp: string) {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }

    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + OTP_EXPIRY_MINUTES);

    const otpDoc = {
      email,
      otp,
      expiryTime: expiryTime.toISOString(),
      createdAt: new Date().toISOString()
    };

    const otpsCollection = collection(db, 'otps');
    const docRef = await addDoc(otpsCollection, otpDoc);
    console.log('OTP stored successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error storing OTP:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to store OTP: ${error.message}`);
    }
    throw new Error('Failed to store OTP');
  }
}

export async function verifyOTP(email: string, otp: string): Promise<boolean> {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }

    const otpsCollection = collection(db, 'otps');
    const q = query(
      otpsCollection,
      where('email', '==', email),
      where('otp', '==', otp)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('No matching OTP found');
      return false;
    }

    const otpDoc = querySnapshot.docs[0];
    const otpData = otpDoc.data();
    const expiryTime = new Date(otpData.expiryTime);
    const now = new Date();

    if (now > expiryTime) {
      console.log('OTP has expired');
      await deleteDoc(otpDoc.ref);
      return false;
    }

    // Delete the used OTP
    await deleteDoc(otpDoc.ref);
    console.log('OTP verified successfully');
    return true;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to verify OTP: ${error.message}`);
    }
    throw new Error('Failed to verify OTP');
  }
} 