# Legacy Holiday Home Diani - Vacation Rental Website

## Overview

Legacy Holiday Home Diani is a luxury vacation rental property website showcasing a 3-bedroom villa located in Diani Beach, Kenya. The application is designed as a single-page marketing site with an integrated booking system, featuring an image-first approach to highlight the property's amenities and tropical setting. The site enables visitors to explore the villa through a comprehensive photo gallery, view amenities, and make booking inquiries with integrated payment processing through Stripe.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, utilizing a client-side routing strategy with Wouter for navigation.

**UI Component System**: Built on shadcn/ui components (based on Radix UI primitives) with extensive customization through Tailwind CSS. The design system follows a "new-york" style variant with custom color schemes optimized for a luxury vacation rental aesthetic.

**Design Philosophy**: Image-first, conversion-focused design inspired by Airbnb and luxury rental platforms. The architecture prioritizes visual storytelling with full-width galleries, hero sections, and prominent call-to-action elements. Typography uses a dual-font system (Playfair Display for headings, Inter for body text) to convey sophistication.

**State Management**: React Query (@tanstack/react-query) handles server state, API calls, and data caching. Local component state managed through React hooks.

**Form Handling**: React Hook Form with Zod schema validation for booking forms, ensuring type-safe data validation before submission.

**Styling Approach**: Tailwind CSS with extensive custom CSS variables for theming. The system uses HSL color values for dynamic theming support and includes custom utility classes for elevation effects (hover-elevate, active-elevate-2).

### Backend Architecture

**Runtime**: Node.js with Express.js server framework.

**API Design**: RESTful API with primary focus on booking operations. The `/api/bookings` endpoint handles booking creation, validation, and payment initialization.

**Build System**: Vite for frontend bundling with custom middleware integration. The development server uses Vite's middleware mode for hot module replacement while production builds serve static files through Express.

**Request Processing**: Custom middleware for request logging, JSON parsing with raw body preservation (required for Stripe webhook verification), and error handling.

### Database Architecture

**ORM**: Drizzle ORM with PostgreSQL dialect configuration.

**Schema Design**: Two primary tables:
- `users`: Simple authentication table (username/password)
- `bookings`: Comprehensive booking records including guest information, dates, payment status, and Stripe integration fields

**Storage Abstraction**: Interface-based storage layer (`IStorage`) with in-memory implementation (`MemStorage`) for development/testing. Designed to be swapped with PostgreSQL implementation in production.

**Migration Strategy**: Drizzle Kit handles schema migrations, with configuration pointing to `./migrations` output directory.

### Payment Processing

**Provider**: Stripe integration for payment handling.

**Implementation**: 
- Frontend uses `@stripe/stripe-js` and `@stripe/react-stripe-js` for payment UI components
- Backend creates payment intents and manages payment status updates
- Payment Elements API provides embedded payment forms
- Webhook support for payment status notifications (raw body parsing preserved)

**Security**: Payment intent creation server-side, client receives publishable key only, sensitive operations protected by Stripe secret key.

### Email System

**Provider**: Nodemailer configured with Gmail SMTP.

**Purpose**: Automated booking confirmation emails sent after successful reservation creation.

**Configuration**: Environment-variable based authentication (EMAIL_USER, EMAIL_PASS) with fallback defaults for development.

### Asset Management

**Static Assets**: Images stored in `attached_assets` directory, imported through Vite's asset handling with custom alias (`@assets`) for clean imports.

**Image Strategy**: Gallery uses 16 property images covering pool, bedrooms, living areas, kitchen, bathrooms, and exterior views. Each image includes descriptive alt text for accessibility and SEO.

### Validation Layer

**Schema Validation**: Zod schemas derived from Drizzle table definitions using `drizzle-zod` for consistent validation between database constraints and API inputs.

**Error Handling**: Friendly error messages generated using `zod-validation-error` package, transforming technical validation errors into user-readable messages.

## External Dependencies

### Third-Party Services

**Stripe**: Payment processing platform requiring `STRIPE_SECRET_KEY` environment variable. API version locked to "2025-11-17.clover".

**Gmail SMTP**: Email delivery through Gmail's SMTP server (smtp.gmail.com:587) requiring `EMAIL_USER` and `EMAIL_PASS` credentials.

**Airbnb**: External booking platform integrated via link (AIRBNB_URL placeholder in code awaiting actual listing URL).

### Database

**PostgreSQL**: Primary database via Neon serverless driver (`@neondatabase/serverless`). Requires `DATABASE_URL` environment variable for connection.

### CDN Services

**Google Fonts**: Playfair Display and Inter font families loaded from Google Fonts CDN.

### Development Tools

**Replit Plugins**: Development environment integrations including runtime error modal, cartographer (code mapping), and dev banner for Replit-specific features.

### Key NPM Packages

**UI Components**: Extensive Radix UI primitives (@radix-ui/*) for accessible component foundations.

**Date Handling**: date-fns for date calculations and formatting in booking system.

**Utility Libraries**: 
- clsx + tailwind-merge (via cn utility) for conditional className composition
- class-variance-authority for type-safe component variants
- nanoid for unique ID generation