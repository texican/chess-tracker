# CLAUDE.md

This file provides guidance for AI assistants when working with code in this repository.

## Project Overview

This is a Google Apps Script chess game tracker that allows users to log their chess games and analyze performance over time. The form is specifically designed to work reliably within Google Apps Script's limitations using only proven patterns.

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
PropertiesService.getScriptProperties().deleteProperty('lastSubmission');
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
- `README.md` - Includes complete deployment instructions
- `appsscript.json` - Google Apps Script configuration

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
- `lastSubmission`: Timestamp of last form submission (rate limiting)
- `PLAYERS`: Comma-separated list of player names for dropdowns (default: Player 1,Player 2,Player 3)
- `VENUES`: Comma-separated list of venue names (default: Home,Park)
- `MULLIGAN_VENUES`: Comma-separated list of venues where mulligan is allowed (default: none)
- `SESSION_GAP_HOURS`: Number of hours between matches to start a new session (default: 6)

**Implementation:**
```javascript
// Rate limiting (1-second cooldown)
const lastSubmission = PropertiesService.getScriptProperties().getProperty('lastSubmission');
if (lastSubmission && (now - parseInt(lastSubmission)) < 1000) {
  throw new Error('Please wait before submitting again');
}
PropertiesService.getScriptProperties().setProperty('lastSubmission', now.toString());

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

1. Copy `code.gs` to Google Apps Script project
2. Copy `index.html` to Google Apps Script as HTML file named "index"
3. Deploy as Web App with "Execute as: Me" and "Access: Anyone"
4. Test form submission - should display success message and reset form

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