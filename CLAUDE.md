# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Principale
Parla sempre in italiano ma il codice scrivilo in inglese

## Project Overview

Family Task Tracker is a React-based PWA built with Vite, Firebase, and TypeScript. It's a comprehensive family management application that includes task tracking, shopping lists, notifications, notes, Spotify integration, digital wallet, and AI chat features.

**Architecture**: Single-page application with hash-based routing, Firebase backend, and Firebase Functions for server-side operations.

## Development Commands

### Core Development
- `npm run dev` - Start development server with hot reload
- `npm run dev:fcm` - Start development with FCM token bridge running
- `npm run dev:full` - Start development with full notification automation

### Building
- `npm run build` - Standard production build (builds service worker, runs Vite build, copies SW to docs)
- `npm run build:local` - Build for local testing environment
- `npm run build:staging` - Build for staging environment
- `npm run build:production` - Build for production environment
- `npm run preview` - Preview production build locally

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix

### Version Management
- `npm run version:increment` - Increment build version for production
- `npm run version:dev` - Increment build version for development
- `npm run version:current` - Show current version
- `npm run version:info` - Show detailed version information

### Firebase Cloud Messaging (FCM)
- `npm run notifications:setup` - Install FCM dependencies and setup instructions
- `npm run notifications:auto` - Start FCM token bridge for automatic notifications
- `npm run notifications:test` - Test FCM notifications
- `npm run fcm:bridge:start` - Start FCM token bridge system
- `npm run fcm:bridge:stats` - Show FCM bridge statistics

### Testing & Verification
- `npm run test:local` - Run local testing suite
- `npm run test:build` - Test the build process
- `npm run verify:build` - Verify build integrity

## Project Structure

### Key Directories
- `client/` - Main React application source code
- `client/src/components/` - Reusable UI components organized by feature
- `client/src/contexts/` - React contexts (Auth, Theme, UserPreferences, AIChatProvider)
- `client/src/hooks/` - Custom React hooks
- `client/src/lib/` - Utilities, Firebase config, models, and service integrations
- `client/src/pages/` - Top-level page components
- `client/src/services/` - External service integrations (Spotify, AI chat, etc.)
- `functions/` - Firebase Cloud Functions
- `scripts/` - Build and automation scripts
- `docs/` - Production build output (served by GitHub Pages)

### Core Architecture Components

**Routing**: Uses Wouter with hash-based routing (`useHashLocation` hook in App.tsx)

**State Management**: 
- React Query for server state
- React contexts for global state (Auth, Theme, User Preferences)
- Local state with React hooks

**Authentication**: Firebase Auth with custom AuthContext and useAuth hook

**Database**: Firestore with custom hooks (useFirestore.ts) and service layers

**UI Framework**: 
- Radix UI components with custom styling
- Tailwind CSS for styling
- Framer Motion for animations

**Key Features**:
- Shopping lists with price tracking and image recognition
- Task management with categories
- Notes system with rich editing
- Digital wallet for loyalty cards
- Spotify integration with stats
- AI chat integration (DeepSeek)
- Push notifications via FCM
- PWA capabilities with service worker

## Environment Setup

Required environment variables (in `.env` file):
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

## Service Worker & PWA

The project uses a custom service worker build system:
- `npm run build:sw` - Build service worker
- `npm run clean:sw` - Clean service worker files
- Service worker is automatically copied to `docs/` during build

## Development Notes

### Firebase Functions
- Located in `functions/` directory
- Has its own package.json and dependencies
- Includes services for content extraction, notifications, price monitoring, web scraping

### Version Management
- Version stored in `version.json` with semantic versioning
- Automatic version incrementing via scripts
- Build numbers track deployment iterations

### Mobile & iOS Compatibility
- Vite config includes iOS Safari-specific optimizations
- Hash routing used for iOS compatibility
- PWA manifest and icons configured for mobile installation

### Notification System
- FCM token bridge system for cross-platform notifications
- Automated notification management via scripts
- Integration with Firebase Functions for server-side notifications

## Important File Locations

- Main app entry: `client/src/App.tsx`
- Firebase config: `client/src/lib/firebase.ts`
- Build config: `vite.config.ts`
- Version info: `version.json`
- Service worker: `client/public/firebase-messaging-sw.js`