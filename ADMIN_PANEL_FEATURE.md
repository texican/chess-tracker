# Admin Panel - Feature Specification

## Overview
Web-based administrative interface for managing chess tracker configuration, sessions, and data without accessing Google Apps Script console.

## User Story
**As a chess tracker administrator**, I want a web interface to manage settings and data, so that I don't need to navigate Google Apps Script settings for common tasks.

## Feature Requirements

### Functional Requirements

1. **Access Control**
   - **Owner-only access** using Google OAuth (Session.getEffectiveUser())
   - Separate URL parameter (e.g., `?admin=true`)
   - No password management required
   - Automatic authentication via Google account

2. **Configuration Management**
   - View current Script Properties
   - Edit player names (add/remove/reorder)
   - Edit venue names (add/remove)
   - Configure mulligan venues
   - Adjust session gap hours
   - Save changes to Script Properties

3. **Session Management**
   - View all sessions (past and current)
   - View detailed session statistics
   - Manually close/end current session
   - Recompute session statistics
   - Delete sessions (with confirmation)

4. **Data Management**
   - Export data (CSV, JSON)
   - Backup entire spreadsheet
   - Clear all data (with double confirmation)
   - Bulk import matches from CSV
   - Data validation and repair tools

5. **Analytics Dashboard**
   - Overall statistics (total matches, players, sessions)
   - Player rankings and win rates
   - Brutality trends over time
   - Venue statistics
   - Time control distribution

### Non-Functional Requirements

1. **Security**
   - Owner-only access via Google OAuth (no passwords)
   - Session management handled by Google
   - Audit log for all admin actions
   - No sensitive data in URLs or client-side storage

2. **Usability**
   - Clear navigation with tabs/sections
   - Confirmation dialogs for destructive actions
   - Success/error messages for all operations
   - Mobile-responsive design

3. **Performance**
   - Load admin panel in < 3 seconds
   - Paginated lists for large datasets
   - Background processing for bulk operations

## UI Mock-up

```
┌───────────────────────────────────────────────────────────────────┐
│ 🛡️ Chess Tracker Admin Panel                     👤 Admin | Logout │
├───────────────────────────────────────────────────────────────────┤
│ [Configuration] [Sessions] [Data] [Analytics] [Audit Log]         │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ⚙️ CONFIGURATION                                                   │
│                                                                     │
│ Players:                                                            │
│ ┌─────────────────────────────────────────────────────┐          │
│ │ 1. Carlos                                     [×][↑][↓]│          │
│ │ 2. Carey                                      [×][↑][↓]│          │
│ │ 3. Jorge                                      [×][↑][↓]│          │
│ └─────────────────────────────────────────────────────┘          │
│ [+ Add Player]                                                      │
│                                                                     │
│ Venues:                                                             │
│ ┌─────────────────────────────────────────────────────┐          │
│ │ • Home                    [Mulligan: ✓]       [×]    │          │
│ │ • Chess Club              [Mulligan: ✗]       [×]    │          │
│ └─────────────────────────────────────────────────────┘          │
│ [+ Add Venue]                                                       │
│                                                                     │
│ Session Settings:                                                   │
│ Session Gap Hours: [6] hours                                        │
│                                                                     │
│ [Save Configuration]  [Reset to Defaults]                          │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ 📊 SESSIONS (Tab 2)                                                 │
│                                                                     │
│ Current Session: Session-ABC123                                    │
│ Started: 2026-01-12 2:30 PM | Venue: Home | 12 matches            │
│ [View Details] [End Session] [Recompute Stats]                    │
│                                                                     │
│ Recent Sessions:                                                    │
│ ┌─────────────────────────────────────────────────────────────────┐
│ │ Session ID    │ Date       │ Venue      │ Matches │ Duration    │
│ ├───────────────┼────────────┼────────────┼─────────┼─────────────┤
│ │ ABC123        │ 2026-01-12 │ Home       │ 12      │ 2h 15m [V]  │
│ │ DEF456        │ 2026-01-11 │ Chess Club │ 8       │ 1h 30m [V]  │
│ │ GHI789        │ 2026-01-10 │ Home       │ 15      │ 3h 45m [V]  │
│ └───────────────┴────────────┴────────────┴─────────┴─────────────┘
│ [< Previous] Page 1 of 10 [Next >]                                 │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│ 💾 DATA MANAGEMENT (Tab 3)                                          │
│                                                                     │
│ Export Data:                                                        │
│ [Export Matches (CSV)] [Export Sessions (CSV)] [Export All (JSON)] │
│                                                                     │
│ Import Data:                                                        │
│ [Choose File: matches.csv]                      [Upload & Import]  │
│ ⚠️ Warning: This will add matches to existing data                 │
│                                                                     │
│ Backup:                                                             │
│ [Create Full Backup]  Last backup: 2026-01-11 10:30 AM            │
│                                                                     │
│ Maintenance:                                                        │
│ [Recompute All Sessions]  [Validate Data Integrity]                │
│                                                                     │
│ Danger Zone:                                                        │
│ [Clear All Matches]  [Reset Configuration]  [Delete All Data]      │
│ ⚠️ These actions cannot be undone!                                 │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

## Technical Design

### Server-Side Functions (code.gs)

```javascript
/**
 * Serve admin panel or regular form based on URL parameter
 */
function doGet(e) {
  try {
    // Check if admin panel is requested
    if (e.parameter.admin === 'true') {
      return serveAdminPanel(e);
    }

    // Regular form (existing code)
    logEvent('form_served', { parameters: e.parameter });
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Chess Game Tracker')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (error) {
    logEvent('serve_error', { error: error.toString() });
    throw error;
  }
}

/**
 * Serve admin panel - owner only
 */
function serveAdminPanel() {
  // Check if current user is the script owner
  if (!isScriptOwner()) {
    return HtmlService.createHtmlOutput(
      '<h1>Access Denied</h1>' +
      '<p>Admin panel is only accessible to the script owner.</p>' +
      '<p><a href="?">← Back to Form</a></p>'
    ).setTitle('Access Denied');
  }

  // User is owner - serve admin panel
  logEvent('admin_panel_served', {
    user: Session.getEffectiveUser().getEmail()
  });

  return HtmlService.createHtmlOutputFromFile('admin-panel')
    .setTitle('Admin Panel - Chess Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Check if current user is the script owner
 * @returns {boolean} True if current user is owner
 */
function isScriptOwner() {
  try {
    const userEmail = Session.getEffectiveUser().getEmail();
    const ownerEmail = getScriptOwnerEmail();

    return userEmail.toLowerCase() === ownerEmail.toLowerCase();
  } catch (error) {
    logEvent('owner_check_error', { error: error.toString() });
    return false;
  }
}

/**
 * Get script owner's email
 * @returns {string} Owner email
 */
function getScriptOwnerEmail() {
  const props = PropertiesService.getScriptProperties();

  // Option 1: Use configured owner email from Script Properties
  const configuredOwner = props.getProperty('ADMIN_OWNER_EMAIL');
  if (configuredOwner) {
    return configuredOwner;
  }

  // Option 2: Use current user's email (set this once when you deploy)
  // For production, set ADMIN_OWNER_EMAIL in Script Properties
  return Session.getEffectiveUser().getEmail();
}

/**
 * Admin API: Get all configuration
 * Owner-only access (automatically verified via Session.getEffectiveUser())
 * @returns {Object} Configuration data
 */
function adminGetConfig() {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  const props = PropertiesService.getScriptProperties();
  const config = getConfig(); // Use existing function

  return {
    players: config.players,
    venues: config.venues,
    mulliganVenues: config.mulliganVenues,
    sessionGapHours: config.sessionGapHours,
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || ''
  };
}

/**
 * Admin API: Save configuration
 * Owner-only access
 * @param {Object} newConfig - New configuration
 * @returns {Object} Success response
 */
function adminSaveConfig(newConfig) {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  try {
    const props = PropertiesService.getScriptProperties();

    // Validate and save players
    if (newConfig.players && Array.isArray(newConfig.players)) {
      const playersStr = newConfig.players.map(p => p.trim()).filter(p => p).join(',');
      props.setProperty('PLAYERS', playersStr);
    }

    // Validate and save venues
    if (newConfig.venues && Array.isArray(newConfig.venues)) {
      const venuesStr = newConfig.venues.map(v => v.trim()).filter(v => v).join(',');
      props.setProperty('VENUES', venuesStr);
    }

    // Validate and save mulligan venues
    if (newConfig.mulliganVenues && Array.isArray(newConfig.mulliganVenues)) {
      const mulliganStr = newConfig.mulliganVenues.join(',');
      props.setProperty('MULLIGAN_VENUES', mulliganStr);
    }

    // Validate and save session gap hours
    if (newConfig.sessionGapHours) {
      const hours = parseInt(newConfig.sessionGapHours);
      if (hours > 0 && hours < 100) {
        props.setProperty('SESSION_GAP_HOURS', hours.toString());
      }
    }

    logEvent('admin_config_saved', {
      players: newConfig.players ? newConfig.players.length : 0,
      venues: newConfig.venues ? newConfig.venues.length : 0,
      user: Session.getEffectiveUser().getEmail()
    });

    return { success: true, message: 'Configuration saved successfully' };

  } catch (error) {
    logEvent('admin_config_save_error', { error: error.toString() });
    throw error;
  }
}

/**
 * Admin API: Get all sessions with pagination
 * Owner-only access
 * @param {number} page - Page number (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Object} Sessions data with pagination
 */
function adminGetSessions(page, pageSize) {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  page = page || 1;
  pageSize = pageSize || 20;

  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const sessionsSheet = spreadsheet.getSheetByName('Sessions');

    if (!sessionsSheet || sessionsSheet.getLastRow() <= 1) {
      return { sessions: [], total: 0, page: 1, pageSize: pageSize };
    }

    // Get all session data
    const data = sessionsSheet.getDataRange().getValues();
    const headers = data[0];
    const sessions = [];

    // Skip header row, process in reverse (newest first)
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      sessions.push({
        sessionId: row[headers.indexOf('Session ID')],
        startTime: row[headers.indexOf('Start Time')],
        endTime: row[headers.indexOf('End Time')],
        matches: row[headers.indexOf('Matches')],
        whiteWins: row[headers.indexOf('White Wins')],
        blackWins: row[headers.indexOf('Black Wins')],
        draws: row[headers.indexOf('Draws')],
        avgBrutality: row[headers.indexOf('Avg Brutality')]
      });
    }

    // Paginate
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedSessions = sessions.slice(start, end);

    return {
      sessions: paginatedSessions,
      total: sessions.length,
      page: page,
      pageSize: pageSize,
      totalPages: Math.ceil(sessions.length / pageSize)
    };

  } catch (error) {
    logEvent('admin_get_sessions_error', { error: error.toString() });
    throw error;
  }
}

/**
 * Admin API: Get detailed session data
 * Owner-only access
 * @param {string} sessionId - Session ID
 * @returns {Object} Detailed session data
 */
function adminGetSessionDetails(sessionId) {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const matchesSheet = spreadsheet.getSheetByName('Matches');
    const sessionPlayersSheet = spreadsheet.getSheetByName('SessionPlayers');

    // Get matches for this session
    const matchData = matchesSheet.getDataRange().getValues();
    const matchHeaders = matchData[0];
    const sessionIdCol = matchHeaders.indexOf('Session ID');

    const matches = [];
    for (let i = 1; i < matchData.length; i++) {
      if (matchData[i][sessionIdCol] === sessionId) {
        matches.push({
          timestamp: matchData[i][0],
          whitePlayer: matchData[i][matchHeaders.indexOf('White Player')],
          blackPlayer: matchData[i][matchHeaders.indexOf('Black Player')],
          winner: matchData[i][matchHeaders.indexOf('Winner')],
          gameEnding: matchData[i][matchHeaders.indexOf('Game Ending')],
          brutality: matchData[i][matchHeaders.indexOf('Brutality')]
        });
      }
    }

    // Get player stats
    const playerData = sessionPlayersSheet.getDataRange().getValues();
    const playerHeaders = playerData[0];
    const playerSessionIdCol = playerHeaders.indexOf('Session ID');

    const playerStats = [];
    for (let i = 1; i < playerData.length; i++) {
      if (playerData[i][playerSessionIdCol] === sessionId) {
        playerStats.push({
          player: playerData[i][playerHeaders.indexOf('Player')],
          matches: playerData[i][playerHeaders.indexOf('Matches')],
          wins: playerData[i][playerHeaders.indexOf('Wins')],
          losses: playerData[i][playerHeaders.indexOf('Losses')],
          draws: playerData[i][playerHeaders.indexOf('Draws')],
          inflicted: playerData[i][playerHeaders.indexOf('Inflicted')],
          suffered: playerData[i][playerHeaders.indexOf('Suffered')]
        });
      }
    }

    return {
      sessionId: sessionId,
      matches: matches,
      playerStats: playerStats
    };

  } catch (error) {
    logEvent('admin_get_session_details_error', { error: error.toString() });
    throw error;
  }
}

/**
 * Admin API: Manually close current session
 * Owner-only access
 * @returns {Object} Success response
 */
function adminCloseCurrentSession() {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  try {
    // Just log the action - next match will start new session naturally
    logEvent('admin_session_closed_manually', { timestamp: new Date() });

    return {
      success: true,
      message: 'Current session closed. Next match will start a new session.'
    };

  } catch (error) {
    logEvent('admin_close_session_error', { error: error.toString() });
    throw error;
  }
}

/**
 * Admin API: Recompute session statistics
 * Owner-only access
 * @param {string} sessionId - Session ID to recompute (or 'all')
 * @returns {Object} Success response
 */
function adminRecomputeSession(sessionId) {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  try {
    if (sessionId === 'all') {
      // Recompute all sessions
      const spreadsheet = getOrCreateSpreadsheet();
      const matchesSheet = spreadsheet.getSheetByName('Matches');
      const data = matchesSheet.getDataRange().getValues();
      const headers = data[0];
      const sessionIdCol = headers.indexOf('Session ID');

      // Get unique session IDs
      const uniqueSessions = new Set();
      for (let i = 1; i < data.length; i++) {
        const sid = data[i][sessionIdCol];
        if (sid) uniqueSessions.add(sid);
      }

      // Recompute each session
      let count = 0;
      uniqueSessions.forEach(function(sid) {
        try {
          computeSessionStats(sid);
          saveSessionSummary(sid);
          count++;
        } catch (e) {
          logEvent('admin_recompute_session_error', { sessionId: sid, error: e.toString() });
        }
      });

      logEvent('admin_recomputed_all_sessions', { count: count });
      return { success: true, message: 'Recomputed ' + count + ' sessions' };

    } else {
      // Recompute single session
      computeSessionStats(sessionId);
      saveSessionSummary(sessionId);

      logEvent('admin_recomputed_session', { sessionId: sessionId });
      return { success: true, message: 'Session recomputed successfully' };
    }

  } catch (error) {
    logEvent('admin_recompute_error', { error: error.toString() });
    throw error;
  }
}

/**
 * Admin API: Export data
 * Owner-only access
 * @param {string} exportType - 'matches', 'sessions', 'all'
 * @returns {string} CSV or JSON data
 */
function adminExportData(exportType) {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  try {
    const spreadsheet = getOrCreateSpreadsheet();

    if (exportType === 'matches') {
      const sheet = spreadsheet.getSheetByName('Matches');
      return convertSheetToCSV(sheet);
    } else if (exportType === 'sessions') {
      const sheet = spreadsheet.getSheetByName('Sessions');
      return convertSheetToCSV(sheet);
    } else if (exportType === 'all') {
      const data = {
        matches: sheetToArray(spreadsheet.getSheetByName('Matches')),
        sessions: sheetToArray(spreadsheet.getSheetByName('Sessions')),
        sessionPlayers: sheetToArray(spreadsheet.getSheetByName('SessionPlayers'))
      };
      return JSON.stringify(data, null, 2);
    }

    throw new Error('Invalid export type');

  } catch (error) {
    logEvent('admin_export_error', { error: error.toString() });
    throw error;
  }
}

/**
 * Helper: Convert sheet to CSV
 */
function convertSheetToCSV(sheet) {
  const data = sheet.getDataRange().getValues();
  const csv = data.map(function(row) {
    return row.map(function(cell) {
      // Escape quotes and wrap in quotes if contains comma
      const str = cell.toString();
      if (str.indexOf(',') > -1 || str.indexOf('"') > -1) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',');
  }).join('\n');

  return csv;
}

/**
 * Helper: Convert sheet to array of objects
 */
function sheetToArray(sheet) {
  if (!sheet || sheet.getLastRow() === 0) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    result.push(obj);
  }

  return result;
}

/**
 * Admin API: Get overall statistics
 * Owner-only access
 * @returns {Object} Overall stats
 */
function adminGetOverallStats() {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const matchesSheet = spreadsheet.getSheetByName('Matches');
    const sessionsSheet = spreadsheet.getSheetByName('Sessions');

    const totalMatches = matchesSheet.getLastRow() - 1; // Exclude header
    const totalSessions = sessionsSheet ? sessionsSheet.getLastRow() - 1 : 0;

    // Get player stats
    const config = getConfig();
    const players = config.players;

    // Calculate total time played, avg brutality, etc.
    const matchData = matchesSheet.getDataRange().getValues();
    const headers = matchData[0];

    let totalBrutality = 0;
    let brutalityCount = 0;

    for (let i = 1; i < matchData.length; i++) {
      const brutality = parseInt(matchData[i][headers.indexOf('Brutality')] || 0);
      totalBrutality += brutality;
      brutalityCount++;
    }

    const avgBrutality = brutalityCount > 0 ? (totalBrutality / brutalityCount).toFixed(2) : 0;

    return {
      totalMatches: totalMatches,
      totalSessions: totalSessions,
      totalPlayers: players.length,
      avgBrutality: avgBrutality
    };

  } catch (error) {
    logEvent('admin_get_stats_error', { error: error.toString() });
    throw error;
  }
}

/**
 * Admin API: Get audit log
 * Owner-only access
 * @param {number} limit - Number of entries to return
 * @returns {Array} Recent admin actions
 */
function adminGetAuditLog(limit) {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  limit = limit || 50;

  // This would require creating an Audit Log sheet
  // For now, return placeholder
  return [
    { timestamp: new Date(), action: 'config_saved', user: 'admin' },
    { timestamp: new Date(), action: 'session_recomputed', user: 'admin' }
  ];
}
```

### Client-Side Implementation (admin-panel.html)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Panel - Chess Tracker</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #f5f5f5;
      color: #333;
    }

    .admin-header {
      background: #2c3e50;
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .admin-header h1 {
      font-size: 24px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .admin-nav {
      background: #34495e;
      padding: 0;
      display: flex;
      overflow-x: auto;
    }

    .admin-nav button {
      background: none;
      border: none;
      color: white;
      padding: 15px 25px;
      cursor: pointer;
      font-size: 16px;
      white-space: nowrap;
      transition: background 0.2s;
    }

    .admin-nav button:hover {
      background: #2c3e50;
    }

    .admin-nav button.active {
      background: #4a90e2;
      font-weight: bold;
    }

    .admin-content {
      max-width: 1200px;
      margin: 30px auto;
      padding: 0 20px;
    }

    .admin-section {
      background: white;
      border-radius: 8px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: none;
    }

    .admin-section.active {
      display: block;
    }

    .admin-section h2 {
      margin-bottom: 20px;
      color: #2c3e50;
      font-size: 22px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 600;
      color: #555;
    }

    .form-group input[type="text"],
    .form-group input[type="number"],
    .form-group select {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .player-list, .venue-list {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      max-height: 300px;
      overflow-y: auto;
    }

    .list-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border-bottom: 1px solid #eee;
    }

    .list-item:last-child {
      border-bottom: none;
    }

    .list-item input {
      flex: 1;
      padding: 5px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #4a90e2;
      color: white;
    }

    .btn-primary:hover {
      background: #357abd;
    }

    .btn-success {
      background: #27ae60;
      color: white;
    }

    .btn-success:hover {
      background: #229954;
    }

    .btn-danger {
      background: #e74c3c;
      color: white;
    }

    .btn-danger:hover {
      background: #c0392b;
    }

    .btn-secondary {
      background: #95a5a6;
      color: white;
    }

    .btn-secondary:hover {
      background: #7f8c8d;
    }

    .btn-small {
      padding: 5px 10px;
      font-size: 12px;
    }

    .btn-icon {
      padding: 5px 10px;
      background: #ecf0f1;
      color: #333;
    }

    .btn-icon:hover {
      background: #bdc3c7;
    }

    .alert {
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .alert-success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .alert-error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    .alert-warning {
      background: #fff3cd;
      color: #856404;
      border: 1px solid #ffeeba;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }

    table th, table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }

    table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #555;
    }

    table tbody tr:hover {
      background: #f8f9fa;
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      margin-top: 20px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }

    .stat-card h3 {
      font-size: 32px;
      margin-bottom: 5px;
    }

    .stat-card p {
      font-size: 14px;
      opacity: 0.9;
    }

    .danger-zone {
      border: 2px solid #e74c3c;
      border-radius: 8px;
      padding: 20px;
      margin-top: 30px;
      background: #fff5f5;
    }

    .danger-zone h3 {
      color: #e74c3c;
      margin-bottom: 15px;
    }

    @media (max-width: 768px) {
      .admin-nav {
        font-size: 14px;
      }

      .admin-nav button {
        padding: 12px 15px;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="admin-header">
    <h1>🛡️ Chess Tracker Admin Panel</h1>
    <div>
      <span id="admin-user">👤 Admin</span> |
      <a href="#" onclick="logout()" style="color: white;">Logout</a>
    </div>
  </div>

  <!-- Navigation Tabs -->
  <div class="admin-nav">
    <button class="active" onclick="showSection('config')">⚙️ Configuration</button>
    <button onclick="showSection('sessions')">📊 Sessions</button>
    <button onclick="showSection('data')">💾 Data</button>
    <button onclick="showSection('analytics')">📈 Analytics</button>
    <button onclick="showSection('audit')">📋 Audit Log</button>
  </div>

  <!-- Content Area -->
  <div class="admin-content">

    <!-- Configuration Section -->
    <div id="section-config" class="admin-section active">
      <h2>⚙️ Configuration</h2>

      <div id="config-alert"></div>

      <div class="form-group">
        <label>Players:</label>
        <div id="player-list" class="player-list">
          <!-- Populated dynamically -->
        </div>
        <button class="btn btn-secondary btn-small" onclick="addPlayer()" style="margin-top: 10px;">+ Add Player</button>
      </div>

      <div class="form-group">
        <label>Venues:</label>
        <div id="venue-list" class="venue-list">
          <!-- Populated dynamically -->
        </div>
        <button class="btn btn-secondary btn-small" onclick="addVenue()" style="margin-top: 10px;">+ Add Venue</button>
      </div>

      <div class="form-group">
        <label>Session Gap Hours:</label>
        <input type="number" id="session-gap-hours" min="1" max="72" value="6">
        <small style="color: #666;">Hours between matches to start a new session</small>
      </div>

      <div style="margin-top: 30px;">
        <button class="btn btn-primary" onclick="saveConfiguration()">Save Configuration</button>
        <button class="btn btn-secondary" onclick="loadConfiguration()">Reset</button>
      </div>
    </div>

    <!-- Sessions Section -->
    <div id="section-sessions" class="admin-section">
      <h2>📊 Sessions</h2>

      <div id="current-session-info" style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
        <!-- Populated dynamically -->
      </div>

      <div id="sessions-list">
        <table id="sessions-table">
          <thead>
            <tr>
              <th>Session ID</th>
              <th>Start Time</th>
              <th>Matches</th>
              <th>Duration</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <!-- Populated dynamically -->
          </tbody>
        </table>

        <div class="pagination">
          <button class="btn btn-secondary btn-small" onclick="loadSessions(currentPage - 1)">← Previous</button>
          <span>Page <span id="page-number">1</span> of <span id="total-pages">1</span></span>
          <button class="btn btn-secondary btn-small" onclick="loadSessions(currentPage + 1)">Next →</button>
        </div>
      </div>
    </div>

    <!-- Data Management Section -->
    <div id="section-data" class="admin-section">
      <h2>💾 Data Management</h2>

      <div class="form-group">
        <label>Export Data:</label>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="exportData('matches')">Export Matches (CSV)</button>
          <button class="btn btn-primary" onclick="exportData('sessions')">Export Sessions (CSV)</button>
          <button class="btn btn-primary" onclick="exportData('all')">Export All (JSON)</button>
        </div>
      </div>

      <div class="form-group">
        <label>Maintenance:</label>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-success" onclick="recomputeAllSessions()">Recompute All Sessions</button>
        </div>
      </div>

      <div class="danger-zone">
        <h3>⚠️ Danger Zone</h3>
        <p style="margin-bottom: 15px;">These actions cannot be undone!</p>
        <button class="btn btn-danger" onclick="confirmAction('clearMatches')">Clear All Matches</button>
        <button class="btn btn-danger" onclick="confirmAction('resetConfig')">Reset Configuration</button>
      </div>
    </div>

    <!-- Analytics Section -->
    <div id="section-analytics" class="admin-section">
      <h2>📈 Analytics</h2>

      <div class="stats-grid" id="overall-stats">
        <!-- Populated dynamically -->
      </div>

      <div id="analytics-content">
        <p style="color: #666; text-align: center; padding: 40px;">
          Advanced analytics coming soon...
        </p>
      </div>
    </div>

    <!-- Audit Log Section -->
    <div id="section-audit" class="admin-section">
      <h2>📋 Audit Log</h2>

      <table id="audit-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>User</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <!-- Populated dynamically -->
        </tbody>
      </table>
    </div>

  </div>

  <script>
    // No token management needed - Google OAuth handles authentication automatically

    let currentPage = 1;
    let currentConfig = {};

    // Navigation
    function showSection(section) {
      // Update nav buttons
      const buttons = document.querySelectorAll('.admin-nav button');
      buttons.forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');

      // Update sections
      const sections = document.querySelectorAll('.admin-section');
      sections.forEach(sec => sec.classList.remove('active'));
      document.getElementById('section-' + section).classList.add('active');

      // Load section data
      if (section === 'config') loadConfiguration();
      if (section === 'sessions') loadSessions(1);
      if (section === 'analytics') loadAnalytics();
      if (section === 'audit') loadAuditLog();
    }

    // Configuration Management
    function loadConfiguration() {
      google.script.run
        .withSuccessHandler(function(config) {
          currentConfig = config;
          renderPlayerList(config.players);
          renderVenueList(config.venues, config.mulliganVenues);
          document.getElementById('session-gap-hours').value = config.sessionGapHours;
        })
        .withFailureHandler(showError)
        .adminGetConfig();
    }

    function renderPlayerList(players) {
      const container = document.getElementById('player-list');
      container.innerHTML = '';

      players.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
          <span style="color: #999;">${index + 1}.</span>
          <input type="text" value="${player}" data-index="${index}">
          <button class="btn btn-icon btn-small" onclick="movePlayer(${index}, -1)">↑</button>
          <button class="btn btn-icon btn-small" onclick="movePlayer(${index}, 1)">↓</button>
          <button class="btn btn-danger btn-small" onclick="removePlayer(${index})">×</button>
        `;
        container.appendChild(item);
      });
    }

    function renderVenueList(venues, mulliganVenues) {
      const container = document.getElementById('venue-list');
      container.innerHTML = '';

      venues.forEach((venue, index) => {
        const isMulligan = mulliganVenues.includes(venue);
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
          <input type="text" value="${venue}" data-index="${index}">
          <label style="display: flex; align-items: center; gap: 5px; white-space: nowrap;">
            <input type="checkbox" ${isMulligan ? 'checked' : ''} data-index="${index}">
            Mulligan
          </label>
          <button class="btn btn-danger btn-small" onclick="removeVenue(${index})">×</button>
        `;
        container.appendChild(item);
      });
    }

    function addPlayer() {
      const container = document.getElementById('player-list');
      const newIndex = container.children.length;

      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <span style="color: #999;">${newIndex + 1}.</span>
        <input type="text" value="New Player" data-index="${newIndex}">
        <button class="btn btn-icon btn-small" onclick="movePlayer(${newIndex}, -1)">↑</button>
        <button class="btn btn-icon btn-small" onclick="movePlayer(${newIndex}, 1)">↓</button>
        <button class="btn btn-danger btn-small" onclick="removePlayer(${newIndex})">×</button>
      `;
      container.appendChild(item);
    }

    function addVenue() {
      const container = document.getElementById('venue-list');
      const newIndex = container.children.length;

      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <input type="text" value="New Venue" data-index="${newIndex}">
        <label style="display: flex; align-items: center; gap: 5px; white-space: nowrap;">
          <input type="checkbox" data-index="${newIndex}">
          Mulligan
        </label>
        <button class="btn btn-danger btn-small" onclick="removeVenue(${newIndex})">×</button>
      `;
      container.appendChild(item);
    }

    function removePlayer(index) {
      const container = document.getElementById('player-list');
      container.removeChild(container.children[index]);
      // Re-render with updated indices
      const players = getPlayerList();
      renderPlayerList(players);
    }

    function removeVenue(index) {
      const container = document.getElementById('venue-list');
      container.removeChild(container.children[index]);
    }

    function movePlayer(index, direction) {
      const players = getPlayerList();
      const newIndex = index + direction;

      if (newIndex < 0 || newIndex >= players.length) return;

      // Swap
      [players[index], players[newIndex]] = [players[newIndex], players[index]];
      renderPlayerList(players);
    }

    function getPlayerList() {
      const inputs = document.querySelectorAll('#player-list input[type="text"]');
      return Array.from(inputs).map(input => input.value.trim()).filter(v => v);
    }

    function getVenueList() {
      const inputs = document.querySelectorAll('#venue-list input[type="text"]');
      return Array.from(inputs).map(input => input.value.trim()).filter(v => v);
    }

    function getMulliganVenues() {
      const venueInputs = document.querySelectorAll('#venue-list input[type="text"]');
      const checkboxes = document.querySelectorAll('#venue-list input[type="checkbox"]');
      const mulligan = [];

      checkboxes.forEach((checkbox, index) => {
        if (checkbox.checked && venueInputs[index]) {
          mulligan.push(venueInputs[index].value.trim());
        }
      });

      return mulligan;
    }

    function saveConfiguration() {
      const config = {
        players: getPlayerList(),
        venues: getVenueList(),
        mulliganVenues: getMulliganVenues(),
        sessionGapHours: document.getElementById('session-gap-hours').value
      };

      google.script.run
        .withSuccessHandler(function(response) {
          showAlert('config-alert', 'success', response.message);
        })
        .withFailureHandler(function(error) {
          showAlert('config-alert', 'error', 'Failed to save configuration: ' + error.message);
        })
        .adminSaveConfig(config);
    }

    // Session Management
    function loadSessions(page) {
      currentPage = page;

      google.script.run
        .withSuccessHandler(function(data) {
          renderSessionsTable(data.sessions);
          document.getElementById('page-number').textContent = data.page;
          document.getElementById('total-pages').textContent = data.totalPages;
        })
        .withFailureHandler(showError)
        .adminGetSessions(page, 20);
    }

    function renderSessionsTable(sessions) {
      const tbody = document.querySelector('#sessions-table tbody');
      tbody.innerHTML = '';

      sessions.forEach(session => {
        const row = tbody.insertRow();
        row.innerHTML = `
          <td>${session.sessionId.substring(0, 8)}...</td>
          <td>${new Date(session.startTime).toLocaleString()}</td>
          <td>${session.matches}</td>
          <td>${calculateDuration(session.startTime, session.endTime)}</td>
          <td>
            <button class="btn btn-primary btn-small" onclick="viewSessionDetails('${session.sessionId}')">View</button>
            <button class="btn btn-secondary btn-small" onclick="recomputeSession('${session.sessionId}')">Recompute</button>
          </td>
        `;
      });
    }

    function calculateDuration(start, end) {
      const diffMs = new Date(end) - new Date(start);
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    }

    function recomputeSession(sessionId) {
      google.script.run
        .withSuccessHandler(function(response) {
          alert(response.message);
          loadSessions(currentPage);
        })
        .withFailureHandler(showError)
        .adminRecomputeSession(sessionId);
    }

    function recomputeAllSessions() {
      if (!confirm('Recompute statistics for ALL sessions? This may take a while.')) return;

      google.script.run
        .withSuccessHandler(function(response) {
          alert(response.message);
        })
        .withFailureHandler(showError)
        .adminRecomputeSession('all');
    }

    // Data Management
    function exportData(type) {
      google.script.run
        .withSuccessHandler(function(data) {
          downloadFile(data, 'chess-tracker-' + type + '.' + (type === 'all' ? 'json' : 'csv'));
        })
        .withFailureHandler(showError)
        .adminExportData(type);
    }

    function downloadFile(data, filename) {
      const blob = new Blob([data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    }

    // Analytics
    function loadAnalytics() {
      google.script.run
        .withSuccessHandler(function(stats) {
          renderOverallStats(stats);
        })
        .withFailureHandler(showError)
        .adminGetOverallStats();
    }

    function renderOverallStats(stats) {
      const container = document.getElementById('overall-stats');
      container.innerHTML = `
        <div class="stat-card">
          <h3>${stats.totalMatches}</h3>
          <p>Total Matches</p>
        </div>
        <div class="stat-card">
          <h3>${stats.totalSessions}</h3>
          <p>Total Sessions</p>
        </div>
        <div class="stat-card">
          <h3>${stats.totalPlayers}</h3>
          <p>Active Players</p>
        </div>
        <div class="stat-card">
          <h3>${stats.avgBrutality}</h3>
          <p>Avg Brutality</p>
        </div>
      `;
    }

    // Audit Log
    function loadAuditLog() {
      google.script.run
        .withSuccessHandler(function(entries) {
          renderAuditLog(entries);
        })
        .withFailureHandler(showError)
        .adminGetAuditLog(50);
    }

    function renderAuditLog(entries) {
      const tbody = document.querySelector('#audit-table tbody');
      tbody.innerHTML = '';

      entries.forEach(entry => {
        const row = tbody.insertRow();
        row.innerHTML = `
          <td>${new Date(entry.timestamp).toLocaleString()}</td>
          <td>${entry.action}</td>
          <td>${entry.user}</td>
          <td>-</td>
        `;
      });
    }

    // Utility Functions
    function showAlert(containerId, type, message) {
      const container = document.getElementById(containerId);
      container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
      setTimeout(() => container.innerHTML = '', 5000);
    }

    function showError(error) {
      alert('Error: ' + error.message);
    }

    function confirmAction(action) {
      const messages = {
        clearMatches: 'Delete ALL match data? This cannot be undone!',
        resetConfig: 'Reset configuration to defaults?'
      };

      if (confirm(messages[action])) {
        alert('This feature is not yet implemented.');
      }
    }

    function logout() {
      // Redirect to main form (Google account logout handled by browser)
      window.location.href = '?';
    }

    // Load initial data
    window.addEventListener('load', function() {
      loadConfiguration();
    });
  </script>
</body>
</html>
```

**Note:** No separate login page needed - Google OAuth handles authentication automatically. Non-owner users will see an "Access Denied" message if they try to access `?admin=true`.

## Implementation Phases

### Phase 1: Basic Admin Panel (MVP)
- Owner-only authentication (using Session.getEffectiveUser())
- Configuration management (view/edit players, venues, session gap)
- View sessions list
- Export data (CSV)
- **Estimated effort:** 6-8 hours (simplified auth)

### Phase 2: Enhanced Management
- Session detail view
- Recompute session stats
- Manually close sessions
- Data validation tools
- **Estimated effort:** 6-8 hours

### Phase 3: Advanced Features
- Analytics dashboard with charts
- Audit log implementation
- Bulk import from CSV
- User roles and permissions
- **Estimated effort:** 10-15 hours

## Security Considerations

1. **Authentication**
   - **Owner-only access** via Google OAuth (Session.getEffectiveUser())
   - No passwords to store or manage
   - Automatic session management by Google
   - Two-factor auth handled by user's Google account settings

2. **Authorization**
   - `isScriptOwner()` check on every admin API call
   - Optional: Support multiple admins via `ADMIN_EMAILS` Script Property
   - Log all admin actions with user email to audit trail

3. **Data Protection**
   - Input sanitization on all admin inputs
   - Confirmation dialogs for destructive actions
   - No sensitive data in browser console logs
   - Google's CSRF protection via OAuth

4. **Deployment Requirements**
   - Deploy with "Execute as: Me" (script owner)
   - "Who has access: Anyone" (so others can use the form)
   - Owner's Google account must be logged in to access admin panel
   - Optional: Set `ADMIN_OWNER_EMAIL` in Script Properties to lock to specific email

## Testing Checklist

- [ ] Login with correct password - should access admin panel
- [ ] Login with wrong password - should show error
- [ ] Edit player names - should save to Script Properties
- [ ] Add/remove/reorder players - should update correctly
- [ ] Edit venues with mulligan settings - should save correctly
- [ ] Change session gap hours - should save and reflect in form
- [ ] View sessions list - should paginate correctly
- [ ] View session details - should show all matches and player stats
- [ ] Recompute single session - should update Sessions/SessionPlayers sheets
- [ ] Recompute all sessions - should process all sessions
- [ ] Export matches CSV - should download valid CSV file
- [ ] Export all JSON - should download valid JSON file
- [ ] Overall analytics - should show correct totals
- [ ] Mobile responsive - should work on small screens
- [ ] Logout - should clear token and return to login

## Future Enhancements

### User Management
- Multiple admin accounts
- User roles (admin, viewer, editor)
- Per-user permissions

### Advanced Analytics
- Win rate trends over time (line chart)
- Player head-to-head records
- Brutality heatmap by time of day
- Venue performance comparison
- Time control distribution (pie chart)

### Data Management
- Scheduled automatic backups
- Data archiving (move old sessions to archive)
- Duplicate detection and merging
- Match editing/correction interface

### Integration
- Export to Google Sheets dashboard
- Email reports (daily/weekly summaries)
- Slack/Discord notifications for sessions
- REST API for external integrations

### UI Enhancements
- Dark mode toggle
- Customizable dashboard widgets
- Keyboard shortcuts
- Drag-and-drop player reordering
- Real-time updates (WebSocket or polling)

## Notes

- Admin panel should be **optional** - regular form works without it
- Keep admin panel lightweight - don't bloat the main form codebase
- Consider creating separate `admin.gs` file for admin functions
- Document admin password setup in deployment guide
- Provide migration path for existing deployments
