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
6. **Google Ecosystem**: Leverage existing Google Calendar and Google Tasks data

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

#### Core Family Features
- **Multi-Profile Family Support** ([plan](/.claude/plans/multi-profile-family-support.md))
  - Individual profiles for each family member (parents + kids)
  - Profile avatars (initials, photos, or emojis)
  - Multiple admin support (both parents)
  - PIN security (mandatory for admins, optional for kids)
  - Profile-specific views and family view
  - Per-profile reward points and streaks

- **Server-Side Authentication** ([plan](/.claude/plans/server-side-auth.md))
  - Google OAuth 2.0 with refresh tokens
  - Secure session management (NextAuth.js)
  - Database-backed user accounts (PostgreSQL + Prisma)
  - Multi-user support

- **Task Management** ([plan](/.claude/plans/google-tasks-todo-list.md))
  - Google Tasks API integration
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
- [Multi-Profile Family Support](/.claude/plans/multi-profile-family-support.md)
- [Server-Side Authentication](/.claude/plans/server-side-auth.md)
- [Google Tasks Integration](/.claude/plans/google-tasks-todo-list.md)
- [Reward Point System](/.claude/plans/reward-point-system.md)
- [Meal Planning](/.claude/plans/meal-planning.md)
- [Face Recognition Profile Switching](/.claude/plans/face-recognition-profile-switching.md)
- [Voice Integration](/.claude/plans/voice-integration.md)
- [And more...](/.claude/plans/)

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

## 🗺️ Roadmap

### Phase 1: Foundation (In Progress)
- [x] Next.js 16 setup with TypeScript
- [x] Google Calendar integration (client-side)
- [x] Application Insights logging
- [ ] Server-side authentication (NextAuth.js)
- [ ] Database setup (PostgreSQL + Prisma)

### Phase 2: Family Features
- [ ] Multi-profile support
- [ ] PIN security
- [ ] Google Tasks integration
- [ ] Reward point system
- [ ] Profile-based task assignment

### Phase 3: Enhanced Calendar
- [ ] Analog clock visualization
- [ ] Screen rotation scheduler
- [ ] Meal planning
- [ ] Recipe display

### Phase 4: Smart Home Integration
- [ ] Face recognition profile switching (Frigate NVR)
- [ ] Voice integration (Alexa)
- [ ] Home Assistant integration

### Phase 5: Polish & Scale
- [ ] Comprehensive test suite
- [ ] Mobile responsive design
- [ ] Accessibility improvements
- [ ] Performance optimization
- [ ] Multi-language support

---

**Status**: Active Development | **Target Audience**: Tech-savvy families who value privacy and customization
