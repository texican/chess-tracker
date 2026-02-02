# Chess Tracker

Small Google Apps Script web app to log friendly chess matches and compute session/player statistics.

## What this project does
- Provides a simple HTML form (`index.html`) that calls server functions in `code.gs` to record matches.
- Stores raw match rows in a Google Sheet (`Matches`) and derives session summaries (`Sessions`) and per-player session stats (`SessionPlayers`).

## Key files
- `code.gs` — server logic: `addRow(formData)`, `computeSessionStats(sessionId)`, `saveSessionSummary(sessionId)`, helpers for spreadsheet access.
- `index.html` — client UI that posts form data via `google.script.run`.
- `deploy.sh` — helper to push + deploy via `clasp`.
- `appsscript.json` — Apps Script configuration.

## Deployment
1. Authenticate `clasp` if needed:

```bash
clasp login
```

2. Ensure `.clasp.json` in this folder contains the correct `scriptId` (the project may already include it).
3. Deploy with:

```bash
./deploy.sh
```

Note: `deploy.sh` uses `clasp` and will push `code.gs`/`index.html`/`appsscript.json` and create/update a web deployment.

## Admin Panel

The chess tracker includes an owner-only admin panel for managing configuration without accessing Google Apps Script settings.

### Accessing the Admin Panel

**Regular Form:** `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`
**Admin Panel:** `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?admin=true`

### Authentication

- **Owner-only access:** Only the script owner can access the admin panel
- **Google OAuth:** Authentication handled automatically via Google account
- **No passwords required:** Uses Session.getEffectiveUser() for verification
- **Optional configuration:** Set `ADMIN_OWNER_EMAIL` in Script Properties to explicitly specify the admin email

### Features (MVP)

#### Configuration Tab ⚙️
- **Players Management:**
  - Add/remove/reorder players
  - Customize player colors (color picker)
  - View player emojis
- **Venues Management:**
  - Add/remove venues
  - Toggle mulligan venue settings
- **Session Settings:**
  - Adjust session gap hours (1-99)
- **Validation:**
  - Minimum 1 player and 1 venue required
  - Session gap hours must be 1-99
  - Empty player/venue names filtered out

#### Coming Soon
- **Sessions Tab** 📊 - View and manage session data with pagination
- **Data Tab** 💾 - Export data (CSV/JSON), recompute statistics
- **Analytics Tab** 📈 - Overall statistics dashboard
- **Audit Log Tab** 📋 - Track admin actions

### Usage

1. **Access admin panel** with `?admin=true` parameter
2. **Edit configuration:**
   - Modify players, venues, or session settings
   - Changes are validated in real-time
3. **Save configuration:**
   - Click "Save Configuration" button
   - Changes persist to Script Properties
   - Immediately available in the main form
4. **Reset:** Click "Reset" to reload current configuration from server

### Security

- Owner verification on every admin API call
- All admin actions logged with user email
- Input validation on server-side
- Non-owners see "Access Denied" page
- No sensitive data exposed in client

### Troubleshooting

**"Access Denied" error:**
- Verify you're logged into the correct Google account
- Ensure you own the Apps Script project
- Optional: Set `ADMIN_OWNER_EMAIL` in Script Properties

**Changes not appearing in form:**
- Hard refresh the form page (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache if needed
- Verify changes saved successfully (look for success message)

## Testing

### Automated Testing

The project includes a comprehensive automated test suite to ensure code quality and catch regressions.

#### Running Tests

1. **Open Apps Script Editor**: Visit [script.google.com](https://script.google.com) and open your chess tracker project
2. **Select Test Function**: In the function dropdown, choose either:
   - `testAll()` - Complete test battery (44 tests, ~10 seconds)
   - `quickTest()` - Fast smoke test (core functionality only)
3. **Run Tests**: Click the ▶️ Run button
4. **View Results**: Check Execution log (View → Logs or Ctrl+Enter)

#### Test Coverage

The automated tests validate:

**Configuration & Setup**
- ✅ Configuration loading from Script Properties
- ✅ Default values (players, colors, venues, session gap)
- ✅ Player color mappings (Carlos=#7c3aed, Carey=#00d4ff, Jorge=#10b981)
- ✅ Validation constants and limits

**Form Validation**
- ✅ Required field enforcement
- ✅ Player name uniqueness (white ≠ black)
- ✅ Valid winner values (White|Black|Draw)
- ✅ Time limit required for "Time Out" ending
- ✅ Field length limits (players ≤50 chars, venue ≤100 chars)

**Session Management**
- ✅ Session ID generation (UUID format)
- ✅ Session assignment logic
- ✅ Session boundary detection (time gap and venue change)

**Data Persistence**
- ✅ Successful form submission to spreadsheet
- ✅ Match data written to Matches sheet
- ✅ Session stats computed and saved
- ✅ Rate limiting (1-second cooldown between submissions)

**Error Handling**
- ✅ Structured error logging with `handleError()`
- ✅ Error message preservation
- ✅ Graceful failure modes

#### Test Data Cleanup

Tests automatically clean up after themselves:
- Test matches are removed from Matches sheet (identified by "Test match" in notes)
- Test sessions removed from Sessions sheet
- Orphaned SessionPlayers entries cleaned up

If cleanup fails, manually run `manualCleanupAllTestData()` from the Apps Script editor.

#### Test Files

- **test-suite.gs** - Server-side automated tests
- **test-cleanup.gs** - Test data cleanup utilities
- **test-client.html** - Client-side UI tests (deploy separately to test)

### Manual Testing Checklist

After code changes, verify:

**Form Submission**
- [ ] Submit valid match → success message appears
- [ ] Player dropdowns show emoji colors (🟣 Carlos, 🔵 Carey, 🟢 Jorge)
- [ ] Winner dropdown updates with correct players
- [ ] "Other" player fields appear/disappear correctly
- [ ] Time limit field required for "Time Out" ending

**Session Display**
- [ ] Current session stats display correctly
- [ ] Session analytics update after match submission
- [ ] Match history shows recent games
- [ ] Player badges show correct colors

**Edge Cases**
- [ ] Picture upload works (camera or file)
- [ ] Mulligan venue detection (creates venues list)
- [ ] Very long player/venue names are handled
- [ ] Rapid submissions blocked by rate limiting

**Browser Testing**
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Testing Best Practices

1. **Run `testAll()` after every code change** - Catches regressions immediately
2. **Check execution logs** - Logs show exactly which tests failed and why
3. **Test in multiple browsers** - GAS HTML rendering varies slightly
4. **Submit real matches** - End-to-end testing catches issues automated tests miss
5. **Review spreadsheet data** - Verify data format and calculations are correct
6. **Monitor error logs** - Check Apps Script executions for production errors

### Continuous Integration

For automated testing on every commit:

```bash
# Push code to Apps Script
clasp push

# Run tests via Clasp (requires API executable setup)
clasp run testAll
```

Note: `clasp run` requires the script to be deployed as an API executable. See [Clasp documentation](https://github.com/google/clasp) for setup.

## Spreadsheet / Data model
The app stores everything in a Google Spreadsheet whose ID is kept in Script Properties (`SPREADSHEET_ID`). If missing, the app will search Drive by name (`Friend Chess Games`) or create a new spreadsheet.

- `Matches` (one row per logged match) columns:
   - Timestamp
   - White Player
   - Black Player
   - Winner (White|Black|Draw)
   - Game Ending
   - Time Limit
   - Venue
   - Brutality (0-5)
   - Notes
   - Picture URL
   - White Mulligan (Yes/No)
   - Black Mulligan (Yes/No)
   - Session ID

- `Sessions` (one row per session) columns:
   - Session ID, Start Time, End Time, Matches, White Wins, Black Wins, Draws, Avg Brutality, Last Updated

- `SessionPlayers` (one row per session+player) columns:
   - Session ID, Player,
   - Matches, Wins, Wins as White, Wins as Black,
   - Losses, Losses as White, Losses as Black,
   - Draws, Draws as White, Draws as Black,
   - Inflicted, Suffered, Last Updated

Session data are computed from `Matches` by `computeSessionStats(sessionId)` and persisted by `saveSessionSummary(sessionId)`.

## Session behavior
- Session IDs are assigned server-side when `addRow()` runs if the client did not supply one.
- A new session starts when:
  1. The time since the last match exceeds the configured gap (default: 6 hours, configurable via `SESSION_GAP_HOURS`)
  2. OR the venue explicitly changes from the previous match (even within the time window)

## Brutality attribution
- If a match has a winner, the winner 'inflicted' the `Brutality` value; the loser 'suffered' it.
- For a draw, both players are credited as having 'suffered' the brutality value.

## Pictures
- The client can send a base64 data URI (e.g. `data:image/png;base64,...`). Server decodes and uploads to Drive and sets public sharing `ANYONE_WITH_LINK`.

## Properties & Rate limiting
- Script Properties keys used:
   - `SPREADSHEET_ID` — target spreadsheet ID
   - `lastSubmission` — timestamp used to enforce a 1 second cooldown between submissions

## Notes for maintainers
- Logging: Use `logEvent(eventName, data)` for structured logs.
- `saveSessionSummary` is called after `addRow()` but wrapped so session-summary errors do not block match logging.
- Header styling: new sheets add a header row with background `#4a90e2` and white bold text.

If you want dedicated per-player sheets (Carey/Carlos/Jorge) for faster lookups, the repo can optionally sync `SessionPlayers` into separate player sheets — this is not enabled by default.

# Chess Game Tracker - Google Apps Script Edition

![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285f4?style=flat&logo=google&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![No Dependencies](https://img.shields.io/badge/Dependencies-None-green.svg)

A Google Apps Script-optimized chess game tracker that logs your games and analyzes your performance over time. Uses proven Google Apps Script patterns for reliable deployment and data storage in Google Sheets.

## ✨ Key Features

- **♟️ Complete Game Logging**: Track opponent, result, ratings, time control, and platform
- **📊 Rating Tracking**: Monitor both your rating and opponent ratings (0-4000 range)
- **⏱️ Time Control Support**: From bullet to classical and correspondence games
- **🎯 Result Analysis**: Win/Loss/Draw tracking with visual feedback
- **📖 Opening Tracking**: Record which openings you played
- **📝 Game Notes**: Add insights and key moments from each game
- **📱 Mobile-Friendly**: Responsive design works on all devices
- **🔒 Reliable Design**: Uses only proven Google Apps Script patterns
- **📊 Direct Google Sheets Integration**: No external APIs - direct server-side sheet writing

## 🚀 Quick Start - Google Apps Script Deployment

### Prerequisites

- Google Account (for Apps Script and Sheets)

### Deployment Instructions

1. **Open Google Apps Script**:
   - Go to [script.google.com](https://script.google.com)
   - Click "New Project"

2. **Replace the Server Code**:
   - Select all default code in `Code.gs` and delete it
   - Copy entire contents of `code.gs` from this repository
   - Paste into Google Apps Script editor
   - Save (Ctrl/Cmd + S)

3. **Add the HTML File**:
   - Click "+" next to "Files" → Select "HTML"
   - Name it exactly "index" (no file extension)
   - Delete any default content
   - Copy entire contents of `index.html` from this repository
   - Paste into the HTML editor
   - Save (Ctrl/Cmd + S)

4. **Deploy as Web App**:
   - Click "Deploy" → "New deployment"
   - Click gear icon ⚙️ next to "Type" → Select "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone" (or "Anyone with Google account")
   - Click "Deploy"
   - Authorize when prompted (grant all permissions)
   - Copy the Web app URL

5. **Test the Form**:
   - Visit the deployment URL
   - Fill out and submit a test game
   - Check your Google Drive for the automatically created "Chess Game Data" spreadsheet

## 📁 Project Structure

```
chess-tracker/
├── code.gs                # Server-side Google Apps Script code (DEPLOY THIS)
├── index.html             # Complete HTML form (deploy as "index")
├── appsscript.json        # Google Apps Script configuration
├── README.md              # This file - includes deployment instructions
└── CLAUDE.md              # Developer guidance
```

## 🛠️ Development

Making changes to the form is simple:

### Direct Editing

1. **Clone the repository**:
   ```bash
   git clone https://github.com/texican/personal-web-forms.git
   cd personal-web-forms/chess-tracker
   ```

2. **Edit files directly**:
   - Modify `code.gs` for server-side changes
   - Modify `index.html` for form and styling changes
   - No build process required

3. **Test changes**:
   - Copy updated files to Google Apps Script
   - Deploy and test functionality
   - All files are ready-to-deploy

### Alternative: Google Clasp Workflow

For a more professional development experience, you can use Google Clasp:

```bash
# Install Clasp globally
npm install -g @google/clasp

# Login to your Google account
clasp login

# Create new Apps Script project
clasp create --type standalone --title "Chess Game Tracker"

# Push to Google Apps Script (files are already in correct structure)
clasp push

# Deploy as web app
clasp deploy
```

## 📋 Form Usage

### Form Fields

1. **Opponent** (required): Username or name of your opponent
2. **Result** (required): Win, Loss, or Draw with visual indicators
3. **My Rating**: Your rating before the game (0-4000)
4. **Opponent Rating**: Opponent's rating (0-4000)
5. **Time Control** (required): Bullet, Blitz, Rapid, Classical, or Correspondence
6. **Platform**: Chess.com, Lichess, Chess24, ICC, FICS, Over the Board, or Other
7. **Opening**: Opening played (e.g., Sicilian Defense, Italian Game)
8. **Notes**: Game insights, key moments, what you learned

### Data Storage

The form automatically creates/uses a Google Sheet with columns:
- Timestamp
- Opponent
- Result
- My Rating
- Opponent Rating
- Time Control
- Platform
- Opening
- Notes

## 🔧 Google Apps Script Architecture

### Reliable Design Principles

This form uses **only proven Google Apps Script patterns**:

✅ **Google Apps Script function calls** - Direct server-side function invocation  
✅ **google.script.run API** - Prevents blank page navigation issues  
✅ **Server-side Google Sheets API** - Direct sheet writing without external APIs  
✅ **Simple vanilla JavaScript** - No ES6 modules or modern APIs that fail in GAS  
✅ **Inline event handlers** - Reliable event handling in GAS sandbox  
✅ **Properties Service** - Persistent configuration storage  

### What We DON'T Use (Reliability Issues in GAS)

❌ Modern fetch() API - unreliable in GAS sandbox  
❌ Complex event listeners - often fail in GAS environment  
❌ ES6 modules - not supported in GAS HTML service  
❌ External API calls - unnecessary and unreliable  
❌ Modern JavaScript frameworks - too complex for GAS  

### Server-Side Features

- **Robust error handling** with detailed logging
- **Input validation** with length limits and required field checks  
- **Automatic spreadsheet creation** if none exists
- **Fallback spreadsheet logic** if access issues occur
- **Properties Service integration** for configuration persistence
- **Rate limiting** with 1-second cooldown using Script Properties
- **Rating validation** with 0-4000 range clamping

### Script Properties Usage

This application uses Google Apps Script's **Properties Service** for persistent storage:

#### Rate Limiting
```javascript
// Store last submission timestamp to prevent spam
PropertiesService.getScriptProperties().setProperty('lastSubmission', now.toString());
const lastSubmission = PropertiesService.getScriptProperties().getProperty('lastSubmission');
```

#### Spreadsheet ID Management
```javascript
// Store and retrieve the target spreadsheet ID
PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheetId);
let spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
```

**Properties Stored:**
- `SPREADSHEET_ID` - ID of the Google Sheet used for data storage
- `lastSubmission` - Timestamp of last form submission for rate limiting

## ⚙️ Configuration

This chess tracker is fully configurable via **Script Properties**. All player names, venues, and feature settings can be customized without modifying code.

### Script Properties Reference

Set these properties in Google Apps Script → Project Settings → Script Properties:

| Property Key | Type | Default | Example | Description |
|---|---|---|---|---|
| `SPREADSHEET_ID` | String | (auto-create) | `1abc...xyz` | Target Google Sheet ID |
| `PLAYERS` | Comma-separated | `Player 1,Player 2,Player 3` | `Alice,Bob,Carol` | Chess player names for dropdown |
| `VENUES` | Comma-separated | `Home,Park` | `Home,Work,Cafe` | Game location options |
| `MULLIGAN_VENUES` | Comma-separated | (none) | `Home,Backyard` | Venues where mulligans are allowed |
| `SESSION_GAP_HOURS` | Number | `6` | `4` | Hours between matches to start new session |

### How to Configure

1. **Open your Google Apps Script project**
2. Click **Project Settings** (⚙️ icon in left sidebar)
3. Scroll to **Script Properties** section
4. Click **Add script property** for each setting you want to customize
5. Enter the property key and value
6. Click **Save script properties**
7. Redeploy your web app for changes to take effect

### Configuration Examples

**Script Properties Reference**

All configuration is stored in **Project Settings > Script Properties** in the Apps Script editor.

| Property | Format | Example | Description |
|----------|--------|---------|-------------|
| `PLAYERS` | Comma-separated names | `Carlos,Carey,Jorge` | List of player names for dropdowns |
| `PLAYER_COLORS` | Name:HexColor pairs | `Carlos:#7c3aed,Carey:#00d4ff,Jorge:#10b981` | Hex color codes for each player |
| `PLAYER_EMOJIS` | Name:Emoji pairs | `Carlos:🟣,Carey:🔵,Jorge:🟢` | Emoji visual identifiers for each player |
| `VENUES` | Comma-separated locations | `Home,Park,Coffee Shop` | List of venue options |
| `MULLIGAN_VENUES` | Comma-separated venues | `Home,Chess Club` | Venues where mulligan tracking appears |
| `SESSION_GAP_HOURS` | Number | `6` | Hours between matches to start new session |

**Example 1: Different Players with Colors and Emojis**
```
Property: PLAYERS
Value: Alice,Bob,Charlie,Diana

Property: PLAYER_COLORS
Value: Alice:#7c3aed,Bob:#00d4ff,Charlie:#10b981,Diana:#f59e0b

Property: PLAYER_EMOJIS
Value: Alice:🟣,Bob:🔵,Charlie:🟢,Diana:🟠
```
This will populate the player dropdowns with colored emoji prefixes (🟣 Alice, 🔵 Bob, 🟢 Charlie, 🟠 Diana).

**Example 2: Custom Venues**
```
Property: VENUES
Value: Home,Coffee Shop,Chess Club,Park
```
This will show these four venues in the venue dropdown.

**Example 3: Enable Mulligan at Multiple Venues**
```
Property: MULLIGAN_VENUES
Value: Home,Chess Club
```
The mulligan section will appear when either "Home" or "Chess Club" is selected as the venue.

**Example 4: Shorter Session Gap**
```
Property: SESSION_GAP_HOURS
Value: 4
```
Matches played within 4 hours will be grouped into the same session.

### Clone-Friendly Design

This configuration system makes the chess tracker fully **clone-friendly**:
- No need to edit code files to customize for your group
- Each deployment can have different players/venues
- Easy to share with friends - they just set their own Script Properties
- All sensitive/personal data stays in your Script Properties (not in code)

### Using a Pre-existing Google Sheet

To configure the form to use your existing Google Sheet instead of creating a new one:

#### Method 1: Set Script Properties (Recommended)
1. **Get your Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/1ABC123xyz.../edit
                                    ^^^^^^^^^^^
                                    This is your Sheet ID
   ```

2. **Set the Script Property** in Google Apps Script:
   - Open your Apps Script project
   - Go to **Project Settings** (gear icon)
   - Scroll to **Script Properties**
   - Click **Add script property**
   - Property: `SPREADSHEET_ID`
   - Value: `1ABC123xyz...` (your actual Sheet ID)
   - Click **Save script property**

#### Method 2: Modify Code Default
Alternatively, edit the `DEFAULT_SPREADSHEET_ID` in `code.gs`:
```javascript
const DEFAULT_SPREADSHEET_ID = '1ABC123xyz...'; // Replace with your Sheet ID
```

#### Sheet Requirements
Your existing sheet should have these column headers (will be added automatically if missing):
- Timestamp | Opponent | Result | My Rating | Opponent Rating | Time Control | Platform | Opening | Notes

## 🔒 Security & Validation

### Client-Side Protection
- Input length limits (100 chars for opponent, 500 for notes)
- Required field validation with user feedback
- Rating validation (0-4000 range)
- Form sanitization before submission

### Server-Side Protection  
- Parameter validation in `addRow()`
- Data type checking and conversion
- Rating clamping to valid ranges
- Error logging for debugging
- Safe spreadsheet operations

## 🐛 Troubleshooting

### Common Issues

1. **Form goes to blank page**:
   - ✅ Fixed: Uses google.script.run API for seamless submission

2. **Submit button doesn't work**:
   - ✅ Fixed: Uses Google Apps Script function calls + inline handlers

3. **No data in spreadsheet**:
   - Check Google Apps Script execution logs
   - Verify deployment permissions (Execute as: Me, Access: Anyone)
   - Check your Google Drive for "Chess Game Data" spreadsheet

4. **Permission errors**:
   - Make sure Google Apps Script has Google Sheets API access
   - Redeploy and reauthorize if needed

## 🎯 Why This Approach Works

This chess tracker succeeds where others fail because it:

1. **Follows Google Apps Script limitations** instead of fighting them
2. **Uses only proven patterns** that work reliably in the GAS environment  
3. **Eliminates modern JavaScript** that breaks in GAS sandbox
4. **Provides reliable form submission** with google.script.run API
5. **Handles all edge cases** with proper error handling and fallbacks

## 📊 Analytics and Insights

With your game data in Google Sheets, you can easily:

- **Track rating progress** over time
- **Analyze win rates** by time control
- **Study opening performance** - which openings work best for you
- **Platform comparison** - performance across different chess sites
- **Opponent analysis** - track results against specific players
- **Time control preferences** - see where you perform best

## 🤝 Contributing

1. Fork the repository
2. Make changes directly to `code.gs` and/or `index.html`
3. Test deployment in Google Apps Script
4. Submit pull request

### Development Guidelines

- All changes must work in Google Apps Script environment
- Test deployments before submitting changes
- Maintain compatibility with proven GAS patterns
- Update documentation when changing functionality

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Issues**: [GitHub Issues](https://github.com/texican/personal-web-forms/issues)
- **Deployment Help**: See deployment section above for detailed instructions
- **Google Apps Script Docs**: [developers.google.com/apps-script](https://developers.google.com/apps-script)

## 🏗️ Built With

- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (GAS-compatible)
- **Backend**: Google Apps Script (V8 runtime)
- **Storage**: Google Sheets API
- **Architecture**: Simple, reliable GAS patterns
- **Deployment**: Direct file copying (no build process)

---

**Track your chess journey with reliable Google Apps Script deployment! ♟️**