import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/jwt';
import { storage } from '../storage';

const router = Router();

// Basic healthcheck endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Login page redirect - send HTML redirect to auth page
router.get('/login', (req: Request, res: Response) => {
  res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="0; url=/auth">
        <script>window.location.href = '/auth';</script>
      </head>
      <body>
        <p>Redirecting to login page...</p>
      </body>
    </html>
  `);
});

// Logout page redirect - clear session and redirect to home
router.get('/logout', (req: Request, res: Response) => {
  // Clear auth cookie
  res.clearCookie('auth_token');
  
  res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="2; url=/">
        <script>
          // Clear any client-side auth data
          localStorage.clear();
          sessionStorage.clear();
          
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        </script>
      </head>
      <body>
        <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
          <h2>Logging out...</h2>
          <p>You have been successfully logged out.</p>
          <p>Redirecting to home page...</p>
        </div>
      </body>
    </html>
  `);
});

// This endpoint has been moved to /api/auth/user with proper authentication

export default router;