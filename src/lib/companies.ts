/**
 * Company management service
 * Handles all company-related operations with Firestore
 */

import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { isValidIpAddress } from './api';
import type { Company, Group, UpdateCompanyData } from '../types';

// Constants
const COMPANIES_COLLECTION = 'companies';
const GROUPS_COLLECTION = 'groups';
const MAX_ALLOWED_IPS = 3;

/**
 * Fetch all companies from Firestore
 * 
 * @returns Promise resolving to an array of Company objects
 */
export async function getCompanies(): Promise<Company[]> {
  try {
    const querySnapshot = await getDocs(collection(db, COMPANIES_COLLECTION));
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<Company, 'id'>
    }));
  } catch (error) {
    console.error('Error fetching companies:', error);
    throw new Error(`Failed to fetch companies: ${(error as Error).message}`);
  }
}

/**
 * Get a company by ID
 * 
 * @param companyId - The ID of the company to retrieve
 * @returns Promise resolving to a Company object or null if not found
 */
export async function getCompanyById(companyId: string): Promise<Company | null> {
  try {
    const companyDoc = await getDoc(doc(db, COMPANIES_COLLECTION, companyId));
    
    if (!companyDoc.exists()) {
      return null;
    }
    
    return {
      id: companyDoc.id,
      ...companyDoc.data() as Omit<Company, 'id'>
    };
  } catch (error) {
    console.error(`Error fetching company ${companyId}:`, error);
    throw new Error(`Failed to fetch company: ${(error as Error).message}`);
  }
}

/**
 * Get a company by name (case insensitive)
 * 
 * @param companyName - Name of the company to retrieve
 * @returns Promise resolving to a Company object or null if not found
 */
export async function getCompanyByName(companyName: string): Promise<Company | null> {
  try {
    // For a production app, use Firestore's advanced querying capabilities
    // For now, fetch all and filter (not ideal for large datasets)
    const companies = await getCompanies();
    const company = companies.find(
      c => c.name.toLowerCase() === companyName.toLowerCase()
    );
    
    return company || null;
  } catch (error) {
    console.error(`Error fetching company by name ${companyName}:`, error);
    throw new Error(`Failed to fetch company by name: ${(error as Error).message}`);
  }
}

/**
 * Get companies by group
 * 
 * @param groupName - Name of the group to filter by
 * @returns Promise resolving to an array of Company objects
 */
export async function getCompaniesByGroup(groupName: string): Promise<Company[]> {
  try {
    const companies = await getCompanies();
    return companies.filter(c => c.group === groupName);
  } catch (error) {
    console.error(`Error fetching companies by group ${groupName}:`, error);
    throw new Error(`Failed to fetch companies by group: ${(error as Error).message}`);
  }
}

/**
 * Create a new company in Firestore
 * 
 * @param companyData - Company data to create
 * @param logo - Optional company logo file
 * @returns Promise resolving to the ID of the created company
 */
export async function createCompany(
  companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'logoUrl'>, 
  logo?: File
): Promise<string> {
  try {
    // Validate company name
    if (!companyData.name?.trim()) {
      throw new Error('Company name is required');
    }
    
    // Validate IP addresses if provided
    if (companyData.allowedIps) {
      if (companyData.allowedIps.length > MAX_ALLOWED_IPS) {
        throw new Error(`Maximum of ${MAX_ALLOWED_IPS} IP addresses allowed`);
      }
      
      for (const ip of companyData.allowedIps) {
        if (!isValidIpAddress(ip)) {
          throw new Error(`Invalid IP address format: ${ip}`);
        }
      }
    }
    
    // Check for duplicate company name
    const existingCompany = await getCompanyByName(companyData.name);
    if (existingCompany) {
      throw new Error(`A company with the name '${companyData.name}' already exists`);
    }
    
    const now = new Date().toISOString();
    const company = {
      ...companyData,
      allowedIps: companyData.allowedIps || [],
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await addDoc(collection(db, COMPANIES_COLLECTION), company);
    
    // Upload company logo if provided
    if (logo) {
      const logoUrl = await uploadCompanyLogo(docRef.id, logo);
      await updateDoc(docRef, { logoUrl });
    }
    
    // If group is provided, update or create group entry with logo
    if (companyData.group) {
      await updateGroupData(companyData.group);
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating company:', error);
    throw new Error(`Failed to create company: ${(error as Error).message}`);
  }
}

/**
 * Update an existing company in Firestore
 * 
 * @param id - Company ID to update
 * @param data - Company data to update
 * @returns Promise that resolves when the update is complete
 */
export async function updateCompany(id: string, data: UpdateCompanyData): Promise<void> {
  try {
    const companyRef = doc(db, COMPANIES_COLLECTION, id);
    
    // Verify company exists
    const companyDoc = await getDoc(companyRef);
    if (!companyDoc.exists()) {
      throw new Error(`Company with ID ${id} not found`);
    }
    
    // Validate IP addresses if provided
    if (data.allowedIps) {
      if (data.allowedIps.length > MAX_ALLOWED_IPS) {
        throw new Error(`Maximum of ${MAX_ALLOWED_IPS} IP addresses allowed`);
      }
      
      for (const ip of data.allowedIps) {
        if (!isValidIpAddress(ip)) {
          throw new Error(`Invalid IP address format: ${ip}`);
        }
      }
    }
    
    // If name is being changed, check for duplicates
    if (data.name && data.name !== companyDoc.data().name) {
      const existingCompany = await getCompanyByName(data.name);
      if (existingCompany && existingCompany.id !== id) {
        throw new Error(`A company with the name '${data.name}' already exists`);
      }
    }
    
    // Create a copy of data without logo file
    const updateData = { ...data };
    delete (updateData as any).logo;
    
    // Upload logo if provided
    if (data.logo) {
      const logoUrl = await uploadCompanyLogo(id, data.logo);
      updateData.logoUrl = logoUrl;
    }
    
    await updateDoc(companyRef, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    
    // If group is changed or added, update or create group entry
    if (data.group) {
      await updateGroupData(data.group);
    }
  } catch (error) {
    console.error('Error updating company:', error);
    throw new Error(`Failed to update company: ${(error as Error).message}`);
  }
}

/**
 * Upload company logo to storage
 * 
 * @param companyId - ID of the company
 * @param logoFile - Logo file to upload
 * @returns URL of the uploaded logo
 */
async function uploadCompanyLogo(companyId: string, logoFile: File): Promise<string> {
  try {
    // Create a reference to company logo in storage
    const logoRef = ref(storage, `company-logos/${companyId}`);
    
    // Upload the file
    const snapshot = await uploadBytes(logoRef, logoFile);
    
    // Get the download URL
    const logoUrl = await getDownloadURL(snapshot.ref);
    
    return logoUrl;
  } catch (error) {
    console.error('Error uploading company logo:', error);
    throw new Error(`Failed to upload company logo: ${(error as Error).message}`);
  }
}

/**
 * Upload group logo to storage
 * 
 * @param groupName - Name of the group
 * @param logoFile - Logo file to upload
 * @returns URL of the uploaded logo
 */
export async function uploadGroupLogo(groupName: string, logoFile: File): Promise<string> {
  try {
    // Create a sanitized filename from group name
    const sanitizedName = groupName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // Create a reference to group logo in storage
    const logoRef = ref(storage, `group-logos/${sanitizedName}`);
    
    // Upload the file
    const snapshot = await uploadBytes(logoRef, logoFile);
    
    // Get the download URL
    const logoUrl = await getDownloadURL(snapshot.ref);
    
    return logoUrl;
  } catch (error) {
    console.error('Error uploading group logo:', error);
    throw new Error(`Failed to upload group logo: ${(error as Error).message}`);
  }
}

/**
 * Update or create a group entry in Firestore
 * 
 * @param groupName - Name of the group
 */
export async function updateGroupData(groupName: string): Promise<void> {
  try {
    // Get a reference to the groups collection
    const groupsCollection = collection(db, GROUPS_COLLECTION);
    
    // Check if group already exists
    const q = query(groupsCollection, where("name", "==", groupName));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Group doesn't exist, create a new one
      await addDoc(groupsCollection, {
        name: groupName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      // Group exists, just update the timestamp
      const groupDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, GROUPS_COLLECTION, groupDoc.id), {
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error updating group data:', error);
    throw new Error(`Failed to update group data: ${(error as Error).message}`);
  }
}

/**
 * Get all groups from Firestore
 * 
 * @returns Promise resolving to an array of Group objects
 */
export async function getGroups(): Promise<Group[]> {
  try {
    const querySnapshot = await getDocs(collection(db, GROUPS_COLLECTION));
    
    return querySnapshot.docs.map(doc => ({
      ...doc.data() as Group
    }));
  } catch (error) {
    console.error('Error fetching groups:', error);
    throw new Error(`Failed to fetch groups: ${(error as Error).message}`);
  }
}

/**
 * Update group logo in Firestore
 * 
 * @param groupName - Name of the group
 * @param logoFile - Logo file to upload
 * @returns Promise that resolves when the update is complete
 */
export async function updateGroupLogo(groupName: string, logoFile: File): Promise<void> {
  try {
    // Upload the group logo
    const logoUrl = await uploadGroupLogo(groupName, logoFile);
    
    // Update the group record in Firestore
    const groupsCollection = collection(db, GROUPS_COLLECTION);
    const q = query(groupsCollection, where("name", "==", groupName));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Group doesn't exist, create a new one with logo
      await addDoc(groupsCollection, {
        name: groupName,
        logoUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      // Group exists, update logo
      const groupDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, GROUPS_COLLECTION, groupDoc.id), {
        logoUrl,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error updating group logo:', error);
    throw new Error(`Failed to update group logo: ${(error as Error).message}`);
  }
}

/**
 * Get a group by name
 * 
 * @param groupName - Name of the group to retrieve
 * @returns Promise resolving to a Group object or null if not found
 */
export async function getGroupByName(groupName: string): Promise<Group | null> {
  try {
    const groupsCollection = collection(db, GROUPS_COLLECTION);
    const q = query(groupsCollection, where("name", "==", groupName));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    return querySnapshot.docs[0].data() as Group;
  } catch (error) {
    console.error(`Error fetching group ${groupName}:`, error);
    throw new Error(`Failed to fetch group: ${(error as Error).message}`);
  }
}

/**
 * Delete a company from Firestore
 * 
 * @param id - Company ID to delete
 * @returns Promise that resolves when the deletion is complete
 */
export async function deleteCompany(id: string): Promise<void> {
  try {
    const companyRef = doc(db, COMPANIES_COLLECTION, id);
    
    // Verify company exists
    const companyDoc = await getDoc(companyRef);
    if (!companyDoc.exists()) {
      throw new Error(`Company with ID ${id} not found`);
    }
    
    // TODO: In a production app, first check if any users are associated with this company
    // and prevent deletion or handle the relationship appropriately
    
    await deleteDoc(companyRef);
  } catch (error) {
    console.error('Error deleting company:', error);
    throw new Error(`Failed to delete company: ${(error as Error).message}`);
  }
}