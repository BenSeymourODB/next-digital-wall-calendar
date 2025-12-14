# Next.js 16 Template

[![Build Next.js in standalone mode](https://github.com/rbcministries/nextjs-16-template/actions/workflows/main_nextjs-template-build.yml/badge.svg)](https://github.com/rbcministries/nextjs-16-template/actions/workflows/main_nextjs-template-build.yml)

A modern, production-ready Next.js template with TypeScript, Tailwind CSS, shadcn/ui, and essential development tools.

## Features

- **Digital Wall Calendar** - Connect multiple Google Calendars for family scheduling
- **Next.js 16** with App Router and Turbopack
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** components with slate theme
- **Framer Motion** for animations
- **next-themes** for dark mode support
- **ESLint & Prettier** with auto-formatting
- **Import sorting** configured
- **pnpm** package manager
- **Client-side Google Calendar integration** with offline caching

## Quick Start

1. Use this template to create a new repository
2. Clone your new repository
3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Start development:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Wall Calendar Setup

This template includes a fully functional digital wall calendar that connects to Google Calendar.

1. **Set up Google Calendar API credentials** - See [Google Calendar Setup Guide](./docs/google-calendar-setup.md)
2. **Configure environment variables** - Copy `.env.local.example` to `.env.local` and add your credentials
3. **Access the calendar** - Navigate to `/calendar` in your browser
4. **Connect calendars** - Click the settings icon to add Google Calendar accounts

For detailed setup instructions, usage guide, and wall display configuration, see **[Wall Calendar Documentation](./docs/wall-calendar.md)**.

## Documentation

- **[Wall Calendar Guide](./docs/wall-calendar.md)** - Complete guide for the digital wall calendar
- **[Google Calendar Setup](./docs/google-calendar-setup.md)** - Step-by-step API setup
- **[CLAUDE.md](./CLAUDE.md)** - Architecture overview, MCP setup, and development commands
- **[Application Insights](./docs/application-insights.md)** - Logging and monitoring
- **[Styling Guide](./docs/styling.md)** - ODBM color palette and Tailwind usage
