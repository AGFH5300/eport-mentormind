# ChatFlow - Real-time Chat Application

## Overview

ChatFlow is a real-time chat application built with a modern full-stack architecture. The application enables users to create accounts, join chat rooms, send messages, and interact with friends in real-time. It features user authentication with email verification, private and public chat rooms, friend management, and real-time messaging with typing indicators and online status tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side is built as a single-page application using React with TypeScript. The architecture follows a component-based design with:

- **React Router (Wouter)**: Handles client-side routing with protected and public route components
- **Context Providers**: Global state management for authentication (AuthContext) and chat functionality (ChatContext)  
- **React Query**: Server state management for API calls and caching
- **Component Library**: Shadcn/ui components built on Radix UI primitives for consistent UI patterns
- **Styling**: Tailwind CSS with CSS variables for theming support (light/dark mode)
- **Real-time Communication**: WebSocket connection for live messaging, typing indicators, and presence tracking

### Backend Architecture
The server follows an Express.js-based REST API design with:

- **Express.js Server**: HTTP server handling API routes and serving static assets
- **WebSocket Integration**: Real-time bidirectional communication using ws library
- **Route Structure**: Centralized route registration in `/server/routes.ts`
- **Middleware**: Request logging, JSON parsing, and error handling
- **Development Setup**: Vite integration for hot module replacement during development

### Database Design
The application uses PostgreSQL with Drizzle ORM for type-safe database operations:

- **Users Table**: Stores user profiles, authentication status, and online presence
- **Chat Rooms Table**: Manages public/private chat rooms with creator relationships
- **Messages Table**: Stores chat messages with support for replies and different message types
- **Room Members Table**: Junction table managing user-room relationships with roles
- **Additional Tables**: Friend requests, message reactions, and user sessions

### Authentication System
Multi-layered authentication approach:

- **Supabase Auth**: Primary authentication provider for user management
- **Email Verification**: Token-based email verification system using Nodemailer
- **Session Management**: JWT tokens for API authentication
- **Protected Routes**: Client-side route protection based on authentication state
- **Password Security**: bcrypt for password hashing when needed

### Real-time Features
WebSocket-based real-time functionality:

- **Live Messaging**: Instant message delivery across connected clients
- **Typing Indicators**: Shows when users are actively typing in chat rooms
- **Online Presence**: Tracks and displays user online/offline status
- **Room Management**: Real-time updates for room joins/leaves

## External Dependencies

### Core Services
- **Supabase**: Authentication service and real-time database subscriptions
- **Neon Database**: PostgreSQL database hosting with connection pooling
- **Gmail SMTP**: Email delivery service for verification and notifications

### Development Tools
- **Vite**: Frontend build tool and development server
- **Drizzle Kit**: Database schema management and migrations
- **ESBuild**: Server-side code bundling for production

### UI and Styling
- **Radix UI**: Headless UI component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography

### State Management
- **React Query**: Server state caching and synchronization
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema parsing

### Real-time Communication
- **WebSocket (ws)**: Server-side WebSocket implementation
- **Native WebSocket API**: Client-side real-time communication