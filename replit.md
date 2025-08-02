# IndieShots - Screenplay to Shot List Converter

## Overview
IndieShots is a full-stack web application designed for independent filmmakers and content creators. Its core purpose is to streamline pre-production by converting screenplay scripts into structured shot lists using AI-powered analysis. It automatically extracts scenes, characters, locations, and other production elements, offering features like authentication, flexible file processing, and detailed shot list generation, including storyboarding capabilities. The project aims to be a comprehensive tool to enhance efficiency in film pre-production.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application uses a monorepo structure with a React frontend and Express.js backend, both written in TypeScript, emphasizing simplicity, rapid development, and scalability.

### Frontend
*   **Framework**: React 18 with TypeScript
*   **Styling**: Tailwind CSS with shadcn/ui for components
*   **State Management**: TanStack Query
*   **Routing**: Wouter
*   **Build Tool**: Vite

### Backend
*   **Runtime**: Node.js with Express.js
*   **Language**: TypeScript with ES modules
*   **Database**: PostgreSQL with Drizzle ORM
*   **Authentication**: Multiple providers (Firebase, JWT, OAuth)
*   **File Processing**: Multer for DOCX/TXT uploads
*   **AI Integration**: OpenAI GPT-4 for script parsing

### Key Components and Design Decisions
*   **Authentication System**: Supports Firebase Authentication (Google OAuth), JWT-based local authentication, and session-based authentication for flexibility. A demo mode is available.
*   **File Processing Pipeline**: Involves upload via Multer, text extraction, AI-powered parsing with OpenAI GPT-4, and export to XLSX/CSV. File validation uses magic bytes and extension whitelisting for security.
*   **Database Design**: PostgreSQL is chosen for ACID compliance and JSON support, storing user profiles, subscription tiers, usage quotas, script metadata, parse jobs, and sessions.
*   **Data Flow**: User registration/login, script upload with validation, user selection of data fields for extraction, background AI processing, and final review/export.
*   **UI/UX**: Consistent indigo and golden color scheme, enhanced status badges, streamlined dashboard layouts, and professional visual design. Includes animated loading states and an animated upgrade modal for premium features.
*   **Core Features**:
    *   AI-powered scene analysis with OpenAI GPT-4.
    *   Generation of detailed shots including 19 production fields.
    *   AI storyboard generation with character consistency and intelligent error recovery.
    *   Tier-based access (Free/Pro) with usage quotas and upgrade prompts.
    *   Comprehensive export options (CSV, Excel, original script formats).
    *   Two-type account deletion (temporary and permanent).
    *   Robust error handling with user-friendly messages and smart retry mechanisms for AI generation.
    *   Time-sensitive promo code system.
    *   Firebase-first data consistency and authentication.
    *   Comprehensive FAQ system.

### Deployment
*   **Production Environment**: Deployed at https://current-stable-version-indieshots.replit.app
*   **Development Environment**: Replit with PostgreSQL module, running on port 5000.
*   **Build Process**: Frontend with Vite, backend with esbuild.
*   **Environment Variables**: DATABASE_URL, OPENAI_API_KEY (working with credits), JWT_SECRET (configured), VITE_FIREBASE_API_KEY (optional), VITE_FIREBASE_PROJECT_ID (optional).
*   **Payment System**: PayU integration functional with ₹999 Pro tier upgrades working in production.

## External Dependencies
*   **OpenAI**: GPT-4 API for script parsing and DALL-E 3 for image generation.
*   **Firebase**: Authentication services and custom claims.
*   **SendGrid**: Email services for notifications.
*   **Neon**: PostgreSQL database hosting.
*   **PayU**: Payment gateway (India-focused).
*   **Stripe**: Payment gateway (Global).
*   **exchangerate-api.com**: For currency conversion (if applicable).
*   **Multer**: For file uploads.
*   **Drizzle ORM**: For database interaction.
*   **pdf-parse**: For PDF text extraction.