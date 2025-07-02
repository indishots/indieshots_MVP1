import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // For development, we'll use a simulated admin config
  // In production, use proper service account credentials
  const serviceAccount = {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'indieshots-c6bb1',
    // Note: For production, add proper service account credentials
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    projectId: serviceAccount.projectId,
  });
}

export const auth = admin.auth();
export const firestore = admin.firestore();
export default admin;