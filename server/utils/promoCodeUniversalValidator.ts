/**
 * Universal INDIE2025 Promo Code Validator
 * Ensures consistent pro tier assignment for all INDIE2025 users
 */

import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface PromoValidationResult {
  isValid: boolean;
  shouldBePro: boolean;
  currentTier: string;
  needsUpdate: boolean;
  message: string;
}

export class PromoCodeUniversalValidator {
  
  /**
   * Validate if user should have pro tier based on INDIE2025 usage
   */
  static async validateUserPromoTier(email: string): Promise<PromoValidationResult> {
    try {
      console.log(`🔍 VALIDATING PROMO TIER: ${email}`);
      
      // Check if user exists
      const user = await db.select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (user.length === 0) {
        return {
          isValid: false,
          shouldBePro: false,
          currentTier: 'none',
          needsUpdate: false,
          message: 'User not found'
        };
      }

      const userData = user[0];
      
      // Check if user used INDIE2025 promo code
      const promoUsage = await db.execute(`
        SELECT pcu.granted_tier, pc.code 
        FROM promo_code_usage pcu 
        JOIN promo_codes pc ON pcu.promo_code_id = pc.id 
        WHERE pcu.user_email = $1 AND pc.code = 'INDIE2025'
      `, [email.toLowerCase()]);

      const hasINDIE2025 = promoUsage.rows.length > 0;
      const shouldBePro = hasINDIE2025;
      const currentTier = userData.tier;
      const needsUpdate = shouldBePro && currentTier !== 'pro';

      console.log(`📊 PROMO VALIDATION RESULT for ${email}:`);
      console.log(`   - Has INDIE2025: ${hasINDIE2025}`);
      console.log(`   - Should be Pro: ${shouldBePro}`);
      console.log(`   - Current Tier: ${currentTier}`);
      console.log(`   - Needs Update: ${needsUpdate}`);

      return {
        isValid: true,
        shouldBePro,
        currentTier,
        needsUpdate,
        message: needsUpdate 
          ? `User ${email} has INDIE2025 but is ${currentTier} tier - needs pro upgrade`
          : `User ${email} tier is correct: ${currentTier}`
      };
      
    } catch (error) {
      console.error('Promo validation error:', error);
      return {
        isValid: false,
        shouldBePro: false,
        currentTier: 'error',
        needsUpdate: false,
        message: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Fix user tier if they have INDIE2025 but wrong tier
   */
  static async fixUserPromoTier(email: string): Promise<boolean> {
    try {
      const validation = await this.validateUserPromoTier(email);
      
      if (!validation.needsUpdate) {
        console.log(`✓ ${email} tier is already correct`);
        return true;
      }

      // Update user to pro tier
      await db.update(users)
        .set({
          tier: 'pro',
          totalPages: -1,
          maxShotsPerScene: -1,
          canGenerateStoryboards: true,
          updatedAt: new Date()
        })
        .where(eq(users.email, email.toLowerCase()));

      console.log(`🔧 FIXED: Updated ${email} from ${validation.currentTier} to pro tier`);
      return true;
      
    } catch (error) {
      console.error(`Failed to fix promo tier for ${email}:`, error);
      return false;
    }
  }

  /**
   * Ensure INDIE2025 works universally for any user
   */
  static async ensureINDIE2025Universal(email: string, couponCode: string): Promise<boolean> {
    if (couponCode.toUpperCase() !== 'INDIE2025') {
      return false;
    }

    console.log(`🎯 ENSURING UNIVERSAL INDIE2025: ${email}`);
    
    try {
      // First validate current state
      const validation = await this.validateUserPromoTier(email);
      
      // If user needs pro tier, apply it
      if (validation.needsUpdate || !validation.shouldBePro) {
        await this.fixUserPromoTier(email);
        console.log(`✅ INDIE2025 UNIVERSAL: Pro tier ensured for ${email}`);
        return true;
      }
      
      console.log(`✓ INDIE2025 UNIVERSAL: ${email} already has correct pro tier`);
      return true;
      
    } catch (error) {
      console.error(`INDIE2025 universal error for ${email}:`, error);
      return false;
    }
  }
}