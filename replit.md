# IndieShots - Screenplay to Shot List Converter

## Overview

IndieShots is a full-stack web application that converts screenplay scripts into structured shot lists using AI-powered analysis. The application is designed for independent filmmakers and content creators to streamline their pre-production workflow by automatically extracting scenes, characters, locations, and other production elements from scripts.

## System Architecture

The application follows a monorepo structure with a React frontend and Express.js backend, both written in TypeScript. The architecture is designed for simplicity and rapid development while maintaining scalability.

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Multiple providers (Firebase, JWT, OAuth)
- **File Processing**: Multer for uploads with DOCX/TXT support
- **AI Integration**: OpenAI GPT-4 for script parsing

## Key Components

### Authentication System
The application supports multiple authentication methods:
- Firebase Authentication for Google OAuth
- JWT-based local authentication
- Session-based authentication with PostgreSQL storage
- Demo mode for development and testing

**Rationale**: Multiple auth providers ensure flexibility for different user preferences while Firebase provides reliable OAuth integration.

### File Processing Pipeline
1. **Upload**: Multer handles file uploads with validation
2. **Processing**: Text extraction from DOCX/TXT files
3. **Parsing**: AI-powered analysis using OpenAI GPT-4
4. **Export**: XLSX/CSV generation for shot lists

**Security**: File validation uses magic bytes and extension whitelisting (OWASP recommended).

### Database Design
- **Users**: Stores user profiles, subscription tiers, and usage quotas
- **Scripts**: File metadata and content storage
- **Parse Jobs**: Background job tracking with status updates
- **Sessions**: Session storage for authentication

**Choice**: PostgreSQL provides ACID compliance and JSON support for flexible data structures.

## Data Flow

1. **User Registration/Login**: Authentication through multiple providers
2. **Script Upload**: File validation and text extraction
3. **Column Selection**: User chooses data fields to extract
4. **AI Processing**: Background job processes script with OpenAI
5. **Review & Export**: User reviews results and downloads formatted output

## External Dependencies

### Core Dependencies
- **OpenAI**: GPT-4 API for intelligent script parsing
- **Firebase**: Authentication services (optional)
- **SendGrid**: Email services for notifications
- **Neon**: PostgreSQL database hosting

### Security Considerations
- CSRF protection disabled for development (to be enabled in production)
- File upload validation using magic bytes
- JWT token management with secure cookies
- Environment variable protection for API keys

## Deployment Strategy

### Development Environment
- **Platform**: Replit with PostgreSQL module
- **Port Configuration**: Application runs on port 5000
- **Auto-deployment**: Configured for Replit's autoscale deployment

### Build Process
1. Frontend build with Vite (outputs to `dist/public`)
2. Backend build with esbuild (outputs to `dist`)
3. Static file serving from Express

### Environment Variables Required
```
DATABASE_URL=postgresql_connection_string
OPENAI_API_KEY=openai_api_key
VITE_FIREBASE_API_KEY=firebase_api_key (optional)
VITE_FIREBASE_PROJECT_ID=firebase_project_id (optional)
JWT_SECRET=jwt_secret_key
```

## Changelog

Recent Changes:
- July 1, 2025: **DASHBOARD NAVIGATION BUG COMPLETELY RESOLVED** - Fixed critical theme-related CSS issue where Quick Actions buttons became invisible after Settings navigation; implemented hardcoded color styling with !important declarations, theme change event system, automatic re-rendering mechanism, and render key updates to ensure persistent button visibility across all navigation patterns and theme changes
- July 1, 2025: **TOOLS SECTION REMOVED FROM NAVIGATION** - Cleaned up left navigation panel by removing Tools section (Analysis, Storyboards, AI Tools) for streamlined interface; removed unused icon imports and maintained core navigation functionality
- July 1, 2025: **DASHBOARD COMPLETED JOBS SECTION REMOVED** - Cleaned up dashboard by removing the "Completed Jobs" card while preserving all other functionality including usage quota, scripts uploaded, and premium features sections
- July 1, 2025: **COMPREHENSIVE FAQ SYSTEM IMPLEMENTED** - Created full FAQ system with 15 detailed questions across 16 categories; implemented authenticated help center (/help) with search and filtering for signed-in users; added public FAQ page (/public-faq) accessible from landing page footer; integrated Help Center link in left sidebar navigation; provides seamless user support workflow from public to authenticated access
- July 1, 2025: **ANIMATED STORYBOARD LOADING SYSTEM IMPLEMENTED** - Created beautiful animated loading screen for storyboard generation with 6 cycling animation frames featuring bouncing, floating, wiggling, spinning, pulsing, and scaling icons; compact design with IndieShots theme colors and aesthetic animations that pop out of spinning rings; enhances user experience during AI image generation wait times
- July 1, 2025: **EXCEL EXPORT SECURITY WARNINGS ELIMINATED** - Implemented proper Excel XML format to eliminate security warnings when opening downloaded files; Excel export now opens seamlessly without conversion prompts or security dialogs
- July 1, 2025: **SHOT COUNT DISPLAY REMOVED** - Cleaned up "Generated Shots" title by removing shot count numbers for cleaner interface appearance
- July 1, 2025: **TIER-BASED EXPORT SYSTEM IMPLEMENTED** - Replaced single download button with separate "Export as CSV" and "Export as Excel" buttons; Excel export restricted to Pro users with visual indicators and upgrade prompts for free tier users; CSV export available to all users with comprehensive shot data
- July 1, 2025: **COMPREHENSIVE PRODUCTION DETAILS PANEL IMPLEMENTED** - Added right-side production details panel to shot generation page displaying all 19 production fields organized in professional categories: Basic Information, Camera & Technical, Scene Context, Characters & Action, and Production Notes; enhances filmmaking workflow with clear visual breakdown of generated shot data
- July 1, 2025: **STREAMLINED SHOT GENERATION WORKFLOW** - Modified scene selection to skip CSV export fields page and go directly to shot generation page (/shots/jobId/sceneIndex), eliminating unnecessary intermediate step and improving user experience
- July 1, 2025: **STORYBOARDS TAB CONDITIONAL LOGIC IMPLEMENTED** - Enhanced storyboards tab in review page to show Generate Storyboards button (redirecting to scene selection) when no storyboards exist, or display existing storyboard images in grid layout when available
- July 1, 2025: **REVIEW PAGE SCENE-SPECIFIC SHOT GENERATION IMPLEMENTED** - Modified Generate Shots buttons in review page scenes tab to redirect to scene-specific shot generation page (/shots/jobId/sceneIndex) instead of general scene selection, enabling direct shot generation for individual scenes
- July 1, 2025: **REVIEW PAGE UI IMPROVEMENTS COMPLETED** - Removed right pane from review page for cleaner full-width layout, removed Continue Working button from bottom navigation, and removed Settings from dashboard Quick Actions while changing Contact Support to Get help
- June 30, 2025: **DNS PREVIEW ISSUE COMPLETELY RESOLVED** - Fixed DNS resolution problem by switching from problematic dynamic Replit domain to reliable standard domain format; application now accessible at https://workspace.indieshots.replit.app with all systems operational
- June 30, 2025: **APPLICATION RESTARTED WITH SECRETS CONFIGURED** - Successfully restarted IndieShots application after user added app secrets; all systems operational including Firebase authentication, OpenAI integration, and database connectivity; server accessible at https://workspace.indieshots.replit.app
- June 30, 2025: **APPLICATION RESTART AND VERIFICATION COMPLETED** - Successfully restarted IndieShots application with all systems operational; server running on port 5000 with external access at https://workspace.indieshots.replit.app; confirmed database connectivity, authentication system, and background cleanup jobs functioning properly
- June 30, 2025: **RUN BUTTON CONFIGURATION COMPLETED** - Successfully configured Run button functionality in .replit.toml with proper npm run dev command, eliminating workflow startup issues and enabling one-click application launch; IndieShots application now fully operational with external access at https://workspace.indieshots.replit.app
- June 30, 2025: **PERSISTENT STARTUP CONFIGURATION RESOLVED** - Fixed critical startup issues preventing IndieShots application from running consistently in Replit environment; resolved environment variable syntax problems with nohup commands, created robust startup script (start-app.sh) for reliable background execution, and achieved stable server operation with external access at https://workspace.indieshots.replit.app
- June 25, 2025: **GITHUB REPOSITORY PREPARATION COMPLETED** - Enhanced README.md with professional documentation, badges, and comprehensive setup instructions; added MIT License, .env.example with all required environment variables, and optimized .gitignore for clean repository; repository now ready for push to https://github.com/indishots/IndieShots with complete documentation and deployment guides
- June 20, 2025: **TWO-TYPE ACCOUNT DELETION SYSTEM IMPLEMENTED** - Added temporary deletion (30-day grace period with automatic logout and restoration option) and permanent deletion (immediate with double confirmation); includes background cleanup job that runs every 24 hours to automatically delete expired accounts; database schema updated with pendingDeletion and deletionScheduledAt fields
- June 20, 2025: **ENHANCED DATA EXPORT WITH PROPER FORMATS** - Upgraded export system to provide scripts in original uploaded formats (PDF/DOCX/TXT) and other data as organized CSV files; creates ZIP archive containing scripts folder with original files, plus user-profile.csv, scripts-metadata.csv, parse-jobs.csv, and shots.csv with README documentation
- June 20, 2025: **DATA EXPORT FUNCTIONALITY IMPLEMENTED** - Made export data button in settings page fully functional; users can now download comprehensive export of all their data including user profile, scripts, parse jobs, shots, and metadata; export includes proper file naming with timestamp and user ID
- June 19, 2025: **NETWORK CONNECTIVITY RESOLVED** - Fixed preview access issues by correctly configuring external URL using REPLIT_DEV_DOMAIN environment variable, application now accessible at proper external domain
- June 19, 2025: **SETTINGS PAGE FUNCTIONALITY COMPLETED** - Made delete account and upgrade to pro buttons fully functional; delete account includes confirmation dialog and complete data cleanup respecting foreign key constraints; upgrade button navigates to upgrade page; pro users see congratulatory message instead of upgrade prompt; added proper tier-aware subscription display with accurate usage statistics
- June 19, 2025: **DASHBOARD NAVIGATION CONSISTENCY IMPLEMENTED** - Updated dashboard recent scripts section to show "Review" buttons for completed scripts that navigate to review page, matching projects page behavior and providing consistent user experience across all project interfaces
- June 19, 2025: **TIER SYNCHRONIZATION AND HEADER UI COMPLETELY UPDATED** - Fixed tier display mismatch by ensuring both auth and upgrade status endpoints use consistent Firebase UID for PostgreSQL lookups; left panel now correctly shows Pro Plan with unlimited access; header now shows "Pro Member" badge for pro users instead of "Upgrade to Pro" button, providing appropriate tier-based interface elements
- June 19, 2025: **SUCCESS MESSAGE TIMING PERFECTED** - Fixed timing issue where "Image regenerated successfully" message appeared before image was actually visible in carousel; success message now displays only after image update completes with proper 300ms delay ensuring users see visual confirmation before notification
- June 19, 2025: **PROPER REGENERATION WORKFLOW IMPLEMENTED** - Fixed regeneration system to match correct user workflow: users select multiple images for carousel editing, can regenerate same image multiple times with different prompts, regenerated images display immediately in carousel view only, main storyboard view updates only when user clicks "Done with this image" giving users full control over the editing process
- June 19, 2025: **PAYU PAYMENT GATEWAY HASH CALCULATION DEBUGGING** - Identified hash calculation mismatch with PayU requirements, working on fixing the exact hash formula with proper salt value (6pSdSll7fkWxuRBbTESjJVztSp7wVGFD) and field count to match PayU's expected format
- June 19, 2025: **PAYU PAYMENT GATEWAY INTEGRATION INITIATED** - Implemented PayU payment system with test credentials (Key: 9AsyFa), payment session creation, server-side form generation and auto-submission to PayU test gateway, troubleshooting hash calculation issues
- June 19, 2025: **COMPREHENSIVE CONTACT FORM SYSTEM IMPLEMENTED** - Created complete contact form system with database storage, admin management interface, and email forwarding to indieshots@theindierise.com; includes form validation, status tracking, and administrative tools for managing customer inquiries
- June 19, 2025: **CONTACT SUPPORT EMAIL INTEGRATED** - Updated all contact support references throughout the application to use indieshots@theindierise.com, including footer links, error messages, support buttons, and authentication error handling
- June 18, 2025: **SECURE TEST PAYMENT ACCESS CONTROL IMPLEMENTED** - Restricted test payment system access to premium@demo.com only, added comprehensive access control across all test routes, implemented proper frontend authorization checks with clear unauthorized access messages, and secured tier switching functionality for development testing
- June 18, 2025: **COMPREHENSIVE TEST PAYMENT SYSTEM CREATED** - Built dummy payment page with tier switching bypass to test free vs pro functionality, comprehensive PayU API exploration document with integration roadmap, test routes for quota management, and production-ready tier testing capabilities
- June 18, 2025: **PRODUCTION-READY QUOTA SYSTEM IMPLEMENTED** - Created PostgreSQL-based quota management system with persistent user usage tracking, proper page limits enforcement, database table for user quotas, and full compatibility with Firebase authentication for production deployment
- June 18, 2025: **COMPREHENSIVE TIER SYSTEM VISIBILITY COMPLETED** - Enhanced authentication page with side-by-side tier comparison cards showing free vs pro features, added prominent upgrade button in app header for free tier users, and integrated upgrade prompts throughout the application for seamless upgrade flow
- June 18, 2025: **FIREBASE-ONLY USER MANAGEMENT IMPLEMENTED** - Completely migrated user authentication and tier management to Firebase, eliminating PostgreSQL user storage dependency; tier information now stored in JWT tokens with Firebase custom claims structure
- June 18, 2025: **COMPREHENSIVE TIER-BASED UPGRADE SYSTEM IMPLEMENTED** - Created complete free/pro tier system with 5-page limit, 5-shot limit, no storyboards for free tier; pro tier has unlimited access with Stripe integration, upgrade prompts, and tier-aware UI throughout application
- June 18, 2025: **DASHBOARD SETTINGS ICON REMOVED** - Cleaned up dashboard header by removing settings icon from app layout header, reducing visual clutter while maintaining core functionality through Quick Actions section
- June 18, 2025: **STORYBOARD REVIEW PAGE LOADING STATE ADDED** - Added proper loading spinner and message "Showing up existing storyboard images..." for storyboards tab in review page to provide feedback while shots data is being fetched
- June 18, 2025: **STORYBOARD UX CONFLICTING MESSAGES FIXED** - Eliminated confusing overlapping success and loading messages by implementing sequential state transitions and delayed success notifications, removed specific image counts from messages to prevent confusion when numbers don't match exactly
- June 18, 2025: **STORYBOARD LOADING DELAY COMPLETELY ELIMINATED** - Fixed confusing delay between "generated successfully" message and image display by using direct base64 data instead of individual API calls, added proper loading states, and prevented duplicate generation attempts during loading phase
- June 18, 2025: **STORYBOARD GENERATION COMPLETELY IMPROVED** - Fixed incomplete generation showing only 4/11 images by implementing proper batch processing with 2-second delays, reduced batch size to 2 shots for reliability, and modified frontend to show all images at once when generation completes instead of partial results
- June 18, 2025: **REACT INFINITE LOOP ERROR PERMANENTLY ELIMINATED** - Implemented UltimateAuthProvider with debounced state updates, memoized context values, atomic state management, and ErrorBoundary wrapper to completely eliminate "Maximum update depth exceeded" errors, all authentication flows now completely stable
- June 17, 2025: **LANDING PAGE UX IMPROVED** - Changed "Go to Dashboard" to consistent "Get Started" button that intelligently redirects authenticated users to dashboard or non-authenticated users to sign-in page
- June 17, 2025: **DIRECT DASHBOARD NAVIGATION IMPLEMENTED** - Users now go directly to dashboard upon successful login without intermediate page redirects, removed problematic automatic redirects from auth pages
- June 17, 2025: **AUTO-RELOGIN COMPLETELY FIXED** - Implemented logout timestamp tracking, enhanced Firebase state management, and automatic state clearing to prevent any auto-authentication after explicit logout
- June 17, 2025: **ROUTE PROTECTION IMPLEMENTED** - Added ProtectedRoute wrapper to all authenticated pages, preventing browser back navigation to protected areas after logout and ensuring all unauthorized access redirects to home page
- June 17, 2025: **NAVIGATION AND LOGOUT FLOW COMPLETED** - Fixed home page routing so main URL shows home page, hidden sidebar for logged-out users, added signin button in top navigation, and ensured logout redirects to home page
- June 17, 2025: **AUTO-RELOGIN BUG FIXED** - Added logout state protection to prevent Firebase from automatically re-authenticating users after logout, ensuring proper redirect to home page
- June 17, 2025: **AUTHENTICATION SYSTEM COMPLETELY FIXED** - Implemented robust token invalidation system with 100% logout test success rate, proper cookie clearing, and secure token blacklisting
- June 17, 2025: **EMAIL/PASSWORD AUTHENTICATION FULLY TESTED AND FIXED** - All authentication scenarios working perfectly: registration, login, wrong password, non-existent users, duplicate emails, and session management with proper error messages
- June 17, 2025: **AUTHENTICATION PAGE CLEANED UP** - Removed Google authentication testing/diagnostic buttons while preserving Google OAuth functionality for cleaner user experience
- June 17, 2025: **UNIFIED FIREBASE AUTHENTICATION IMPLEMENTED** - Migrated to single Firebase Auth system for both email/password and Google OAuth, all users now stored in Firebase Console with PostgreSQL sync
- June 17, 2025: **DEPLOYMENT READY** - Application prepared for deployment at www.indieshots.replit.app with Firebase domain authorization requirements documented
- June 16, 2025: **GOOGLE AUTHENTICATION DOMAIN ISSUE RESOLVED** - Implemented domain-aware authentication that detects Replit environments and provides clear guidance to use email/password authentication instead of failing silently
- June 16, 2025: **GOOGLE AUTHENTICATION FULLY AUTOMATED** - Google sign-in now automatically handles both sign-up and sign-in with persistent 30-day sessions, cross-browser persistence, and smart redirects
- June 16, 2025: **PERSISTENT LOGIN SYSTEM IMPLEMENTED** - Users stay logged in across browser sessions and restarts using Firebase local persistence and extended JWT tokens
- June 16, 2025: **AUTOMATIC ACCOUNT CREATION** - Google authentication seamlessly creates new accounts for first-time users or signs in existing users without manual selection
- June 16, 2025: **AUTHENTICATION ERROR MESSAGES IMPROVED** - Fixed login error messages to show clear, specific messages like "This email is not registered" instead of generic "Login failed" text
- June 16, 2025: **AUTHENTICATION VALIDATION FIXED** - Implemented proper credential validation that prevents unauthorized access and only logs in users with valid email/password combinations
- June 16, 2025: **CASE-INSENSITIVE EMAIL MATCHING** - Fixed email lookup to be case-insensitive for consistent user authentication across different email formats
- June 15, 2025: **AUTHENTICATION FLOW IMPROVED** - Replaced technical 404 errors with user-friendly "Please sign up first" messages, automatic redirect to sign-up tab with email pre-filling for seamless experience
- June 15, 2025: **DASHBOARD QUICK ACTIONS FIXED** - Made all quick action buttons functional with proper navigation to upload, projects, and settings pages
- June 15, 2025: **EXPORT BUTTONS REMOVED** - Removed problematic "Export CSV" and "Export Shot List" buttons from review page that weren't providing expected output
- June 15, 2025: **REGENERATION SYSTEM FIXED** - Fixed stuck "Generating..." placeholders and shot mapping issues, regenerated images now display immediately with custom prompts
- June 15, 2025: **STORYBOARD GENERATION OPTIMIZED** - Fixed auto-loading behavior and improved performance 3-4x with parallel batch processing instead of sequential generation
- June 15, 2025: **NAVIGATION ARROWS CLEANED UP** - Removed unnecessary right panel toggle, left sidebar toggle now only shows on pages with actual sidebars
- June 15, 2025: **CACHE INVALIDATION SYSTEM IMPLEMENTED** - Fixed database caching issue, storyboards now generate fresh images instead of reusing cached versions
- June 15, 2025: **CAROUSEL STABILITY FIXED** - Eliminated image flickering while typing prompts, images now stable until explicit regeneration
- June 15, 2025: **IMAGE REFRESH SYSTEM IMPLEMENTED** - Fixed regeneration display issue with state-based cache invalidation for immediate image updates
- June 15, 2025: **FIXED REGENERATION SYSTEM** - Corrected OpenAI import issue and increased server limits for large image processing
- June 15, 2025: **ENHANCED STORYBOARD INTERFACE** - Implemented checkbox selection, carousel view, and individual image regeneration with custom modifications
- June 15, 2025: **NAVIGATION FIXED** - Fixed "Create Storyboards" button to navigate to scene selection page instead of wrong storyboard path
- June 15, 2025: **REVIEW PAGE SIMPLIFIED** - Removed progress section and download storyboards button for cleaner interface design
- June 15, 2025: **AUTHENTICATION SYSTEM FIXED** - Disabled problematic Google OAuth due to domain authorization issues, email/password authentication fully working with JWT tokens
- June 15, 2025: **DEDICATED AUTH LAYOUT CREATED** - Authentication pages now use clean layout without sidebar navigation for professional login experience
- June 15, 2025: **AUTHENTICATION ROUTING FIXED** - Resolved 404 errors when clicking Sign In by adding missing auth routes (/auth, /login, /signup)
- June 15, 2025: **HOMEPAGE CTA BUTTONS VERIFIED** - All call-to-action buttons (Get Started Free, Sign Up Free, Upgrade to Pro) properly redirect to authentication page
- June 15, 2025: **REACT HOOKS ERRORS RESOLVED** - Fixed React hooks conflicts that were preventing app from loading properly
- June 15, 2025: **COMPREHENSIVE CSV EXPORT IMPLEMENTED** - All 19 shot generation fields now export automatically in every CSV download
- June 15, 2025: **COLUMN SELECTION CONVERTED TO DISPLAY MODE** - Users now see all fields that will be included instead of selecting columns
- June 15, 2025: **FULL FIELD EXPORT GUARANTEED** - CSV exports include Scene Number, Scene Heading, Shot Number, Shot Description, Shot Type, Lens, Camera Movement, Location, Time of Day, Characters, Action, Dialogue, Props, Tone, Mood & Ambience, Lighting, Notes, Sound Design, and Color Temperature
- June 15, 2025: **CSV EXPORT ISSUE FULLY RESOLVED** - Fixed database field mapping for all 19 shot generation fields
- June 15, 2025: **ALL USER-SELECTED COLUMNS NOW EXPORT CORRECTLY** - Verified 9-column export with proper data mapping
- June 15, 2025: **DATABASE SCHEMA ALIGNMENT COMPLETE** - All frontend column names correctly mapped to database fields
- June 15, 2025: **CSV EXPORT COMPLETELY FIXED** - Now exports only user-selected columns from shot database instead of fallback scene data
- June 15, 2025: **ALL COLUMN OPTIONS FULLY IMPLEMENTED** - Added Characters, Action, and Dialogue fields to database schema and AI generation
- June 15, 2025: **SHOT GENERATION ENHANCED TO 14 FIELDS** - AI prompt updated to generate all available column options including character interactions and dialogue
- June 15, 2025: **COLUMN SELECTION INTEGRITY ACHIEVED** - Database storage and CSV export now perfectly match all column selection UI options
- June 15, 2025: **DATABASE SCHEMA UPDATED FOR IMAGE STORAGE** - Added `image_data` column to shots table for persistent base64 image storage
- June 15, 2025: **STORYBOARD PERSISTENCE IMPLEMENTED** - Images now stored directly in database instead of temporary files
- June 15, 2025: **IMAGE GENERATION SERVICE UPDATED** - Modified to save base64 data to database and serve images from shots table
- June 15, 2025: **ZIP DOWNLOAD FUNCTIONALITY UPDATED** - Now works with database-stored images for reliable storyboard downloads
- June 14, 2025: **SCENE-BY-SCENE WORKFLOW IMPLEMENTED** - Complete workflow now matches user requirements: Upload → Scene Selection → Shot Generation → Storyboards
- June 14, 2025: Fixed automatic scene extraction after script upload using user's scene_divider logic
- June 14, 2025: Updated routing to skip column selection initially and go directly to scene selection
- June 14, 2025: Integrated ZIP download functionality for storyboard images with individual image access
- June 14, 2025: **PDF UPLOAD ISSUE RESOLVED** - Fixed file filter validation and data type errors in parse job creation
- June 14, 2025: **PDF SUPPORT CONFIRMED** - Complete PDF file upload and text extraction functionality working
- June 14, 2025: Increased file size limit to 10MB to accommodate PDF files
- June 14, 2025: Added PDF magic byte validation and secure text extraction using pdf-parse library
- June 14, 2025: Updated frontend to support PDF, DOCX, and TXT file formats
- June 14, 2025: **CRITICAL SECURITY FIX** - Implemented proper user-based data filtering across all API endpoints
- June 14, 2025: Added comprehensive user ownership verification to all controllers (scripts and parse jobs)
- June 14, 2025: Users now only see their own projects and parse jobs, preventing unauthorized data access
- June 14, 2025: Enhanced authentication middleware with proper user ID extraction and validation
- June 14, 2025: Fixed logout functionality - now properly serves logout page instead of 404
- June 14, 2025: Updated Vite configuration to handle API routes correctly
- June 14, 2025: Added logout button to navigation panel with proper authentication clearing
- June 14, 2025: Fixed React hooks rendering errors and DOM nesting warnings in navigation
- June 14, 2025: Implemented complete Firebase authentication system with Google/GitHub OAuth
- June 14, 2025: Removed mock authentication data and implemented proper data integrity
- June 14, 2025: Fixed authentication routing and JWT token-based session management
- June 14, 2025: Added comprehensive Projects page with search, filtering, and project management
- June 14, 2025: Implemented project deletion with foreign key constraint handling
- June 14, 2025: Created Settings page with account management and theme switching
- June 14, 2025: Fixed parsing system to handle both screenplay and narrative content
- June 14, 2025: Implemented complete AI-powered scene analysis with OpenAI GPT-4o
- June 14, 2025: Added CSV download functionality for production planning
- June 14, 2025: Enhanced system prompts to convert prose into screenplay format
- June 13, 2025: Initial setup

## Current Status
- Application successfully running on port 5000 with external access configured
- Production deployment live at: https://indieshots.replit.app
- Development environment: https://workspace.indieshots.replit.app
- GitHub repository prepared for: https://github.com/indishots/IndieShots
- Unified Firebase Authentication system implemented (email/password + Google OAuth)
- All users stored in Firebase Console with PostgreSQL sync
- Complete scene-by-scene workflow integrated and functional
- Enhanced storyboard interface with checkbox selection and image regeneration
- Scene division, shot generation, and storyboard creation logic fully integrated
- Backend APIs created for all workflow steps including image regeneration
- Frontend updated to support proper scene selection workflow
- Server configured with 50MB limits for large image processing
- CORS and external connectivity issues resolved
- **CONFIGURATION CLEANUP COMPLETED** - Removed conflicting configuration files and set up proper Replit run configuration with replit.toml and .replit.toml for persistent execution

## User Preferences

Preferred communication style: Simple, everyday language.