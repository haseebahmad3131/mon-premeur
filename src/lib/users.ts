/**
 * User management service
 * Handles all user-related operations with Firestore
 */

import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, getDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { db, auth, storage } from './firebase';
import type { User, NewUser, UpdateUserData } from '../types';

// Constants
const USERS_COLLECTION = 'users';

/**
 * Fetch all users from Firestore
 * 
 * @returns Promise resolving to an array of User objects
 */
export async function getUsers(): Promise<User[]> {
  try {
    const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
    
    if (!querySnapshot.docs.length) {
      console.warn('No users found in collection');
    }
    
    return querySnapshot.docs.map((doc) => {
      const userData = doc.data() as Omit<User, 'id'>;
      return {
        id: doc.id,
        ...userData,
      };
    });
  } catch (error) {
    console.error('Error fetching users:', {
      error,
      timestamp: new Date().toISOString(),
      collection: USERS_COLLECTION
    });
    throw new Error(`Failed to fetch users: ${(error as Error).message}`);
  }
}

/**
 * Get a user by ID
 * 
 * @param userId - The ID of the user to retrieve
 * @returns Promise resolving to a User object or null if not found
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data() as Omit<User, 'id'>;
    return {
      id: userDoc.id,
      ...userData,
    };
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    throw new Error(`Failed to fetch user: ${(error as Error).message}`);
  }
}

/**
 * Get users by group
 * 
 * @param groupName - Name of the group to filter by
 * @returns Promise resolving to an array of User objects
 */
export async function getUsersByGroup(groupName: string): Promise<User[]> {
  try {
    const users = await getUsers();
    return users.filter(user => user.group === groupName);
  } catch (error) {
    console.error(`Error fetching users by group ${groupName}:`, error);
    throw new Error(`Failed to fetch users by group: ${(error as Error).message}`);
  }
}

/**
 * Get users by company
 * 
 * @param companyName - Name of the company to filter by
 * @returns Promise resolving to an array of User objects
 */
export async function getUsersByCompany(companyName: string): Promise<User[]> {
  try {
    const users = await getUsers();
    return users.filter(user => user.company === companyName);
  } catch (error) {
    console.error(`Error fetching users by company ${companyName}:`, error);
    throw new Error(`Failed to fetch users by company: ${(error as Error).message}`);
  }
}

/**
 * Create a new user in Firebase Auth and Firestore
 * 
 * @param userData - New user data including email, password, etc.
 * @returns Promise resolving to the ID of the created user
 */
export async function createUser(userData: NewUser): Promise<string> {
  try {
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password only for Admins
    if (userData.role === 'Admin') {
      if (!userData.password || userData.password.length < 8) {
        throw new Error('Password must be at least 8 characters long for Admin users');
      }
    }

    // Validate required fields
    if (!userData.name?.trim()) {
      throw new Error('Name is required');
    }

    if (!userData.company?.trim()) {
      throw new Error('Company is required');
    }

    if (!userData.role) {
      throw new Error('Role is required');
    }

    // Create auth user only if password is provided (Admin)
    let userCredential: any;
    if (userData.password) {
      userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );
    } else {
      // Check if the current user is an admin
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('You must be logged in to create users');
      }

      // Get the current user's role from Firestore
      const currentUserDoc = await getDoc(doc(db, USERS_COLLECTION, currentUser.uid));
      const currentUserData = currentUserDoc.data();
      
      if (currentUserData?.role !== 'Admin') {
        throw new Error('Only Admin users can create new users');
      }

      // For non-Admin roles (no password), generate a Firebase user manually
      userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        Math.random().toString(36).slice(-8) // Generate a random password
      );
    }

    let profileImageUrl = '';

    // Upload profile image if provided
    if (userData.profileImage) {
      const storageRef = ref(storage, `profile-images/${userCredential.user.uid}`);
      const snapshot = await uploadBytes(storageRef, userData.profileImage);
      profileImageUrl = await getDownloadURL(snapshot.ref);
    }

    // Create user document in Firestore
    const now = new Date().toISOString();
    const userDoc = {
      email: userData.email,
      name: userData.name,
      company: userData.company,
      role: userData.role,
      profileImageUrl,
      powerBiUrl: userData.powerBiUrl || '',
      // Only include group if it's provided and not undefined
      ...(userData.group && { group: userData.group }),
      loginHistory: [],
      loginCount7Days: 0,
      lastLogin: now,
      lastLoginIp: '',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, USERS_COLLECTION, userCredential.user.uid), userDoc);

    return userCredential.user.uid;
  } catch (error) {
    console.error('Error creating user:', error);
    throw new Error(`Failed to create user: ${(error as Error).message}`);
  }
}


/**
 * Update an existing user's data in Firestore
 * 
 * @param id - User ID to update
 * @param data - User data to update
 * @returns Promise that resolves when the update is complete
 */
export async function updateUser(id: string, data: UpdateUserData): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, id);
  
  try {
    // Verify user exists
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    let updateData = { ...data, updatedAt: new Date().toISOString() };
    
    // Handle profile image upload if provided
    if (data.profileImage) {
      const storageRef = ref(storage, `profile-images/${id}`);
      const snapshot = await uploadBytes(storageRef, data.profileImage);
      const profileImageUrl = await getDownloadURL(snapshot.ref);
      
      // Remove the File object and add the URL
      delete updateData.profileImage;
      updateData.profileImageUrl = profileImageUrl;
    }
    
    await updateDoc(userRef, updateData);
  } catch (error) {
    console.error('Error updating user:', error);
    throw new Error(`Failed to update user: ${(error as Error).message}`);
  }
}

/**
 * Update a user's password
 * 
 * @param newPassword - New password to set
 * @returns Promise that resolves when the password is updated
 */
export async function updateUserPassword(newPassword: string): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    await updatePassword(user, newPassword);
    
    // Update password last changed timestamp in Firestore
    const userRef = doc(db, USERS_COLLECTION, user.uid);
    await updateDoc(userRef, {
      passwordLastUpdated: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
}

/**
 * Delete a user from Firestore
 * 
 * @param id - User ID to delete
 * @returns Promise that resolves when the deletion is complete
 */
export async function deleteUser(id: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, id);
    
    // Verify user exists
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    // TODO: In a production app, also delete from Firebase Auth
    // and clean up associated data like profile images
    
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new Error(`Failed to delete user: ${(error as Error).message}`);
  }
}

/**
 * Search for users by name or email
 * 
 * @param searchTerm - String to search for in name or email
 * @returns Promise resolving to an array of matching User objects
 */
export async function searchUsers(searchTerm: string): Promise<User[]> {
  try {
    // For a real implementation, use a proper search index
    // This is a simplified implementation
    const users = await getUsers();
    
    return users.filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  } catch (error) {
    console.error('Error searching users:', error);
    throw new Error(`Failed to search users: ${(error as Error).message}`);
  }
}