# Security Considerations - Digital Wall Calendar

This document tracks security considerations, vulnerabilities, and recommendations for the digital wall calendar application.

## Current Security Posture

### Strengths

✅ **Privacy-First Design**

- No data sent to external servers (except Google Calendar API)
- All storage is local to the browser (localStorage and IndexedDB)
- No analytics or tracking added to the calendar feature
- Read-only calendar access only (`calendar.readonly` scope)
- No personal data collection beyond what's necessary for calendar display

✅ **Authentication & Authorization**

- OAuth 2.0 for authentication (industry standard)
- Proper token management with expiry handling
- Token refresh flow implemented (commit e69e5e6)
- No credentials stored in source code
- Environment variables for sensitive configuration
- Server-side token refresh endpoint with client secret protection

✅ **Secure Coding Practices**

- TypeScript strict mode prevents many common vulnerabilities
- No use of `eval()` or similar dangerous functions
- Proper error handling prevents information leakage
- Input validation where applicable
- API key restrictions recommended in documentation

✅ **Code Security**

- CodeQL security scanning passed (0 code alerts)
- ESLint security rules enforced
- No hardcoded secrets
- Dependency vulnerability scanning via GitHub

## Security Concerns & Mitigations

### 1. OAuth Token Storage in localStorage

**Concern:** OAuth access tokens and refresh tokens stored in browser localStorage

**Risk Level:** Low-Medium (for home/family use case)

**Mitigations:**

- ✅ Tokens are browser-encrypted at rest
- ✅ Read-only calendar scope limits potential damage
- ✅ Token expiry (1 hour) limits exposure window
- ✅ Refresh token rotation on refresh (security best practice)
- ⚠️ Users should be aware if device is shared
- ⚠️ Recommend dedicated device for wall display (not shared computer)

**Future Improvements:**

- Consider using IndexedDB with encryption for token storage
- Implement token encryption with Web Crypto API
- Add session timeout for inactive users
- Consider httpOnly cookies for refresh tokens (requires backend)

**Documentation:**

- Added to `docs/wall-calendar.md` privacy section
- User warning about shared devices

### 2. Client-Side Only Architecture

**Concern:** No backend server to enforce security policies

**Risk Level:** Low (acceptable trade-off for privacy)

**Rationale:**

- Privacy benefit outweighs security risk for home use
- No sensitive business logic to protect
- Read-only calendar access limits damage potential
- Target audience (families) has different threat model than enterprise

**Trade-offs:**

- ✅ Privacy: No server = no data collection
- ✅ Simplicity: Easier to deploy and maintain
- ✅ Cost: No server hosting costs
- ⚠️ Security: Client can be manipulated (but only affects local user)
- ⚠️ Features: Can't implement server-side logic (webhooks, push notifications)

**Future Considerations:**

- If moving to multi-user or enterprise use, backend will be required
- Could add optional backend for enhanced features while maintaining privacy

### 3. Next.js Version Vulnerability

**Status:** ⚠️ Action Required

**CVE:** CVE-2025-66478 in Next.js 16.0.1

**Description:** Dependency vulnerability in current Next.js version

**Impact:** Not specific to calendar feature (affects entire template)

**Recommendation:** Upgrade to patched Next.js version when available

**Tracking:**

- Monitor Next.js security advisories
- Update dependencies regularly with `pnpm bump-deps`
- Test thoroughly after upgrade

**Timeline:**

- Check for patches: Weekly
- Upgrade priority: High (when patch available)
- Testing required: Full regression test

### 4. Google Calendar API Security

**Implemented Protections:**

- ✅ Environment variables for API credentials
- ✅ OAuth 2.0 client-side flow
- ✅ Read-only scope (`calendar.readonly`)
- ✅ No API keys in source code
- ✅ API key restrictions documented
- ✅ Token refresh flow with server-side secret protection

**Recommended API Key Restrictions:**

As documented in `docs/google-calendar-setup.md`:

1. **HTTP referrer restrictions**
   - Limit to your production domain
   - Example: `https://yourapp.com/*`
   - Prevents API key theft/misuse

2. **API restrictions**
   - Restrict to Google Calendar API only
   - Prevents unauthorized API access

3. **OAuth consent screen**
   - Use internal/testing mode for private use
   - Submit for verification only if needed for public use
   - Limit to trusted test users during development

**Additional Recommendations:**

- Monitor API quota usage in Google Cloud Console
- Set up billing alerts (free tier should be sufficient)
- Review OAuth scopes periodically (ensure minimum necessary access)
- Rotate API keys if compromised

### 5. Cross-Site Scripting (XSS)

**Protection:** React's built-in XSS protection

**Status:** ✅ Protected

**Details:**

- React automatically escapes rendered content
- No use of `dangerouslySetInnerHTML`
- Event names and descriptions from Google Calendar are safely rendered
- User input is minimal (only account management, which uses OAuth)

**Monitoring:**

- ESLint rules flag dangerous patterns
- Code review for any raw HTML rendering
- Regular security audits

### 6. Cross-Site Request Forgery (CSRF)

**Status:** ✅ Mitigated (client-side only app)

**Details:**

- No state-changing server endpoints (except token refresh)
- Token refresh endpoint requires explicit POST with refresh token
- OAuth flow uses state parameter for CSRF protection (handled by Google)
- No cookies used for authentication

**Token Refresh Endpoint Protection:**

- Server-side only (client secret protected)
- Requires valid refresh token in request body
- Returns only access token (not refresh token)
- Proper error handling prevents information leakage

## Security Best Practices for Users

### Recommended Deployment Configuration

1. **Dedicated Device**
   - Use Raspberry Pi or dedicated display device
   - Avoid shared family computers
   - Lock down physical access if needed

2. **Network Security**
   - Use WPA3 or WPA2 WiFi encryption
   - Consider network isolation for display device
   - Keep device and browser updated

3. **Browser Configuration**
   - Use latest stable browser version
   - Enable automatic updates
   - Consider using Chrome/Edge in kiosk mode
   - Clear browser data if device repurposed

4. **Google Account Security**
   - Use dedicated Google accounts for calendar (optional)
   - Enable 2FA on Google accounts
   - Review Google account activity periodically
   - Use read-only calendar scope only

### Operational Security

1. **Regular Updates**
   - Keep Next.js and dependencies updated
   - Monitor for security advisories
   - Test updates in development first

2. **Credential Management**
   - Store environment variables securely in hosting platform
   - Rotate OAuth credentials if compromised
   - Limit OAuth test users to family members
   - Never commit `.env.local` to version control

3. **Monitoring**
   - Review Application Insights logs for anomalies
   - Monitor Google API quota usage
   - Set up alerts for unusual activity

## Compliance Considerations

### GDPR (if applicable)

**Data Collection:** Minimal

- ✅ No personal data sent to servers (except Google Calendar API)
- ✅ No analytics or tracking
- ✅ User controls own data (local storage)
- ✅ Right to be forgotten: User can clear browser data

**Recommendations if expanding to EU users:**

- Add privacy policy
- Document data processing activities
- Implement data export functionality
- Consider GDPR compliance for any future backend

### Accessibility (Security-Related)

- Screen reader support (helps prevent social engineering)
- Clear error messages (prevents user mistakes)
- Accessible account management (reduces support burden)

## Incident Response Plan

### If OAuth Tokens Compromised

1. **Immediate Actions:**
   - Revoke tokens in Google Cloud Console
   - Rotate OAuth client credentials
   - Clear user's localStorage
   - Force re-authentication

2. **Investigation:**
   - Review Application Insights logs
   - Check for unauthorized API access in Google Cloud Console
   - Determine scope of compromise

3. **Recovery:**
   - Deploy new OAuth credentials
   - Notify affected users
   - Document lessons learned

### If API Key Exposed

1. **Immediate Actions:**
   - Revoke exposed API key in Google Cloud Console
   - Generate new API key
   - Update environment variables
   - Deploy updated configuration

2. **Investigation:**
   - Review API usage for anomalies
   - Check billing for unexpected charges
   - Determine how key was exposed

3. **Prevention:**
   - Review API key restriction configuration
   - Audit code for other exposed secrets
   - Update security training

## Security Audit Checklist

Run this checklist before major releases:

- [ ] All dependencies updated to latest secure versions
- [ ] No high/critical security vulnerabilities in `pnpm audit`
- [ ] CodeQL scan passes with 0 alerts
- [ ] ESLint security rules pass
- [ ] No credentials in source code
- [ ] Environment variables properly configured
- [ ] OAuth scopes minimized (read-only)
- [ ] API key restrictions configured
- [ ] Documentation includes security best practices
- [ ] Error messages don't leak sensitive information
- [ ] Application Insights logging doesn't log tokens/secrets
- [ ] Browser localStorage encrypted by browser
- [ ] HTTPS enforced in production
- [ ] Token refresh flow working correctly
- [ ] Expired token handling working

## Security Contacts

- **Project Maintainer:** [Add contact info]
- **Security Issues:** [Add reporting process]
- **Google Calendar API Support:** https://developers.google.com/calendar/support

## Related Documents

- [Future Enhancements](.claude/future-enhancements.md)
- [Technical Debt](.claude/technical-debt.md)
- [PR Summary](.claude/pr-summary.md)
- [Google Calendar Setup Guide](../docs/google-calendar-setup.md)
- [Wall Calendar Guide](../docs/wall-calendar.md)
