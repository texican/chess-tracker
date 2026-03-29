# Changelog

All notable changes to the Chess Game Tracker project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.0] - 2026-03-29

### Added - Session & Match Editing
- **Edit session venue** — click edit button in session details modal to change venue for all matches in session
- **Edit match details** — click edit button on any match to modify players, winner, game ending, time limit, brutality, and notes
- `adminUpdateSession()` API — updates Sessions sheet and all matches with the session ID
- `adminUpdateMatch()` API — updates individual match row with validation and auto-recomputes session stats

### Technical
- Session data stored in `sessionsState.currentSessionData` for editing context
- Match edit forms dynamically rendered with current config (players, game endings)
- Client-side validation for player uniqueness and Time Out time limit requirement

---

## [2.6.2] - 2026-03-29

### Fixed
- Beta tag superscript positioning (inline-block with relative position)

## [2.6.1] - 2026-03-29

### Fixed
- Beta tag styled as small superscript badge instead of inline block

## [2.6.0] - 2026-03-29

### Added - Beta Tag & Version Sync
- **Beta deployment indicator** — orange "Beta" tag displayed in page title on non-stable deployments (index.html + admin-panel.html)
- `isBetaDeployment()` in code.gs — compares current deployment URL against `STABLE_DEPLOYMENT_ID` Script Property
- `adminSetStableDeploymentId()` in code.gs — stores stable deployment ID in Script Properties (called by promote-stable.sh)
- **deploy.sh auto-syncs VERSION** from CHANGELOG.md → code.gs before pushing; amends the current commit if version changed
- **promote-stable.sh interactive UX** — lists deployments with stable marker, accepts version numbers (e.g. `./promote-stable.sh 150`), prompts interactively when no argument given, detects "already stable"

### Removed
- Deleted obsolete `backlog/FUTURE_WORK.md` (all items completed in v2.0.0)

## [2.5.0] - 2026-03-29

### Added - Custom Domain Redirects
- **`promote-stable.sh`** — promotes a deployment to stable, updates `.stable-deployment`, sets `LAST_STABLE_VERSION` via `clasp run`, and triggers GitHub Action to update `ct.carlosiflores.com` redirect
- **`.chess-redirect.conf.example`** — template for redirect configuration (checked in)
- **`.chess-redirect.conf`** — actual redirect config with repo/domain values (gitignored)
- `deploy.sh` now auto-triggers beta redirect update (`bct.carlosiflores.com`) after each deployment
- Two subdomains: `ct.carlosiflores.com` (stable) and `bct.carlosiflores.com` (beta) via nginx 302 redirects

### Fixed
- **deploy.sh cleanup bug** — deployments without timestamps in descriptions (e.g. @31, @33) were invisible to the cleanup regex, surviving forever while legitimate deployments got deleted. Now matches ALL deployment IDs and assigns epoch=0 to non-timestamped ones.

## [2.4.0] - 2026-03-28

### Added - Admin Sessions Tab
- **Session Management Tab** in admin panel (Phase 2 complete)
- Paginated session list with 15 sessions per page
- Session details modal with full statistics
- Color-coded results bar showing white/black/draw distribution
- Player statistics table with win percentages
- Matches list showing all games in chronological order
- Recompute Stats button for single session recalculation
- Recompute All button for batch session statistics update
- Delete Session functionality with optional match deletion

### Changed - API Standardization
- Standardized all admin session APIs to flat response structure
- `adminGetSessions()` returns `{ success, sessions, total, page, pageSize, totalPages }`
- `adminGetSessionDetails()` returns `{ success, sessionId, meta, matches, playerStats }`
- `adminRecomputeSession()` returns `{ success, message, count?, errors? }`
- `adminDeleteSession()` returns `{ success, message, deletedMatches }`
- JSON serialization for Date objects in API responses

### Fixed
- Session View button failing to load data for some sessions
- Date object serialization issues in `adminGetSessionDetails()`

---

## [2.3.0] - 2026-03-27

### Added - Live Session Stats Display
- Real-time session statistics displayed at top of form interface
- Session selector dropdown (Most Recent Session, Year to Date, past sessions)
- Color breakdown bar showing white/black/draw distribution with counts
- Player stats table with W/L/D, win percentages, and brutality stats
- Auto-refresh after form submission
- Loading/error/no-data states with user feedback

### Changed
- Migrated repo from personal-web-forms sub-repo to standalone chess-tracker repo
- Updated all documentation references to reflect new repo location

### Documentation
- Documented live session stats feature implementation
- Extracted match timeline spec to separate feature file

---

## [2.2.0] - 2026-03-21

### Added - Admin Panel Navigation
- Navigation links between admin panel and main form
- GAS templated HTML for proper navigation in iframe context

### Fixed
- Admin/form navigation using `target=_top` for GAS iframe compatibility

---

## [2.1.0] - 2026-03-13

### Added - Deployment & Stability
- **Stable deployment pinning** via `.stable-deployment` file
- `adminGetStableVersion()` and `adminSetStableVersion()` admin APIs
- Git commit hash embedded in deployment descriptions for traceability
- Clean git working tree requirement before deployment
- Automatic venue inference for multi-device session logging

### Changed
- Renamed `lastSubmission` Script Property to `LAST_SUBMISSION` (SCREAMING_SNAKE_CASE convention)
- Deploy script now requires clean git tree
- Deploy descriptions now include `git:abc1234` hash suffix

### Fixed
- Blank venue on multi-device session logging via `inferVenueFromSession()`

### Documentation
- Documented stable version management workflow
- Documented session/venue relationship and assignment logic
- Documented BackupMatches sheet column order (Backup Timestamp is last column)

---

## [2.0.1] - 2026-02-01

### Added - Admin Panel & Testing
- **Owner-only admin panel** accessible via `?admin=true` URL parameter
- Admin panel Configuration tab for managing players, venues, session settings
- Player management: add/remove/reorder players with color pickers
- Venue management: add/remove venues with mulligan toggles
- Session gap hours configuration
- `adminGetConfig()` and `adminSaveConfig()` admin APIs
- Server-side owner verification via `isScriptOwner()`
- **Comprehensive automated test suite** (44 tests in test-suite.gs)
- Test cleanup utilities in test-cleanup.gs
- Client-side test runner in test-client.html
- `testAll()` and `quickTest()` functions for test execution

### Changed
- Session stats now computed and cached in Sessions/SessionPlayers sheets
- Deploy script improved with better cleanup logic

### Documentation
- Added complete testing strategy documentation to CLAUDE.md
- Documented admin panel architecture and API functions
- Added test patterns and best practices

---

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