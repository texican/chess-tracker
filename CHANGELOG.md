# Changelog

All notable changes to the Chess Game Tracker project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-12

### Added - Configuration Externalization
- **Full Script Properties configuration system** - all hardcoded values now configurable
- `getConfig()` server function to load configuration from Script Properties
- Dynamic player dropdown population from `PLAYERS` Script Property
- Dynamic venue dropdown population from `VENUES` Script Property
- Configurable mulligan venues via `MULLIGAN_VENUES` Script Property
- Configurable session gap hours via `SESSION_GAP_HOURS` Script Property
- Client-side configuration loading on page load with fallback defaults
- Comprehensive configuration documentation in README.md

### Changed - Breaking Changes
- Player names no longer hardcoded - now loaded from Script Properties
- Venue names no longer hardcoded - now loaded from Script Properties
- Mulligan section visibility now based on configured venues
- Form validation now uses dynamic player lists from configuration
- `computeSessionStats()` now uses configured player list
- `saveSessionSummary()` now uses configured player list
- HTML player/venue dropdowns now populated dynamically

### Migration Guide
To customize for your group, set Script Properties:
1. Open Google Apps Script → Project Settings → Script Properties
2. Add properties with your values:
   - `PLAYERS` = `YourName1,YourName2,YourName3`
   - `VENUES` = `Your Venue 1,Your Venue 2`
   - `MULLIGAN_VENUES` = `Venue Where Mulligan Allowed` (optional)
   - `SESSION_GAP_HOURS` = `6` (or your preferred gap)
3. Redeploy web app

If no Script Properties are set, generic defaults will be used (Player 1, Player 2, Player 3, etc.).

### Documentation
- Updated README.md with complete configuration section
- Added Script Properties reference table
- Added configuration examples
- Updated FUTURE_WORK.md to mark Phase 2 and Phase 3 as completed
- Documented clone-friendly design benefits

## [1.0.0] - 2025-08-13

### Added
- Complete chess game tracking form with Google Apps Script backend
- Opponent name tracking with validation
- Game result selection (Win/Loss/Draw) with visual indicators
- Rating tracking for both player and opponent (0-4000 range)
- Time control selection (Bullet, Blitz, Rapid, Classical, Correspondence)
- Platform tracking (Chess.com, Lichess, Chess24, ICC, FICS, OTB, Other)
- Opening tracking with free text input
- Game notes for insights and analysis
- Automatic Google Sheets integration with "Chess Game Data" spreadsheet
- Mobile-responsive design with dark mode support
- Rate limiting with 1-second cooldown
- Comprehensive error handling and validation
- Properties Service integration for persistent configuration
- Fallback spreadsheet creation and management
- Client-side validation with floating error messages
- Visual feedback for form submission states
- Brown/orange chess-themed color scheme
- Inline CSS and JavaScript for single-file deployment
- Comprehensive deployment documentation
- Developer guidance documentation (CLAUDE.md)
- MIT License
- Google Apps Script configuration (appsscript.json)

### Technical Features
- Proven Google Apps Script patterns for maximum reliability
- Server-side input validation and sanitization
- Automatic header creation for new spreadsheets
- Structured logging for debugging and monitoring
- Cross-browser compatibility including mobile browsers
- No external dependencies - pure Google Apps Script

### Security
- Input length validation (opponent: 100 chars, notes: 500 chars)
- Rating range validation and clamping (0-4000)
- Required field validation
- XSS prevention through proper input handling
- Rate limiting to prevent spam submissions