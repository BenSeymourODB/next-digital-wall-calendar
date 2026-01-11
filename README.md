# Digital Wall Calendar for Families

[![Build Next.js in standalone mode](https://github.com/rbcministries/nextjs-16-template/actions/workflows/main_nextjs-template-build.yml/badge.svg)](https://github.com/rbcministries/nextjs-16-template/actions/workflows/main_nextjs-template-build.yml)

A privacy-first, self-hosted family calendar and task management system. A free, customizable alternative to commercial products like Skylight Calendar, designed for tech-savvy families who value open source, privacy, and smart home integration.

## 🎯 Project Goals

This project aims to be a **comprehensive family hub** that goes beyond simple calendar display:

1. **Privacy-First**: Self-hosted, local processing, no cloud dependencies for core features
2. **Free Alternative**: No subscriptions, no hardware lock-in, run on your own devices
3. **Family-Focused**: Multi-profile support, parental controls, kid-friendly gamification
4. **Smart Home Integration**: Works with existing home automation (Frigate NVR, Alexa, Google Assistant)
5. **Customizable**: Open source, extensible, configurable for your family's needs
6. **Data Sovereignty**: PostgreSQL as primary data store, optional sync with Google Calendar and Tasks

## ✨ Features

### Current Features

- **Digital Wall Calendar** - Display multiple Google Calendars with family scheduling
- **Next.js 16** with App Router, Turbopack, and React 19
- **TypeScript** with strict mode for type safety
- **Tailwind CSS 4** for modern, responsive styling
- **shadcn/ui** components with customizable themes
- **Application Insights** for logging and telemetry
- **Azure deployment ready** with standalone output
- **Client-side Google Calendar** integration with offline caching
- **Dark mode support** with next-themes

### Planned Features (See `.claude/plans/` for details)

#### Core Infrastructure
- **Server-Side Authentication** ([plan](/.claude/plans/server-side-auth.md))
  - Google OAuth 2.0 with refresh tokens
  - Secure session management (NextAuth.js)
  - Database-backed user accounts (PostgreSQL + Prisma)
  - Multi-user support

- **Modular Sync Architecture** ([plan](/.claude/plans/modular-sync-architecture.md)) ⭐ **Privacy-First**
  - PostgreSQL as primary data store for events and tasks
  - Optional Google Calendar sync module (enable/disable per profile)
  - Optional Google Tasks sync module (enable/disable per profile)
  - Full offline functionality without external services
  - Future support for Outlook, iCloud, CalDAV

#### Core Family Features
- **Multi-Profile Family Support** ([plan](/.claude/plans/multi-profile-family-support.md))
  - Individual profiles for each family member (parents + kids)
  - Profile avatars (initials, photos, or emojis)
  - Multiple admin support (both parents)
  - PIN security (mandatory for admins, optional for kids)
  - Profile-specific views and family view
  - Per-profile reward points and streaks

- **Task Management** ([plan](/.claude/plans/google-tasks-todo-list.md))
  - Local task storage with optional Google Tasks sync
  - Profile-based task assignment
  - Color-coded task lists
  - Due date tracking and priorities
  - Completion animations

- **Reward Point System** ([plan](/.claude/plans/reward-point-system.md))
  - Gamification for task completion
  - Per-profile point tracking
  - Family leaderboard
  - Streak tracking
  - Configurable point values
  - Admin bonus point awards

- **New Task Modal** ([plan](/.claude/plans/new-task-modal.md))
  - Quick task creation
  - Profile assignment
  - Due date picker
  - Point value configuration
  - List selection

#### Enhanced Calendar Features
- **Analog Clock Calendar** ([plan](/.claude/plans/analog-clock-calendar.md))
  - Unique circular time visualization
  - Event arcs showing duration
  - Emoji parsing from Google Calendar
  - Time-aware highlighting

- **Screen Rotation Scheduler** ([plan](/.claude/plans/screen-rotation-scheduler.md))
  - Automatic view rotation (calendar, tasks, photos)
  - Time-specific navigation
  - Pause on interaction
  - Configurable intervals

#### Meal Planning & Lists
- **Meal Planning** ([plan](/.claude/plans/meal-planning.md))
  - Weekly meal grid (Breakfast/Lunch/Dinner/Snack)
  - Meal library for reusable meals
  - Recipe integration
  - Grocery list generation
  - Dietary preferences per profile

- **Recipe Display** ([plan](/.claude/plans/recipe-display-component.md))
  - Zoom pagination for wall display
  - Ingredients and steps modes
  - Cooking timer integration

#### Smart Home Integration
- **Face Recognition Profile Switching** ([plan](/.claude/plans/face-recognition-profile-switching.md))
  - Privacy-first: camera only active on-demand
  - Frigate NVR integration (local processing)
  - PIN fallback when camera unavailable
  - Multi-face detection with user prompt
  - Auto-switch for single recognized face

- **Voice Integration** ([plan](/.claude/plans/voice-integration.md))
  - Amazon Alexa Skills Kit integration
  - Hands-free task management
  - Calendar queries via voice
  - Meal planning voice commands
  - Point awarding via voice

#### User Experience
- **User Settings Page** ([plan](/.claude/plans/user-settings-page.md))
  - Display preferences
  - Reward system configuration
  - Task list customization
  - Screen rotation settings
  - Profile management

## 🏗️ Architecture

### Frontend
- **Next.js 16** - App Router with Server Components
- **React 19** - With React Compiler for automatic optimization
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - Composable component library

### Backend
- **Next.js API Routes** - Server-side API endpoints
- **PostgreSQL** - Primary database (via Prisma ORM)
- **NextAuth.js** - Authentication and session management
- **Google APIs** - Calendar and Tasks integration

### Local Storage & Caching
- **IndexedDB** - Client-side caching for responsiveness
- **LocalStorage** - Settings and preferences
- Used for **performance optimization only** - backend is source of truth

### Smart Home Integration
- **Frigate NVR** - Face recognition (self-hosted, local network)
- **Amazon Alexa** - Voice commands (Skills Kit)
- **Google Assistant** - Voice commands (Actions on Google - future)

### Deployment
- **Azure Web Apps** - Production hosting
- **Azure PostgreSQL** - Database hosting
- **Standalone Docker** - Self-hosting option

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd next-digital-wall-calendar
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Start development server**
   ```bash
   pnpm dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)**

## 📖 Documentation

### Getting Started
- **[Wall Calendar Guide](./docs/wall-calendar.md)** - Complete guide for the digital wall calendar
- **[Google Calendar Setup](./docs/google-calendar-setup.md)** - Step-by-step API setup

### Development
- **[CLAUDE.md](./CLAUDE.md)** - Development guide for AI agents (architecture, TDD, best practices)
- **[Application Insights](./docs/application-insights.md)** - Logging and monitoring
- **[Styling Guide](./docs/styling.md)** - Tailwind CSS usage and component patterns
- **[React Compiler](./docs/react-compiler.md)** - How React Compiler works
- **[Deployment](./docs/deployment.md)** - Azure deployment guide
- **[MCP Servers](./docs/mcp-servers.md)** - Next.js DevTools, Context7, Shadcn

### Feature Plans
All feature implementation plans are in [`.claude/plans/`](/.claude/plans/):
- [Server-Side Authentication](/.claude/plans/server-side-auth.md)
- [Modular Sync Architecture](/.claude/plans/modular-sync-architecture.md) ⭐ Privacy-First
- [Multi-Profile Family Support](/.claude/plans/multi-profile-family-support.md)
- [Google Tasks Integration](/.claude/plans/google-tasks-todo-list.md)
- [Reward Point System](/.claude/plans/reward-point-system.md)
- [New Task Modal](/.claude/plans/new-task-modal.md)
- [Analog Clock Calendar](/.claude/plans/analog-clock-calendar.md)
- [Screen Rotation Scheduler](/.claude/plans/screen-rotation-scheduler.md)
- [Meal Planning](/.claude/plans/meal-planning.md)
- [Recipe Display Component](/.claude/plans/recipe-display-component.md)
- [Face Recognition Profile Switching](/.claude/plans/face-recognition-profile-switching.md)
- [Voice Integration](/.claude/plans/voice-integration.md)
- [User Settings Page](/.claude/plans/user-settings-page.md)
- [View all plans →](/.claude/plans/)

## 🛠️ Technology Stack

### Current
- **Frontend**: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4
- **Components**: shadcn/ui, Framer Motion
- **Tooling**: pnpm, ESLint, Prettier, Turbopack
- **Deployment**: Azure Web Apps, Standalone Docker
- **Monitoring**: Azure Application Insights

### Planned
- **Database**: PostgreSQL (via Prisma ORM)
- **Authentication**: NextAuth.js v5 (Google OAuth)
- **APIs**: Google Calendar API, Google Tasks API
- **Smart Home**: Frigate NVR (face recognition), Amazon Alexa (voice)
- **Caching**: IndexedDB (client-side)
- **Security**: bcrypt (PIN hashing), HTTPS/TLS

## 🎨 Design Philosophy

1. **Privacy First**: Self-hosted, local processing, no cloud for core features
2. **Family Friendly**: Multi-profile, parental controls, kid-appropriate gamification
3. **Open Source**: Free, customizable, community-driven
4. **Test-Driven**: All new features developed using TDD
5. **Accessibility**: Keyboard navigation, screen reader support, WCAG compliance
6. **Performance**: React Compiler, IndexedDB caching, optimized builds

## 🧪 Development Workflow

This project uses **Test-Driven Development (TDD)**:

1. Write tests first (unit, integration, E2E)
2. Implement feature to make tests pass
3. Refactor code while keeping tests green
4. **Never** remove tests or modify test conditions without explicit authorization

**Code Quality Requirements:**
```bash
pnpm lint:fix      # ESLint auto-fix
pnpm format:fix    # Prettier formatting
pnpm check-types   # TypeScript validation
pnpm test          # Run test suite (planned)
```

All checks must pass before considering a feature complete.

## 📦 Available Commands

```bash
# Development
pnpm dev              # Start dev server with Turbopack
pnpm build            # Production build
pnpm start            # Run production build

# Testing deployment locally
pnpm build:standalone # Build + prepare for Azure
pnpm start:standalone # Test standalone server

# Code quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix lint issues
pnpm format           # Check formatting
pnpm format:fix       # Fix formatting
pnpm check-types      # TypeScript type check

# Dependencies
pnpm bump-deps        # Update to @latest (major/minor)
pnpm bump-deps-minor  # Safe minor updates only
pnpm bump-ui          # Update shadcn components
```

## 🤝 Contributing

This is a personal project, but suggestions and bug reports are welcome via GitHub Issues.

**Development Principles:**
- All new features require tests (TDD)
- Follow existing code style (ESLint + Prettier)
- Update documentation for new features
- Test on multiple devices (desktop, tablet, mobile)

## 📄 License

[To be determined]

## 🙏 Acknowledgments

Inspired by commercial products like Skylight Calendar, but built to be:
- **Free** (no subscriptions)
- **Private** (self-hosted)
- **Open** (customizable)
- **Integrated** (works with your smart home)

## 🗺️ Project Roadmap

A comprehensive plan for feature development. All features will be implemented using **Test-Driven Development (TDD)**. Implementation order is flexible based on priorities and dependencies.

### Foundation & Infrastructure

**Authentication & Data Storage**
- [ ] [Server-Side Authentication](/.claude/plans/server-side-auth.md) - NextAuth.js with Google OAuth, PostgreSQL user accounts
- [ ] [Modular Sync Architecture](/.claude/plans/modular-sync-architecture.md) ⭐ - PostgreSQL as primary data store, optional Google Calendar/Tasks sync modules

**Current Status**
- [x] Next.js 16 setup with TypeScript
- [x] Google Calendar integration (client-side, temporary)
- [x] Application Insights logging
- [x] Azure deployment pipeline

### Core Family Features

**Multi-User & Profiles**
- [ ] [Multi-Profile Family Support](/.claude/plans/multi-profile-family-support.md) - Individual profiles, multiple admins, PIN security, profile switcher
- [ ] [User Settings Page](/.claude/plans/user-settings-page.md) - Profile management, display preferences, system configuration

**Task Management & Gamification**
- [ ] [Google Tasks Integration](/.claude/plans/google-tasks-todo-list.md) - Local task storage with optional Google Tasks sync
- [ ] [New Task Modal](/.claude/plans/new-task-modal.md) - Quick task creation with profile assignment and point values
- [ ] [Reward Point System](/.claude/plans/reward-point-system.md) - Gamification, leaderboards, streaks, configurable rewards

### Enhanced Calendar Features

**Visualization & Rotation**
- [ ] [Analog Clock Calendar](/.claude/plans/analog-clock-calendar.md) - Circular time visualization with event arcs
- [ ] [Screen Rotation Scheduler](/.claude/plans/screen-rotation-scheduler.md) - Auto-rotate between calendar, tasks, photos, recipes

**Meal Planning**
- [ ] [Meal Planning System](/.claude/plans/meal-planning.md) - Weekly meal grid, meal library, grocery list generation
- [ ] [Recipe Display Component](/.claude/plans/recipe-display-component.md) - Zoom pagination for wall display, cooking timer integration

### Smart Home Integration

**Local & Privacy-First**
- [ ] [Face Recognition Profile Switching](/.claude/plans/face-recognition-profile-switching.md) - Frigate NVR integration, on-demand camera activation, PIN fallback
- [ ] [Voice Integration](/.claude/plans/voice-integration.md) - Amazon Alexa Skills Kit, hands-free task management

### Polish & Scale

**Performance & Accessibility**
- [ ] Comprehensive test suite (unit, integration, E2E)
- [ ] Mobile responsive design optimization
- [ ] Accessibility improvements (WCAG 2.1 AA compliance)
- [ ] Performance optimization (Core Web Vitals)

**Extensibility**
- [ ] Multi-language support (i18n)
- [ ] Additional sync providers (Outlook, iCloud, CalDAV)
- [ ] Import/export tools (ICS, CSV, Google Takeout)
- [ ] Plugin system for custom integrations

**Documentation**
- [ ] User guide for families
- [ ] Self-hosting deployment guide
- [ ] Developer contribution guide
- [ ] API documentation for custom integrations

### Implementation Notes

**Privacy-First Migration Strategy:**

The project will follow this migration path to achieve privacy-first architecture:

1. **Current (Phase 1)**: Google Calendar/Tasks as primary data source with client-side caching
2. **Transition (Phase 2)**: Add PostgreSQL database, dual-write to both Google and PostgreSQL
3. **Migration (Phase 3)**: Switch to PostgreSQL as primary, Google becomes sync module
4. **Final (Phase 4)**: Make Google sync optional, full offline functionality

This gradual approach ensures we deliver value quickly while building toward data sovereignty.

**Feature Dependencies:**

Some features have dependencies that affect implementation order:

- **Multi-Profile Support** should be implemented before Profile Switching and Reward Points
- **Server-Side Auth** is required before Profile Support and Modular Sync
- **Task Management** should be implemented before Reward Point System
- **Meal Planning** can be developed in parallel with other features
- **Voice Integration** depends on Multi-Profile and Task Management

**Testing Requirements:**

All features must follow TDD methodology:

- Write tests before implementation (red-green-refactor)
- Unit tests for business logic
- Integration tests for API routes and database
- Component tests for UI
- E2E tests for critical user flows
- No feature is complete until all tests pass

---

**Status**: Active Development | **Target Audience**: Tech-savvy families who value privacy and customization
