import { Router, Request, Response } from 'express';
import { storage } from '../storage';

const router = Router();

/**
 * GET /payment/success
 * Payment success page
 */
router.get('/success', async (req: Request, res: Response) => {
  const { session_id } = req.query;
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Successful - IndieShots</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
      <div class="min-h-screen flex items-center justify-center">
        <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div class="mb-6">
            <div class="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p class="text-gray-600">Thank you for upgrading to IndieShots Pro</p>
          </div>
          
          <div class="space-y-3 text-left bg-gray-50 rounded-lg p-4 mb-6">
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Plan:</span>
              <span class="text-sm font-medium">IndieShots Pro</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Status:</span>
              <span class="text-sm font-medium text-green-600">Active</span>
            </div>
            ${session_id ? `
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Session ID:</span>
              <span class="text-sm font-mono text-xs">${session_id}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="space-y-3">
            <a href="/dashboard" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-block">
              Go to Dashboard
            </a>
            <p class="text-xs text-gray-500">
              You will receive a confirmation email shortly
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  res.send(html);
});

/**
 * GET /payment/cancel
 * Payment cancelled page
 */
router.get('/cancel', (req: Request, res: Response) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Cancelled - IndieShots</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
      <div class="min-h-screen flex items-center justify-center">
        <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div class="mb-6">
            <div class="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
            <p class="text-gray-600">Your payment was cancelled. No charges were made to your account.</p>
          </div>
          
          <div class="space-y-3">
            <a href="/upgrade" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-block">
              Try Again
            </a>
            <a href="/dashboard" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors inline-block">
              Back to Dashboard
            </a>
          </div>
          
          <p class="text-xs text-gray-500 mt-4">
            Need help? Contact us at <a href="mailto:support@indieshots.com" class="text-blue-600 hover:underline">support@indieshots.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  res.send(html);
});

export default router;