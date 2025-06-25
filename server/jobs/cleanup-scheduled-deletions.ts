/**
 * Background job to automatically delete accounts that have been scheduled for deletion
 * and have passed their 30-day grace period.
 */

import { storage } from '../storage';

export async function cleanupScheduledDeletions() {
  console.log('Starting cleanup of scheduled account deletions...');
  
  try {
    // Get all users pending deletion whose grace period has expired
    const usersToDelete = await storage.getUsersPendingDeletion();
    
    if (usersToDelete.length === 0) {
      console.log('No accounts scheduled for deletion found.');
      return;
    }
    
    console.log(`Found ${usersToDelete.length} accounts to delete permanently.`);
    
    for (const user of usersToDelete) {
      try {
        console.log(`Deleting expired account: ${user.email} (scheduled: ${user.deletionScheduledAt})`);
        
        // Delete all user data from database
        // 1. First get all user's scripts
        const userScripts = await storage.getUserScripts(user.providerId || user.id.toString());
        
        // 2. For each script, delete its parse jobs first (which will cascade to delete shots)
        for (const script of userScripts) {
          await storage.deleteParseJobsForScript(script.id);
        }
        
        // 3. Then delete the scripts (now safe since parse jobs are gone)
        for (const script of userScripts) {
          await storage.deleteScript(script.id);
        }
        
        // Delete user quota record if exists
        try {
          const { ProductionQuotaManager } = await import('../lib/productionQuotaManager');
          const quotaManager = new ProductionQuotaManager();
          await quotaManager.deleteUserQuota(user.providerId || user.id.toString());
        } catch (error) {
          console.log('No quota record found for user:', user.email);
        }
        
        // Finally delete the user account
        await storage.deleteUser(user.providerId || user.id.toString());
        
        console.log(`Successfully deleted account: ${user.email}`);
        
      } catch (error) {
        console.error(`Failed to delete account ${user.email}:`, error);
        // Continue with other users even if one fails
      }
    }
    
    console.log('Cleanup of scheduled deletions completed.');
    
  } catch (error) {
    console.error('Error during cleanup of scheduled deletions:', error);
  }
}

// Function to start the cleanup job with cron-like scheduling
export function startCleanupJob() {
  // Run cleanup every 24 hours (86400000 ms)
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
  
  console.log('Starting scheduled deletion cleanup job (runs every 24 hours)...');
  
  // Run immediately on startup
  cleanupScheduledDeletions();
  
  // Then run every 24 hours
  setInterval(() => {
    cleanupScheduledDeletions();
  }, CLEANUP_INTERVAL);
}