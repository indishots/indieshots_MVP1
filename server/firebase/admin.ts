// For now, we'll create a mock Firebase Admin implementation
// until proper service account credentials are provided
// This allows the hybrid system to work without breaking current functionality

interface MockFirebaseUser {
  uid: string;
  email: string;
  displayName?: string;
  emailVerified: boolean;
  customClaims?: Record<string, any>;
}

class MockFirebaseAuth {
  private users = new Map<string, MockFirebaseUser>();
  private uidCounter = 1000;

  async getUserByEmail(email: string): Promise<MockFirebaseUser> {
    const user = Array.from(this.users.values()).find(u => u.email === email);
    if (!user) {
      const error = new Error('User not found');
      (error as any).code = 'auth/user-not-found';
      throw error;
    }
    return user;
  }

  async createUser(userData: {
    email: string;
    password: string;
    emailVerified?: boolean;
    displayName?: string;
  }): Promise<MockFirebaseUser> {
    const uid = `mock-uid-${this.uidCounter++}`;
    const user: MockFirebaseUser = {
      uid,
      email: userData.email,
      displayName: userData.displayName,
      emailVerified: userData.emailVerified || false,
    };
    
    this.users.set(uid, user);
    console.log(`🔥 Mock Firebase: Created user ${userData.email} with UID ${uid}`);
    return user;
  }

  async setCustomUserClaims(uid: string, claims: Record<string, any>): Promise<void> {
    const user = this.users.get(uid);
    if (user) {
      user.customClaims = claims;
      console.log(`🔥 Mock Firebase: Set custom claims for ${uid}:`, claims);
    }
  }

  async createCustomToken(uid: string): Promise<string> {
    // Return a mock token that includes the UID
    return `mock-custom-token-${uid}-${Date.now()}`;
  }
}

// Export mock Firebase admin
export const auth = new MockFirebaseAuth();
export const firestore = null; // Not needed for this implementation

export default {
  auth: () => auth,
  firestore: () => firestore,
};