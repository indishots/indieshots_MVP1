import { Router, Request, Response } from 'express';
import passport from 'passport';
import { authMiddleware } from '../auth/jwt';
import * as authController from '../controllers/authController';
import * as otpController from '../controllers/otpController';
import * as hybridAuthController from '../controllers/firebaseHybridAuthController';
import { firebaseLogin } from '../controllers/firebaseAuthController';
import { firebaseSync } from '../controllers/firebaseSyncController';

const router = Router();

// Google OAuth routes (disabled for now - using Firebase for Google auth)
// router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
// router.get('/google/callback', 
//   passport.authenticate('google', { failureRedirect: '/auth' }), 
//   (req, res) => res.redirect('/')
// );

// GitHub OAuth routes (disabled for now)
// router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
// router.get('/github/callback', 
//   passport.authenticate('github', { failureRedirect: '/auth' }), 
//   (req, res) => res.redirect('/')
// );

// Firebase-first hybrid authentication routes
router.post('/hybrid-signup', hybridAuthController.hybridSignup);
router.post('/hybrid-signin', hybridAuthController.hybridSignin);  
router.post('/hybrid-verify-otp', hybridAuthController.hybridVerifyOTP);
router.post('/hybrid-resend-otp', hybridAuthController.hybridResendOTP);

// Legacy authentication routes - CSRF protection disabled for development  
router.post('/signup', otpController.registerWithOTP);
router.post('/send-otp', otpController.registerWithOTP); // Alias for signup
router.post('/verify-email', otpController.verifyOTP);
router.post('/resend-otp', otpController.resendOTP);
router.post('/signin', authController.login);
router.post('/magic-link', authController.sendMagicLink);
router.get('/magic-link/verify', authController.verifyMagicLink);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authController.logout);
router.get('/logout', authController.logout);

// Test endpoint to verify server is processing changes  
router.get('/test', (req: Request, res: Response) => {
  console.log('🧪 Test endpoint called - server is processing changes');
  return res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

// Test Firebase connectivity
router.get('/test-firebase', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Testing Firebase Admin connectivity...');
    const { auth: firebaseAdmin } = require('../firebase/admin');
    
    // Try to check if a dummy user exists (should return user-not-found)
    try {
      await firebaseAdmin.getUserByEmail('test-nonexistent@example.com');
      return res.json({ firebase: 'working', message: 'Firebase Admin SDK is working' });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return res.json({ firebase: 'working', message: 'Firebase Admin SDK is working' });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Firebase test error:', error);
    return res.status(500).json({ firebase: 'error', message: error.message });
  }
});

// REMOVED: Duplicate endpoint - using the correct one below

// Firebase authentication - no CSRF needed (uses Firebase idToken)
router.post('/firebase-login', firebaseLogin);
router.post('/firebase-sync', firebaseSync);

// Get currently authenticated user (Firebase-only) with fresh tier data
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const tokenUser = (req as any).user;
    if (!tokenUser) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Import quota manager to get current tier from database
    const { ProductionQuotaManager } = await import('../lib/productionQuotaManager');
    const quotaManager = new ProductionQuotaManager();
    
    // Get fresh tier information from PostgreSQL using Firebase UID
    const userQuota = await quotaManager.getUserQuota(tokenUser.id, tokenUser.tier);
    
    // Return user data with fresh tier information from PostgreSQL database
    const userData = {
      id: tokenUser.id,
      email: tokenUser.email,
      displayName: tokenUser.displayName,
      photoURL: tokenUser.photoURL,
      tier: userQuota.tier,
      usedPages: userQuota.usedPages,
      totalPages: userQuota.totalPages,
      maxShotsPerScene: userQuota.maxShotsPerScene,
      canGenerateStoryboards: userQuota.canGenerateStoryboards
    };
    
    res.json(userData);
  } catch (error) {
    console.error('Error fetching Firebase user:', error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// Refresh user tier from database
router.get('/refresh-tier', authMiddleware, async (req, res) => {
  try {
    const tokenUser = (req as any).user;
    if (!tokenUser) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    console.log('Refreshing tier for user:', tokenUser.email);
    
    // Import quota manager to get current tier from database
    const { ProductionQuotaManager } = await import('../lib/productionQuotaManager');
    const quotaManager = new ProductionQuotaManager();
    
    // Get fresh tier information from PostgreSQL
    const userQuota = await quotaManager.getUserQuota(tokenUser.id);
    
    console.log('Fresh tier data from database:', userQuota);
    
    res.json({
      tier: userQuota.tier,
      usedPages: userQuota.usedPages,
      totalPages: userQuota.totalPages,
      maxShotsPerScene: userQuota.maxShotsPerScene,
      canGenerateStoryboards: userQuota.canGenerateStoryboards
    });
  } catch (error) {
    console.error('Error refreshing tier:', error);
    res.status(500).json({ message: 'Failed to refresh tier' });
  }
});

// Update user preferences
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({ message: 'Preferences data required' });
    }

    const { storage } = await import('../storage');
    const updatedUser = await storage.updateUserPreferences(user.id, preferences);
    
    // Return updated user data (excluding sensitive fields)
    const { password, ...userData } = updatedUser;
    res.json({
      ...userData,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { firstName, lastName, email } = req.body;
    
    const updates: any = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No update data provided' });
    }

    const { storage } = await import('../storage');
    const updatedUser = await storage.updateUser(user.id, updates);
    
    // Return updated user data (excluding sensitive fields)
    const { password, ...userData } = updatedUser;
    res.json({
      ...userData,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Update user profile - requires authentication (CSRF disabled for development)
router.put('/user', authMiddleware, authController.updateProfile);

// Change password - requires authentication (CSRF disabled for development)
router.post('/change-password', authMiddleware, authController.changePassword);

// Verify email
router.get('/verify-email', authController.verifyEmail);

// Schedule account for deletion (30 days) - requires authentication
router.post('/schedule-delete-account', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    console.log('Scheduling account deletion for user:', user.email);

    const { storage } = await import('../storage');
    
    // Schedule user for deletion in 30 days
    await storage.scheduleUserDeletion(user.id);
    
    console.log('Account scheduled for deletion for user:', user.email);
    
    res.json({ 
      message: 'Account scheduled for deletion in 30 days. You can restore it by logging in again.',
      success: true 
    });
  } catch (error) {
    console.error('Error scheduling account deletion:', error);
    res.status(500).json({ 
      message: 'Failed to schedule account deletion. Please contact support if this problem persists.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Permanently delete account immediately - requires authentication
router.delete('/delete-account-permanent', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    console.log('Permanently deleting account for user:', user.email);

    // Delete all user data from database
    const { storage } = await import('../storage');
    
    // Delete in proper order to respect foreign key constraints
    // 1. First get all user's scripts
    const userScripts = await storage.getUserScripts(user.id);
    
    // 2. For each script, delete its parse jobs first (which will cascade to delete shots)
    for (const script of userScripts) {
      await storage.deleteParseJobsForScript(script.id);
    }
    
    // 3. Then delete the scripts (now safe since parse jobs are gone)
    for (const script of userScripts) {
      await storage.deleteScript(script.id);
    }
    
    // Delete user quota record
    const { ProductionQuotaManager } = await import('../lib/productionQuotaManager');
    const quotaManager = new ProductionQuotaManager();
    await quotaManager.deleteUserQuota(user.id);
    
    // Delete promo code usage records for this user
    try {
      const { PromoCodeService } = await import('../services/promoCodeService');
      await PromoCodeService.deleteUserPromoCodeUsage(user.email);
      console.log('Deleted promo code usage records for user:', user.email);
    } catch (error) {
      console.log('No promo code usage records found for user:', user.email);
    }
    
    // Delete any script health analysis records
    try {
      await storage.deleteScriptHealthAnalysisForUser(user.id);
      console.log('Deleted script health analysis records for user:', user.email);
    } catch (error) {
      console.log('No script health analysis records found for user:', user.email);
    }
    
    // Delete any session records for this user
    try {
      await storage.deleteUserSessions(user.id);
      console.log('Deleted session records for user:', user.email);
    } catch (error) {
      console.log('No session records found for user:', user.email);
    }
    
    // Blacklist the user from signing back in
    const { tokenBlacklist } = await import('../auth/tokenBlacklist');
    
    // Add user ID to permanent blacklist to prevent any future sign-ins
    tokenBlacklist.addPermanentUserBan(user.id, user.email);
    console.log('User permanently banned from signing in:', user.email);
    
    // Note: Firebase Admin deletion requires service account credentials
    // For now, we prevent re-authentication through our blacklist system
    
    // Finally delete the user account from database
    await storage.deleteUser(user.id);
    
    console.log('Account permanently deleted for user:', user.email);
    
    // Clear the authentication cookie and invalidate session
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    res.json({ 
      message: 'Account permanently deleted successfully',
      success: true 
    });
  } catch (error) {
    console.error('Error permanently deleting account:', error);
    res.status(500).json({ 
      message: 'Failed to delete account. Please contact support if this problem persists.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cleanup orphaned Firebase user that exists in Firebase but not in PostgreSQL
router.post('/cleanup-orphaned-user', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    console.log('Cleaning up orphaned Firebase user:', email);

    // Check if user exists in PostgreSQL
    const { storage } = await import('../storage');
    const existingUser = await storage.getUserByEmail(email);
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User exists in database. Use normal deletion process.' 
      });
    }

    // Try to delete from Firebase using admin SDK
    try {
      const admin = await import('firebase-admin');
      
      // Get user by email from Firebase
      const userRecord = await admin.auth().getUserByEmail(email);
      
      if (userRecord) {
        // Delete from Firebase
        await admin.auth().deleteUser(userRecord.uid);
        console.log('Successfully deleted Firebase user:', email);
        
        res.json({ 
          message: 'Firebase user cleaned up successfully. You can now register with this email.',
          success: true 
        });
      } else {
        res.status(404).json({ 
          message: 'User not found in Firebase either. Email should be available for registration.',
          success: true
        });
      }
      
    } catch (firebaseError: any) {
      if (firebaseError.code === 'auth/user-not-found') {
        res.json({ 
          message: 'User not found in Firebase. Email should be available for registration.',
          success: true
        });
      } else {
        console.error('Firebase cleanup error:', firebaseError);
        res.status(500).json({ 
          message: 'Could not clean up Firebase user. Please contact support.',
          error: firebaseError.message 
        });
      }
    }
    
  } catch (error) {
    console.error('Error cleaning up orphaned user:', error);
    res.status(500).json({ 
      message: 'Failed to cleanup user. Please contact support.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cancel scheduled deletion - requires authentication
router.post('/cancel-delete-account', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    console.log('Cancelling scheduled deletion for user:', user.email);

    const { storage } = await import('../storage');
    
    // Cancel scheduled deletion
    await storage.cancelUserDeletion(user.id);
    
    console.log('Scheduled deletion cancelled for user:', user.email);
    
    res.json({ 
      message: 'Account deletion cancelled successfully',
      success: true 
    });
  } catch (error) {
    console.error('Error cancelling account deletion:', error);
    res.status(500).json({ 
      message: 'Failed to cancel account deletion. Please contact support if this problem persists.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export user data - requires authentication
router.get('/export-data', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    console.log('Exporting data for user:', user.email);

    const { storage } = await import('../storage');

    // Helper function to convert data to CSV format
    const convertToCSV = (data: any[]) => {
      if (data.length === 0) return '';
      
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];
      
      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return '"' + value.replace(/"/g, '""') + '"';
          }
          return value || '';
        });
        csvRows.push(values.join(','));
      }
      
      return csvRows.join('\n');
    };

    // Get all user's data
    const userScripts = await storage.getUserScripts(user.id);
    const userParseJobs = await storage.getUserParseJobs(user.id);
    
    // Get all shots
    const allShots = [];
    for (const job of userParseJobs) {
      const jobShots = await storage.getShotsByParseJobId(job.id);
      allShots.push(...jobShots);
    }

    // Create user profile CSV
    const userProfileData = [{
      id: user.id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      tier: user.tier,
      createdAt: user.createdAt,
      preferences: JSON.stringify(user.preferences || {})
    }];

    // Create scripts metadata CSV
    const scriptsData = userScripts.map(script => ({
      id: script.id,
      title: script.title,
      fileType: script.fileType || 'unknown',
      fileSize: script.fileSize || 0,
      pageCount: script.pageCount || 0,
      createdAt: script.createdAt,
      updatedAt: script.updatedAt
    }));

    // Create parse jobs CSV
    const parseJobsData = userParseJobs.map(job => ({
      id: job.id,
      scriptId: job.scriptId,
      status: job.status,
      selectedColumns: Array.isArray(job.selectedColumns) ? job.selectedColumns.join(';') : '',
      errorMessage: job.errorMessage || '',
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt || ''
    }));

    // Create shots CSV
    const shotsData = allShots.map(shot => ({
      id: shot.id,
      parseJobId: shot.parseJobId,
      sceneIndex: shot.sceneIndex,
      shotNumberInScene: shot.shotNumberInScene,
      displayShotNumber: shot.displayShotNumber || '',
      shotDescription: shot.shotDescription || '',
      shotType: shot.shotType || '',
      lens: shot.lens || '',
      movement: shot.movement || '',
      sceneHeading: shot.sceneHeading || '',
      location: shot.location || '',
      timeOfDay: shot.timeOfDay || '',
      characters: shot.characters || '',
      action: shot.action || '',
      dialogue: shot.dialogue || '',
      props: shot.props || '',
      tone: shot.tone || '',
      moodAndAmbience: shot.moodAndAmbience || '',
      lighting: shot.lighting || '',
      notes: shot.notes || '',
      soundDesign: shot.soundDesign || '',
      colourTemp: shot.colourTemp || '',
      imagePromptText: shot.imagePromptText || '',
      hasImage: !!shot.imageData,
      createdAt: shot.createdAt,
      updatedAt: shot.updatedAt
    }));

    // Create README content
    const readmeContent = `IndieShots Data Export
=====================

This export contains all your data from IndieShots:

1. user-profile.csv - Your account information and preferences
2. scripts-metadata.csv - Information about your uploaded scripts (${scriptsData.length} scripts)
3. parse-jobs.csv - History of your script parsing jobs (${parseJobsData.length} jobs)
4. shots.csv - All generated shots from your scripts (${shotsData.length} shots)
5. scripts-content.csv - Full text content of your scripts

Export Date: ${new Date().toISOString()}
User: ${user.email}
Export Version: 2.0

For questions about this export, contact: indieshots@theindierise.com
`;

    // Create scripts content CSV (includes full text content)
    const scriptsContentData = userScripts.map(script => ({
      id: script.id,
      title: script.title,
      content: script.content || '',
      fileType: script.fileType || 'unknown',
      createdAt: script.createdAt
    }));

    // Prepare all data as a single JSON response with embedded CSV data
    const exportData = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        version: '2.0',
        userEmail: user.email,
        totalScripts: scriptsData.length,
        totalParseJobs: parseJobsData.length,
        totalShots: shotsData.length
      },
      csvFiles: {
        'user-profile.csv': convertToCSV(userProfileData),
        'scripts-metadata.csv': convertToCSV(scriptsData),
        'scripts-content.csv': convertToCSV(scriptsContentData),
        'parse-jobs.csv': convertToCSV(parseJobsData),
        'shots.csv': convertToCSV(shotsData),
        'README.txt': readmeContent
      }
    };

    console.log(`Data export completed for user ${user.email}: ${scriptsData.length} scripts, ${parseJobsData.length} parse jobs, ${shotsData.length} shots`);

    // Set response headers for JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="indieshots-data-export-${user.id}-${new Date().toISOString().split('T')[0]}.json"`);
    
    // Send the data as JSON
    res.json(exportData);

  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ 
      message: 'Failed to export data. Please contact support if this problem persists.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;