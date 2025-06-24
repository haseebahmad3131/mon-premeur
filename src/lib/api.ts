/**
 * API utilities for making external requests
 */

/**
 * Fetches the client's IP address from a public API
 * 
 * @returns Promise resolving to the client's IP address
 */
export async function getIpAddress(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch IP: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error fetching IP:', error);
    return 'unknown';
  }
}

/**
 * Validates an IP address format
 * 
 * @param ip - IP address to validate
 * @returns Boolean indicating if the IP is valid
 */
export function isValidIpAddress(ip: string): boolean {
  // IPv4 validation regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 validation regex (simplified)
  const ipv6Regex = /^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}