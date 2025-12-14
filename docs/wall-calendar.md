# Digital Wall Calendar

A client-side digital wall calendar application built with Next.js 16 that displays events from multiple Google Calendars. Perfect for mounting on a wall display in your home to keep the family synchronized.

## Features

- 📅 **Multi-Account Support**: Connect multiple Google Calendar accounts
- 🔄 **Auto-Refresh**: Automatically syncs events at configurable intervals
- 💾 **Offline Support**: Caches events locally for offline viewing
- 🎨 **Color Coding**: Events are color-coded based on Google Calendar colors
- 📱 **Responsive Design**: Works on any screen size
- 🔒 **Privacy-First**: All data stored locally in browser (localStorage + IndexedDB)
- 🌙 **Dark Mode Ready**: Supports both light and dark themes

## Getting Started

### 1. Set Up Google Calendar API

Follow the [Google Calendar Setup Guide](./google-calendar-setup.md) to:

- Create a Google Cloud project
- Enable the Google Calendar API
- Create OAuth 2.0 credentials
- Configure your environment variables

### 2. Start the Application

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open the calendar
# Navigate to http://localhost:3000/calendar
```

### 3. Add Calendar Accounts

1. Click the **Settings** button (⚙️) in the top right
2. Click **"Add Google Calendar Account"**
3. Sign in with your Google account
4. Grant calendar read permissions
5. Your calendar events will appear automatically

### 4. Add Additional Accounts

You can connect multiple Google Calendar accounts:

- Work calendar
- Personal calendar
- Family calendar
- School calendar
- etc.

All events from all accounts will be displayed together in a unified view.

## Usage

### Navigation

- **Month Navigation**: Use the arrow buttons to move between months
- **Current Month**: The calendar always opens to the current month
- **Today Highlight**: The current day is highlighted in blue

### Settings Panel

Toggle the settings panel with the gear icon to:

- Add/remove calendar accounts
- View connected accounts
- Configure refresh intervals (future feature)

### Event Display

- Events show on their scheduled dates
- Color coding matches Google Calendar colors
- Up to 3 events shown per day
- "+X more" indicator for additional events

## Architecture

### Client-Side Only

This application runs **entirely in the browser**:

- No backend server required
- No database needed
- All data stored locally
- Privacy-focused design

### Data Storage

**localStorage** (for settings):

- Calendar account information
- User preferences
- Last sync timestamp

**IndexedDB** (for event cache):

- Cached calendar events
- Offline support
- Fast retrieval

### Google Calendar Integration

The app uses Google Calendar API v3 with:

- OAuth 2.0 authentication
- Read-only calendar access
- Event fetching for 6-month window
- Automatic token refresh

## Customization

### Display Settings

Edit `src/lib/calendar-storage.ts` to change default settings:

```typescript
const DEFAULT_SETTINGS: CalendarSettings = {
  refreshInterval: 15, // Minutes between syncs
  defaultView: "month", // Default calendar view
  theme: "auto", // Light/dark/auto
  use24HourFormat: true, // 12/24 hour time format
};
```

### Color Palette

The calendar uses the ODBM color palette (defined in `src/styles/odbm.css`):

- **Primary**: `sky-*` colors for highlights
- **Text**: `stone-*` colors for text and borders
- **Events**: Colored backgrounds based on Google Calendar colors

### Styling

All components follow the project's styling guidelines:

- Uses Tailwind CSS with custom ODBM colors
- Consistent spacing and typography
- Responsive design patterns

## Wall Display Setup

For optimal wall display:

### Hardware Recommendations

- **Display**: Any screen with HDMI input
- **Computer**:
  - Raspberry Pi (recommended)
  - Old laptop/desktop
  - Dedicated digital display device
- **Browser**: Chrome, Firefox, or Edge

### Kiosk Mode Setup

**Chrome Kiosk Mode** (Linux/Raspberry Pi):

```bash
chromium-browser --kiosk --app=http://localhost:3000/calendar
```

**Windows PowerShell**:

```powershell
Start-Process chrome.exe -ArgumentList "--kiosk --app=http://localhost:3000/calendar"
```

**macOS Terminal**:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --kiosk --app=http://localhost:3000/calendar
```

### Auto-Start on Boot

**Raspberry Pi (systemd)**:

1. Create service file:

```bash
sudo nano /etc/systemd/system/wall-calendar.service
```

2. Add content:

```ini
[Unit]
Description=Wall Calendar
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/next-digital-wall-calendar
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

3. Enable and start:

```bash
sudo systemctl enable wall-calendar
sudo systemctl start wall-calendar
```

### Screen Management

**Prevent Sleep** (Linux):

```bash
xset s off
xset -dpms
xset s noblank
```

**Auto-rotate Display** (Raspberry Pi):
Add to `/boot/config.txt`:

```
display_rotate=1  # 0=0°, 1=90°, 2=180°, 3=270°
```

## Troubleshooting

### Events Not Appearing

1. **Check Console**: Open browser dev tools (F12) and check for errors
2. **Verify Credentials**: Ensure Google Calendar API credentials are correct
3. **Check Permissions**: Verify calendar read access was granted
4. **Force Refresh**: Click settings and sign out/in again

### Authentication Issues

1. **Clear Browser Data**: Clear cookies and localStorage
2. **Check OAuth Config**: Verify redirect URIs match your domain
3. **Test Users**: Ensure your account is added as a test user
4. **Token Expiry**: Re-authenticate if you see auth errors

### Performance Issues

1. **Reduce Refresh Interval**: Increase time between syncs
2. **Clear Cache**: Use browser dev tools to clear IndexedDB
3. **Limit Calendars**: Connect fewer calendar accounts
4. **Browser Resources**: Ensure browser has sufficient memory

## Development

### Adding Features

The calendar is built with modular components:

- **CalendarProvider** (`src/components/providers/CalendarProvider.tsx`): State management
- **SimpleCalendar** (`src/components/calendar/SimpleCalendar.tsx`): Main calendar display
- **AccountManager** (`src/components/calendar/AccountManager.tsx`): Account management UI
- **google-calendar.ts** (`src/lib/google-calendar.ts`): Google Calendar API integration
- **calendar-storage.ts** (`src/lib/calendar-storage.ts`): Browser storage utilities

### Testing

```bash
# Lint code
pnpm lint

# Format code
pnpm format:fix

# Type check
pnpm check-types

# Build for production
pnpm build
```

## Privacy & Security

### Data Privacy

- ✅ No data sent to external servers (except Google Calendar API)
- ✅ All storage is local to your browser
- ✅ No analytics or tracking
- ✅ No personal data collection

### Security Considerations

- OAuth tokens stored in localStorage (encrypted by browser)
- Read-only calendar access
- No server-side processing
- Regular token refresh for security

### Best Practices

1. **Use HTTPS** in production
2. **Keep credentials private** - never commit to version control
3. **Regular updates** - keep dependencies up to date
4. **Limit permissions** - only request calendar read access
5. **Monitor access** - regularly review connected apps in Google account

## Contributing

Contributions are welcome! Please:

1. Follow the existing code style
2. Run linters and type checks
3. Test your changes thoroughly
4. Update documentation as needed

## License

This project is part of the ODBM Next.js 16 template and follows the same license.

## Support

For issues and questions:

- Check the [Google Calendar Setup Guide](./google-calendar-setup.md)
- Review the troubleshooting section above
- Check the browser console for errors
- Verify your Google Cloud configuration
