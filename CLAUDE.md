# CLAUDE.md

This file provides guidance for AI assistants when working with code in this repository.

## Project Overview

This is a Google Apps Script chess game tracker that allows users to log their chess games and analyze performance over time. The form is specifically designed to work reliably within Google Apps Script's limitations using only proven patterns.

**Documentation maintenance:** Update [CHANGELOG.md](CHANGELOG.md) for significant changes (new features, bug fixes, breaking changes).

## Architecture - GOOGLE APPS SCRIPT APPROACH

- **Google Apps Script deployment**: Designed specifically for reliable GAS deployment
- **Two-file architecture**: `code.gs` (server) + `index.html` (client)
- **Google Apps Script function calls**: Uses google.script.run API for direct server communication
- **Vanilla JavaScript only**: No ES6 modules, modern APIs, or complex frameworks
- **Server-side Google Sheets**: Direct sheet writing via SpreadsheetApp API
- **Properties Service**: Configuration persistence

## Critical Design Principles

**✅ PROVEN PATTERNS USED:**
- Google Apps Script function calls (`google.script.run.functionName()`)
- Client-server communication with success/failure handlers
- Inline event handlers (`onsubmit`, `onclick`)
- Simple variable declarations (`var` not `let/const`)
- Basic DOM manipulation (`getElementById`, `innerHTML`)
- Server-side Google Sheets API calls
- CSS `clamp()` for responsive sizing (see Responsive Design section below)

**❌ PATTERNS AVOIDED (CAUSE FAILURES IN GAS):**
- Modern fetch() API (unreliable in GAS sandbox)
- Complex addEventListener patterns (fail in GAS environment)
- ES6 modules and imports (not supported in GAS HTML Service)
- Arrow functions and modern JavaScript features
- External API calls and CORS requests
- Modern JavaScript frameworks (React, Vue, etc.)

## google.script.run API Best Practices

Functions callable via `google.script.run` must follow specific patterns to ensure reliable client-server communication. See [TECH_DEBT.md](TECH_DEBT.md) for migration status.

### Server-Side Pattern (code.gs)

```javascript
function apiFunction(params) {
  // Authorization check - return error, never throw
  if (requiresAuth && !isScriptOwner()) {
    return { success: false, error: 'Unauthorized' };
  }

  // Validation - return error, never throw
  if (!params.required) {
    return { success: false, error: 'Required param missing' };
  }

  try {
    var result = doWork(params);

    // Success: flat structure with success flag
    // JSON serialize complex objects (dates, nested data)
    return JSON.parse(JSON.stringify({
      success: true,
      items: result.items,
      count: result.count
    }));

  } catch (error) {
    logEvent('api_function_error', { error: error.toString() });
    return { success: false, error: error.message || error.toString() };
  }
}
```

### Client-Side Pattern (HTML files)

```javascript
google.script.run
  .withSuccessHandler(function(result) {
    if (!result || !result.success) {
      showError(result ? result.error : 'No response from server');
      return;
    }
    // Access payload directly: result.items, result.count
    processData(result);
  })
  .withFailureHandler(function(error) {
    showError('Server error: ' + (error.message || error));
  })
  .apiFunction(params);
```

### Key Rules

1. **Never throw** - thrown errors can cause `google.script.run` to return `null`
2. **Always include `success` boolean** - client reliably checks success/failure
3. **Flat response structure** - `{ success: true, ...payload }` not nested in `data`
4. **JSON serialize complex objects** - `JSON.parse(JSON.stringify(result))` for dates
5. **Authorization returns error** - `return { success: false, error }` not `throw`
6. **Log errors server-side** - `logEvent()` before returning error response
7. **Client checks `result.success` first** - before accessing any payload fields

## Responsive Design with clamp()

The `clamp()` CSS function is used extensively for responsive, fluid sizing that scales gracefully across all screen sizes without breakpoints. This is superior to fixed pixel values or media queries for most UI elements.

**clamp() Syntax:**
```css
property: clamp(MIN, PREFERRED, MAX);
```

**Best Practices:**

1. **Use container query units for flexibility**
   - `cqw`: Container query width (percentage of container width)
   - `cqh`: Container query height (percentage of container height)
   - `vw/vh`: Viewport units for full-screen elements
   - Example: `font-size: clamp(0.8rem, 2.5cqw, 0.95rem);`

2. **Min value (first parameter)**
   - Should be the absolute minimum readable/usable size
   - Use `rem` units for maintainability (scales with user font preferences)
   - Example: `clamp(0.8rem, ...)` ensures text never gets too small

3. **Preferred value (second parameter)**
   - The "ideal" value that scales with viewport
   - Use responsive units: `cqw`, `cqh`, `vw`, `vh`
   - This is what scales the element - the min/max just constrain it
   - Example: `clamp(..., 2.5cqw, ...)` scales with 2.5% of container width

4. **Max value (third parameter)**
   - The upper limit for readability/aesthetics
   - Prevents content from becoming too large on big screens
   - Use `rem` or `em` units
   - Example: `clamp(..., 0.95rem)` caps header size

**Real Examples from Chess Tracker:**

```css
/* Header font sizing - scales smoothly, never too big or small */
h3 {
  font-size: clamp(0.8rem, 2.5cqw, 0.95rem);
}

/* Padding that adapts to container - responsive without breakpoints */
.session-header {
  padding: clamp(6px, 1.2cqh, 8px);
}

/* Gap sizing that scales with available space */
.session-header-left {
  gap: 10px;
  /* Could also use: gap: clamp(8px, 1.5cqw, 12px); */
}

/* Match count badge - maintains minimum visibility */
.stat-bar-segment.draws {
  min-width: clamp(30px, 5cqw, 60px);
}
```

**When to Use clamp():**

✅ **Font sizes** - Different devices, different accessibility preferences
✅ **Padding/margins** - Space should scale with viewport
✅ **Min-width/max-width** - Ensure readability across screen sizes
✅ **Min-height** - Keep interactive elements clickable on mobile
✅ **Gap in flexbox** - Space between items should be proportional

❌ **NOT for**: Fixed element dimensions (logos, images with aspect ratios)
❌ **NOT for**: Media query breakpoints (still use @media for layout changes)

**Performance Note:**
`clamp()` has excellent browser support (all modern browsers) and zero performance cost - it's calculated at render time just like any CSS value.

## Testing Strategy

### Automated Testing

The project uses a comprehensive automated test suite to validate functionality and prevent regressions.

**Test Files:**
- `test-suite.gs` - Server-side automated tests (44 tests)
- `test-cleanup.gs` - Automatic test data cleanup utilities
- `test-client.html` - Client-side UI and integration tests

**Running Tests:**
```javascript
// Apps Script Editor function dropdown:
testAll();      // Complete test battery (~10 seconds)
quickTest();    // Fast smoke test (configuration + server connection)
```

**Test Coverage:**

✅ **Configuration Tests** (testGetConfig, testDefaultConfig, testPlayerColors)
- Script Properties loading and parsing
- Default values: players (Carlos,Carey,Jorge), venues (Home,Park)
- Player color mappings (hex format validation)
- Configuration structure validation

✅ **Validation Tests** (testValidationLimits, testValidValues)
- VALIDATION_LIMITS constants (player name ≤50, venue ≤100, rate limit 1000ms)
- VALID_VALUES enums (winner values, game endings)
- Magic number elimination verification

✅ **Session Management** (testSessionIdGeneration, testSessionAssignment)
- UUID format generation
- Session boundary logic (time gap and venue change)
- Session assignment for new matches

✅ **Form Submission** (testAddRowValidation, testAddRowSuccess)
- Required field enforcement
- Player uniqueness (white ≠ black)
- Winner validation (White|Black|Draw only)
- Time limit required for "Time Out" ending
- Successful match submission to spreadsheet

✅ **Rate Limiting** (testRateLimiting)
- 1-second cooldown between submissions
- "Please wait before submitting again" error message

✅ **Error Handling** (testErrorHandling)
- handleError() function behavior
- Error message preservation
- Structured logging (logEvent calls)

### Test Best Practices

**When Making Code Changes:**

1. **Run tests BEFORE making changes** - Establish baseline
2. **Run tests AFTER each change** - Catch regressions immediately
3. **Check execution logs** - Tests output detailed pass/fail messages
4. **Review test data cleanup** - Ensure no test artifacts remain in spreadsheet

**Test-Driven Development:**

```javascript
// Pattern for adding new validation:
// 1. Add test first (it should fail)
function testNewValidation() {
  try {
    addRow(['invalid', 'data', ...]);
    assert(false, 'Should have thrown error');
  } catch (error) {
    assert(error.message.includes('expected message'), 'Error message check');
  }
}

// 2. Implement validation in code.gs
// 3. Run test again (should pass)
```

**Rate Limiting in Tests:**

Tests include `Utilities.sleep(1100)` delays between `addRow()` calls to avoid rate limiting. When adding new form submission tests:

```javascript
// Clear rate limit before test
PropertiesService.getScriptProperties().deleteProperty('LAST_SUBMISSION');
Utilities.sleep(1100);

// Test code here
addRow([...]);

// Wait before next addRow call
Utilities.sleep(1100);
```

**Test Data Cleanup:**

Tests automatically clean up via `cleanupTestData()` called at end of `testAll()`:
- Removes rows with "Test match" in notes column
- Removes recent test sessions (last 5 Home sessions)
- Cleans up orphaned SessionPlayers entries

For manual cleanup: `manualCleanupAllTestData()`

### What Tests DON'T Cover

**Client-Side Interactions:**
- Dropdown population with emoji prefixes
- Dynamic field showing/hiding (Other player, Time limit)
- Winner dropdown color updates
- Camera/picture upload flow
- Session display and analytics rendering
- Form validation UI feedback

**Integration Scenarios:**
- End-to-end form submission through web app
- Picture upload to Drive with sharing permissions
- Multiple concurrent users / race conditions
- Browser-specific rendering differences

**Manual Testing Required:**
- Deploy web app and submit real matches
- Test picture upload with camera/files
- Verify emoji colors display correctly (🟣🔵🟢)
- Check session stats accuracy in UI
- Test on multiple browsers (Chrome, Firefox, Safari, Mobile)

**Edge Cases to Manually Verify:**
- Player names exactly 50 characters
- Venue names exactly 100 characters
- Special characters in text fields
- Mulligan venue detection and logic
- Session boundary at exact time threshold
- Empty spreadsheet initialization (first run)

### Adding New Tests

**Test Function Pattern:**

```javascript
function testNewFeature() {
  Logger.log('\n--- Testing New Feature ---');
  
  try {
    // Arrange
    var input = 'test data';
    
    // Act
    var result = newFeatureFunction(input);
    
    // Assert
    assert(result !== null, 'Result should not be null');
    assert(result.expected === true, 'Should have expected property');
    
  } catch (error) {
    assert(false, 'Test threw unexpected error: ' + error.message);
  }
}
```

**Add to testAll():**

```javascript
function testAll() {
  Logger.log('=== STARTING AUTOMATED TESTS ===');
  testResults = { passed: 0, failed: 0, errors: [] };
  
  // ... existing tests ...
  
  // New Feature Tests
  testNewFeature();
  
  printTestResults();
  cleanupTestData();
  return testResults;
}
```

### Test Maintenance

**Keep Tests Updated:**
- When adding validation rules → add corresponding validation test
- When changing error messages → update test assertions
- When modifying configuration → update config tests
- When refactoring → ensure all tests still pass

**Test Failures as Documentation:**
- Failed test = broken functionality
- Test names should clearly describe what's being validated
- Error messages should indicate expected vs actual behavior

**Continuous Validation:**
```bash
# After every change:
./deploy.sh && echo "Run testAll() in Apps Script Editor"
```

## Form Structure

The chess game tracker captures:
- Opponent name (required text input)
- Game result (required radio buttons: Win/Loss/Draw)
- My rating and opponent rating (number inputs, 0-4000 range)
- Time control (required dropdown: Bullet, Blitz, Rapid, Classical, Correspondence)
- Platform (optional dropdown: Chess.com, Lichess, etc.)
- Opening played (optional text input)
- Game notes (optional textarea)

## Key Implementation Details

- **Google Apps Script function calls**: Direct server function invocation prevents page navigation
- **Client-side validation**: JavaScript validation with floating bubble error messages
- **Inline CSS**: All styles embedded in HTML for single-file deployment
- **Success/error handling**: Native GAS callback system for user feedback
- **Responsive design**: CSS Grid and Flexbox for mobile compatibility
- **Server-side processing**: All data handling in Google Apps Script backend
- **Rating validation**: Client and server-side validation for 0-4000 rating range

## Deployment Files

The project contains ready-to-deploy Google Apps Script files:

- `code.gs` - Server-side Google Apps Script code
- `index.html` - Complete HTML form with inline CSS and JavaScript
- `admin-panel.html` - Owner-only admin interface
- `appsscript.json` - Google Apps Script configuration
- `deploy.sh` - Automated deployment script (also triggers beta redirect update)
- `promote-stable.sh` - Promotes a deployment to stable + updates redirect
- `.chess-redirect.conf.example` - Template for redirect configuration
- `.chess-redirect.conf` - Actual redirect config (gitignored)
- `.stable-deployment` - Pinned stable deployment ID
- `README.md` - Includes complete deployment instructions

## Google Apps Script Architecture

### Server-Side (code.gs)
- `doGet()`: Serves the HTML form
- `addRow()`: Handles form data submission to spreadsheet with validation and rate limiting
- `getOrCreateSpreadsheet()`: Manages Google Sheets integration with automatic fallbacks
- `logEvent()`: Structured logging helper for debugging and monitoring

### Script Properties Usage

The application uses Google Apps Script's Properties Service for persistent configuration:

**Properties Stored:**
- `SPREADSHEET_ID`: ID of the target Google Sheet for data storage
- `LAST_SUBMISSION`: Timestamp of last form submission (rate limiting)
- `PLAYERS`: Comma-separated list of player names for dropdowns (default: Player 1,Player 2,Player 3)
- `VENUES`: Comma-separated list of venue names (default: Home,Park)
- `MULLIGAN_VENUES`: Comma-separated list of venues where mulligan is allowed (default: none)
- `SESSION_GAP_HOURS`: Number of hours between matches to start a new session (default: 6)
- `LAST_STABLE_VERSION`: Human-readable stable version label (e.g. "138"), set via admin panel or `adminSetStableVersion()`

**Naming Convention:** All Script Property keys use SCREAMING_SNAKE_CASE.

**Implementation:**
```javascript
// Rate limiting (1-second cooldown)
const LAST_SUBMISSION = PropertiesService.getScriptProperties().getProperty('LAST_SUBMISSION');
if (LAST_SUBMISSION && (now - parseInt(LAST_SUBMISSION)) < 1000) {
  throw new Error('Please wait before submitting again');
}
PropertiesService.getScriptProperties().setProperty('LAST_SUBMISSION', now.toString());

// Spreadsheet ID management with fallbacks
let spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
if (!spreadsheetId) {
  spreadsheetId = DEFAULT_SPREADSHEET_ID;
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheetId);
}
```

### Configuring Pre-existing Google Sheets

To use an existing Google Sheet instead of auto-creating one:

**Method 1: Script Properties (No Code Changes)**
```javascript
// User sets this in Apps Script Project Settings > Script Properties
// Property: SPREADSHEET_ID
// Value: 1ABC123def456ghi789... (their actual Sheet ID)

// Code automatically uses the configured Sheet ID:
let spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
```

**Method 2: Code Modification**
```javascript
// Edit this line in code.gs:
const DEFAULT_SPREADSHEET_ID = '1ABC123def456ghi789...'; // User's Sheet ID
```

**Sheet ID Extraction:**
Users can find their Sheet ID in the URL:
```
https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
```

**Automatic Header Management:**
The code automatically adds required headers if missing:
```javascript
if (sheet.getLastRow() === 0) {
  const headers = ['Timestamp', 'Opponent', 'Result', 'My Rating', 'Opponent Rating', 'Time Control', 'Platform', 'Opening', 'Notes'];
  sheet.appendRow(headers);
}
```

### Client-Side (index.html)
- Complete HTML form with inline CSS and JavaScript
- Google Apps Script function calls for form submission
- Simple vanilla JavaScript for interactivity
- Client-side validation with floating bubble feedback
- Visual result selection with radio buttons
- Two-column responsive layout for ratings and platform fields
- Live session stats display with session selector dropdown

## Live Session Stats Display

Real-time session statistics displayed at the top of the form interface.

### Server-Side Functions (code.gs)

**`getCurrentSessionData(sessionId)`** (line 1342)
- Returns session metadata, player stats, and match breakdown
- If `sessionId` is null, uses most recent session
- Falls back to `computeCurrentSessionFromMatches()` if Sessions/SessionPlayers sheets don't exist
- Returns: `{ sessionId, venue, startTime, matchCount, playerStats, whiteWins, blackWins, draws, lastMatch }`

**`getYearToDateStats()`**
- Aggregates all sessions from current year
- Returns combined player stats with session count
- Used when session selector is set to "Year to Date"

**`computeCurrentSessionFromMatches(sheet, sessionId)`** (line 1668)
- Fallback function that computes stats directly from Matches sheet
- Used when pre-computed Sessions/SessionPlayers sheets are unavailable
- Iterates all matches with matching session ID

**Helper Functions:**
- `findSessionInSheet(sheet, sessionId)` - Finds session row in Sessions sheet
- `findSessionPlayersInSheet(sheet, sessionId)` - Finds all player stats for a session

### Client-Side Implementation (index.html)

**Session Selector** (line 1760)
```html
<select id="session-selector" onchange="onSessionChange()">
  <option value="">Most Recent Session</option>
  <option value="ytd">Year to Date</option>
  <!-- Past sessions populated dynamically -->
</select>
```

**Key Functions:**
- `loadCurrentSession(event)` (line 2872) - Fetches and displays session data
- `onSessionChange()` (line 2862) - Handles session selector changes
- `populateColorBreakdown(sessionData)` (line 3020) - Renders white/black/draw bar
- `populateStatsTable(playerStats)` - Renders player stats with win percentages
- `getPercentageClass(percent)` (line 3013) - Returns CSS class for win% coloring

**Auto-refresh:** Called after form submission at line 2866

### UI Components

1. **Session Description**: "3/15 12 Matches at Home on a Saturday afternoon"
2. **Color Breakdown Bar**: Visual white/black/draw distribution with counts
3. **Player Stats Table**: Sortable by wins, shows W/L/D, win%, brutality
4. **Loading/Error/No-Data States**: Handled gracefully with user feedback

### Responsive Design

Uses CSS `clamp()` extensively:
- Stats table: 6 breakpoints (768px, 600px, 500px, 430px, 350px, 299px)
- Font sizes scale with container width
- Padding/gaps adapt to available space

## Chess-Specific Features

### Form Validation
- **Opponent name**: Required, max 100 characters
- **Game result**: Required radio button selection (Win/Loss/Draw)
- **Ratings**: Optional, validated 0-4000 range with clamping
- **Time control**: Required dropdown selection
- **Platform**: Optional dropdown with common chess platforms
- **Opening**: Optional text input for opening names
- **Notes**: Optional textarea for game insights

### Data Storage Schema
```
Chess Game Data Spreadsheet Columns:
- Timestamp: Auto-generated submission time
- Opponent: Player name/username
- Result: Win/Loss/Draw
- My Rating: Player's rating (0-4000)
- Opponent Rating: Opponent's rating (0-4000)
- Time Control: Game time format
- Platform: Where the game was played
- Opening: Chess opening played
- Notes: Game insights and analysis
```

## Deployment Process

### Using deploy.sh (preferred)
```bash
cd chess-tracker
./deploy.sh
```
- Requires a **clean git working tree** — fails with error if uncommitted changes exist
- **Auto-syncs VERSION** from CHANGELOG.md → code.gs before pushing (amends the current commit if changed)
- Embeds git commit hash in deployment description for traceability: `Deployment 2026-03-13 14:22:01 git:abc1234`
- Cleans up old deployments, always keeping: (1) most recent, (2) pinned stable
- Opens the new deployment URL in the browser automatically
- Triggers beta redirect update via GitHub Action (if `.chess-redirect.conf` exists and `gh` CLI is available)

### Stable Version Management
The deploy script reads `.stable-deployment` to determine which deployment ID to protect from cleanup.

**To pin a new stable version (preferred — use promote-stable.sh):**
```bash
./promote-stable.sh              # Promote most recent deployment
./promote-stable.sh AKfycbw...   # Promote a specific deployment ID
```
This does three things:
1. Updates `.stable-deployment` with the deployment ID
2. Sets `LAST_STABLE_VERSION` in Script Properties via `clasp run`
3. Triggers the GitHub Action to update the stable redirect URL

**Manual method (fallback):**
1. Confirm the deployment is working correctly
2. Update `.stable-deployment` with the deployment ID (e.g. `AKfycbwu...`)
3. Set `LAST_STABLE_VERSION` in the admin panel (display label only, e.g. "138")

**Stable selection logic:**
- If `.stable-deployment` contains a valid `AK...` ID that exists in GAS: use it (pinned)
- If file is missing/empty/invalid: fall back to the oldest deployment ≥8 hours older than most recent

### Version Management

**CHANGELOG.md is the single source of truth for version numbers.** The `deploy.sh` script automatically syncs the version to `code.gs` before pushing:

1. Extracts latest version from first `## [x.y.z]` heading in CHANGELOG.md
2. Compares against `const VERSION` in code.gs
3. If different: updates `VERSION`, `LAST_UPDATED`, and header comment in code.gs
4. Amends the current commit with the change (since deploy.sh requires a clean tree)

**To bump the version:** Only update CHANGELOG.md with a new `## [x.y.z] - date` entry. The deploy script handles the rest.

### Manual Deployment (fallback)
1. Copy `code.gs` to Google Apps Script project
2. Copy `index.html` as HTML file named "index"
3. Copy `admin-panel.html` as HTML file named "admin-panel"
4. Deploy as Web App with "Execute as: Me" and "Access: Anyone"
5. Test form submission and admin panel (`?admin=true`)

## Custom Domain Redirects

Two subdomains provide stable, memorable URLs for the chess tracker:
- **Stable**: `ct.carlosiflores.com` → pinned stable deployment (updated by `promote-stable.sh`)
- **Beta**: `bct.carlosiflores.com` → latest deployment (updated automatically by `deploy.sh`)

### How It Works

nginx on the Digital Ocean droplet serves 302 redirects to GAS deployment URLs. The redirect URLs are stored in snippet files on the droplet (`/etc/nginx/conf.d/`) using the `map` directive (constant variable at `http` level):

```nginx
map "" $chess_tracker_redirect_url { default "https://script.google.com/macros/s/AK.../exec"; }
```

### Configuration

**`.chess-redirect.conf`** (gitignored — actual values):
```bash
WEBSITE_REPO="owner/repo"
WORKFLOW_FILE="update-chess-redirect.yml"
STABLE_DOMAIN="ct.example.com"
BETA_DOMAIN="bct.example.com"
STABLE_SUBDOMAIN="ct"
BETA_SUBDOMAIN="bct"
```
Copy `.chess-redirect.conf.example` and fill in values. Both `deploy.sh` and `promote-stable.sh` source this file.

### Workflow
1. `./deploy.sh` → deploys to GAS, auto-updates **beta** redirect
2. Test at `bct.carlosiflores.com`
3. `./promote-stable.sh` → pins deployment as stable, updates **stable** redirect
4. Users always access `ct.carlosiflores.com` — no bookmark changes needed

### Cross-Repo Architecture
- **chess-tracker** (this repo): `deploy.sh`, `promote-stable.sh`, `.chess-redirect.conf`
- **website repo** (private): nginx config (`docs/ct.carlosiflores.com.nginx`), GitHub Action (`update-chess-redirect.yml`)
- **Droplet**: nginx server blocks + redirect URL snippet files in `/etc/nginx/conf.d/`

See [backlog/CUSTOM_DOMAIN_FEATURE.md](backlog/CUSTOM_DOMAIN_FEATURE.md) for the full spec.

## Admin Panel

The chess tracker includes an owner-only admin panel for managing configuration without accessing Google Apps Script settings directly.

### Architecture

**Files:**
- `code.gs` - Admin authentication and API functions (`serveAdminPanel`, `isScriptOwner`, `adminGetConfig`, `adminSaveConfig`)
- `admin-panel.html` - Complete standalone admin interface with inline CSS and JavaScript

**Access Control:**
- URL parameter: `?admin=true` routes to admin panel instead of regular form
- Owner verification: `isScriptOwner()` checks Session.getEffectiveUser() against script owner
- Every admin API function validates ownership before executing
- Non-owners see "Access Denied" page with link back to form

**Authentication Flow:**
```
doGet(e) checks e.parameter.admin === 'true'
  → serveAdminPanel(e) called
    → isScriptOwner() validates user
      → getScriptOwnerEmail() returns owner email (Script Properties > ActiveUser > EffectiveUser)
        → Match: Serve admin-panel.html
        → No match: Serve access denied HTML
```

### MVP Features (Configuration Tab)

**Players Management:**
- Add/remove/reorder players with drag-like up/down buttons
- Color picker for each player (hex color)
- Emoji display for each player
- Real-time UI updates
- Minimum 1 player enforced

**Venues Management:**
- Add/remove venues
- Mulligan venue checkbox for each venue
- Minimum 1 venue enforced

**Session Settings:**
- Session gap hours input (1-99 range)
- Validation and error messages

**Save/Load:**
- Load configuration from Script Properties via `adminGetConfig()`
- Save configuration to Script Properties via `adminSaveConfig()`
- Server-side validation (minimum players/venues, valid ranges)
- Success/error alert messages
- Loading states during server calls

### Admin API Functions

All functions check `isScriptOwner()` first and return error response if unauthorized.

**adminGetConfig():**
- Returns configuration object with players, playerColors, playerEmojis, venues, mulliganVenues, sessionGapHours
- Reuses existing `getConfig()` function
- No parameters

**adminSaveConfig(newConfig):**
- Validates and saves configuration to Script Properties
- Parameters: Object with players array, playerColors object, playerEmojis object, venues array, mulliganVenues array, sessionGapHours number
- Validation: Players/venues arrays trimmed and filtered, session gap 1-99, minimum 1 player and 1 venue
- Returns: `{ success: true, message: 'Configuration saved successfully' }`
- Logs all saves with user email to `logEvent()`

**adminGetStableVersion():**
- Returns `{ stableVersion }` from `LAST_STABLE_VERSION` Script Property
- No parameters

**adminSetStableVersion(version):**
- Saves a human-readable version label (e.g. "138") to `LAST_STABLE_VERSION`
- Owner-only, logged
- Note: this is display-only; the actual deployment protection uses `.stable-deployment` file

**adminGetSessions(page, pageSize):**
- Returns paginated list of sessions (newest first)
- Parameters: page (1-indexed), pageSize (default 20, max 100)
- Returns: `{ success, sessions, total, page, pageSize, totalPages }` (flat structure)
- Each session includes: sessionId, venue, startTime, endTime, matches, whiteWins, blackWins, draws, avgBrutality

**adminGetSessionDetails(sessionId):**
- Returns detailed session data including matches and player stats
- Parameters: sessionId (required)
- Returns: `{ success, sessionId, meta, matches, playerStats }` (flat structure)
- Matches include: rowIndex, timestamp, whitePlayer, blackPlayer, winner, gameEnding, timeLimit, brutality, notes, pictureUrl
- Player stats include: player, matches, wins, winsAsWhite, winsAsBlack, losses, lossesAsWhite, lossesAsBlack, draws, inflicted, suffered

**adminRecomputeSession(sessionId):**
- Recomputes session statistics from source matches
- Parameters: sessionId or 'all' for all sessions
- Calls `recomputeSessionStats()` for each session
- Returns: `{ success, message, count?, errors? }` (flat structure)

**adminDeleteSession(sessionId, deleteMatches):**
- Deletes session from Sessions and SessionPlayers sheets
- Parameters: sessionId (required), deleteMatches (boolean - if true, also deletes matches from Matches sheet)
- Returns: `{ success, message, deletedMatches }` (flat structure)

### Session Management Tab (Implemented)

The Sessions tab provides a complete interface for managing chess sessions:

**Features:**
- Paginated session list with 15 sessions per page
- Session table showing venue, date, time, matches, results bar, avg brutality
- Color-coded results bar (white/black/draws distribution)
- Session details modal with full statistics

**Session Details Modal:**
- Stats grid: Match count, white wins, black wins, draws, avg brutality
- Color breakdown bar showing result distribution
- Player statistics table: games, W/L/D, win%, inflicted/suffered brutality
- Matches list showing all games in chronological order

**Actions:**
- Refresh: Reload session list
- Recompute All: Recalculate stats for all sessions from match data
- View: Open session details modal
- Recompute Stats (in modal): Recalculate stats for single session
- Delete Session (in modal): Remove session with option to delete matches

### Future Enhancements

**Phase 2 - Data Management (Planned):**
- Data tab: Export CSV/JSON, recompute all sessions, backup tools

**Phase 3 - Analytics & Audit (Planned):**
- Analytics dashboard: Overall stats, player rankings, trends
- Audit log: Track all admin actions with timestamps

### Implementation Patterns

**Server-side (code.gs):**
- Vanilla JavaScript with `var` declarations
- Try/catch blocks around all operations
- Structured logging with `logEvent()` for all admin actions
- PropertiesService for configuration persistence

**Client-side (admin-panel.html):**
- Single HTML file with inline CSS and JavaScript
- `google.script.run` with callbacks (no async/await)
- `var` declarations, basic DOM manipulation
- Dark theme (#0a0a0a background, #7c3aed accents)
- Responsive sizing with `clamp()`
- Mobile-friendly with horizontal scroll tabs

**Security:**
- Google OAuth authentication (Session.getEffectiveUser())
- Owner check on every admin function
- Server-side input validation
- All admin actions logged with user email
- No client-side secrets

### Testing Admin Panel

**Access Control:**
- Owner can access `?admin=true`
- Non-owner sees "Access Denied" page
- Access attempts logged in execution logs

**Configuration Management:**
- Load configuration successfully
- Add/remove players and venues
- Reorder players
- Change colors
- Toggle mulligan venues
- Save configuration and verify persistence
- Validation errors shown for invalid inputs

**Integration:**
- Configuration changes immediately available in main form
- New players appear in dropdowns
- New venues appear in venue dropdown
- Session gap affects new session creation

**Session Management:**
- Sessions tab loads session list on navigation
- Pagination works correctly (prev/next buttons, page indicator)
- Session details modal opens and displays correct data
- Color bar shows accurate white/black/draw distribution
- Player stats table shows win percentages with color coding
- Matches list shows all games in session chronologically
- Recompute Stats button recalculates session statistics
- Delete Session removes session data (with/without matches)

## Session & Venue Relationship

Session assignment logic (`assignSessionIdForNewMatch`, code.gs:546):
1. **Venue change** → always starts a new session (checked first, regardless of time)
2. **Time gap** → starts a new session if elapsed time > `SESSION_GAP_HOURS`
3. Otherwise → reuses the existing session ID from the last match row

The **Sessions sheet** columns are:
`Session ID | Venue | Start Time | End Time | Matches | White Wins | Black Wins | Draws | Avg Brutality | Last Updated`

Venue is derived from the first match in the session that has a non-empty venue value (`computeSessionStats()`). All matches within a session implicitly share the same venue (enforced by assignment logic), but the Sessions sheet now caches it for direct lookup and for YTD `venueCount` stats.

**Blank venue handling:** If a match is submitted with a blank venue but an active session ID, `addRow()` calls `inferVenueFromSession()` to look up the venue from any other match in that session and fills it in before writing the row. This handles multi-device logging where venue auto-population may fail on a second device.

Edge case: if a session's venue is truly unknown (all rows blank), Sessions.Venue stays empty and can be corrected via admin backfill.

## BackupMatches Sheet

- Timestamp is the **last** column (Backup Timestamp), not the first
- Column order: Original Timestamp, White Player, Black Player, Winner, Game Ending, Time Limit, Venue, Brutality, Notes, Picture URL, White Mulligan, Black Mulligan, Session ID, **Backup Timestamp**
- Bug history: was previously prepended (first column), causing all values to shift right — fixed 2026-03-13

## Data Storage

Form data is stored in Google Sheets with automatic header creation.
Auto-creates "Chess Game Data" spreadsheet in your Google Drive.

## Troubleshooting

If form issues occur:
1. Check Google Apps Script execution logs
2. Verify deployment permissions
3. Ensure proper file names ("index" for HTML file)
4. Check browser developer console for JavaScript errors
5. Look for "Chess Game Data" spreadsheet in Google Drive

## Development Principles

- Edit `code.gs` and `index.html` directly for any changes
- Test changes by copying files to Google Apps Script and deploying
- All files are deployment-ready with no build process required
- Simple, direct development workflow

## Alternative Development Workflow

For developers preferring command-line tools, Google Clasp provides:
- Local development with full IDE support
- Command-line deployment (`clasp push`, `clasp deploy`)
- TypeScript support for enhanced development
- Better integration with Git workflows
- Automated deployment capabilities

See README.md for detailed Clasp setup instructions.