/**
 * Google Apps Script Server Code - Chess Game Tracker
 * Version: 2.0.0
 * Last Updated: 2026-01-12
 * 
 * Features:
 * - Chess game logging with result tracking
 * - Session-based analytics with configurable time gaps
 * - Player and venue management
 * - Mulligan tracking
 * - Picture uploads to Google Drive
 * - Rate limiting and input validation
 */

const VERSION = '2.0.0';
const LAST_UPDATED = '2026-01-12';

// ===== CONFIGURATION CONSTANTS =====

/**
 * Default configuration values
 * These are fallbacks if Script Properties are not set
 */
const DEFAULT_CONFIG = {
  PLAYERS: 'Player1,Player2,Player3',
  PLAYER_COLORS: 'Player1:#7c3aed,Player2:#00d4ff,Player3:#10b981',
  PLAYER_EMOJIS: 'Player1:🟣,Player2:🔵,Player3:🟢',
  VENUES: 'Home,Park',
  MULLIGAN_VENUES: '',
  SESSION_GAP_HOURS: '6'
};

/**
 * Validation limits for input sanitization
 */
const VALIDATION_LIMITS = {
  PLAYER_NAME_MAX: 50,
  VENUE_MAX: 100,
  NOTES_MAX: 500,
  RATE_LIMIT_MS: 1000,
  SESSION_GAP_DEFAULT_HOURS: 6
};

/**
 * Valid values for constrained fields
 */
const VALID_VALUES = {
  WINNER: ['White', 'Black', 'Draw'],
  GAME_ENDINGS: [
    'Checkmate', 'Resignation', 'Time Out',
    'Stalemate', 'Insufficient Material', 'Threefold Repetition',
    '50-Move Rule', 'Agreement'
  ]
};

// ===== UTILITY FUNCTIONS =====

// ===== UTILITY FUNCTIONS =====

/**
 * Structured logging helper with version tracking
 * @param {string} event - Event name (e.g., 'form_submitted', 'validation_error')
 * @param {Object} data - Event data to log
 */
function logEvent(event, data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: event,
    data: data,
    version: VERSION
  };
  Logger.log(JSON.stringify(logEntry));
}

/**
 * Standardized error handling with logging
 * @param {string} context - Context where error occurred (e.g., 'form_submission', 'picture_upload')
 * @param {Error} error - The error object
 * @param {boolean} shouldThrow - Whether to re-throw the error (default: true)
 */
function handleError(context, error, shouldThrow = true) {
  logEvent(`${context}_error`, { 
    error: error.toString(), 
    stack: error.stack 
  });
  if (shouldThrow) {
    throw error;
  }
}

// ===== CONFIGURATION MANAGEMENT =====

// ===== CONFIGURATION MANAGEMENT =====

/**
 * Get configuration from Script Properties with fallback to defaults
 * @returns {Object} Configuration object with players, venues, mulligan settings, and player colors
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();

  // Get players list (comma-separated)
  const playersStr = props.getProperty('PLAYERS') || DEFAULT_CONFIG.PLAYERS;
  const players = playersStr.split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p; });

  // Get player colors mapping from properties (format: "Player1:#7c3aed,Player2:#00d4ff,Player3:#10b981")
  const playerColorsStr = props.getProperty('PLAYER_COLORS') || DEFAULT_CONFIG.PLAYER_COLORS;
  const playerColors = {};
  playerColorsStr.split(',').forEach(function(entry) {
    const parts = entry.trim().split(':');
    if (parts.length === 2) {
      playerColors[parts[0].trim()] = parts[1].trim();
    }
  });

  // Get player emojis mapping from properties (format: "Player1:🟣,Player2:🔵,Player3:🟢")
  const playerEmojisStr = props.getProperty('PLAYER_EMOJIS') || DEFAULT_CONFIG.PLAYER_EMOJIS;
  const playerEmojis = {};
  playerEmojisStr.split(',').forEach(function(entry) {
    const parts = entry.trim().split(':');
    if (parts.length === 2) {
      playerEmojis[parts[0].trim()] = parts[1].trim();
    }
  });

  // Get venues list (comma-separated)
  const venuesStr = props.getProperty('VENUES') || DEFAULT_CONFIG.VENUES;
  const venues = venuesStr.split(',').map(function(v) { return v.trim(); }).filter(function(v) { return v; });

  // Get mulligan-enabled venues (comma-separated)
  const mulliganStr = props.getProperty('MULLIGAN_VENUES') || DEFAULT_CONFIG.MULLIGAN_VENUES;
  const mulliganVenues = mulliganStr.split(',').map(function(v) { return v.trim(); }).filter(function(v) { return v; });

  // Get session gap hours (default 6)
  const sessionGapHours = parseInt(props.getProperty('SESSION_GAP_HOURS') || DEFAULT_CONFIG.SESSION_GAP_HOURS);

  return {
    players: players,
    playerColors: playerColors,
    playerEmojis: playerEmojis,
    venues: venues,
    mulliganVenues: mulliganVenues,
    sessionGapHours: sessionGapHours
  };
}

// ===== WEB APP ENTRY POINT =====

// ===== WEB APP ENTRY POINT =====

/**
 * Serves the HTML form when web app is accessed
 * @param {Object} e - Event object with request parameters
 * @returns {HtmlOutput} The chess game logging form
 */
function doGet(e) {
  try {
    // Check if admin panel is requested
    if (e.parameter && e.parameter.admin === 'true') {
      return serveAdminPanel(e);
    }

    // Regular form
    logEvent('form_served', { parameters: e.parameter, userAgent: e.parameter.userAgent });

    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Chess Game Tracker')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

  } catch (error) {
    handleError('form_serve', error);
  }
}

// ===== ADMIN PANEL AUTHENTICATION =====

/**
 * Serve admin panel - owner only
 * @param {Object} e - Event object with request parameters
 * @returns {HtmlOutput} The admin panel or access denied page
 */
function serveAdminPanel(e) {
  // Check if current user is the script owner
  if (!isScriptOwner()) {
    logEvent('admin_access_denied', {
      user: Session.getEffectiveUser().getEmail()
    });

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
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Check if current user is the script owner
 * @returns {boolean} True if current user is owner
 */
function isScriptOwner() {
  try {
    var userEmail = Session.getEffectiveUser().getEmail();
    var ownerEmail = getScriptOwnerEmail();

    return userEmail.toLowerCase() === ownerEmail.toLowerCase();
  } catch (error) {
    logEvent('owner_check_error', { error: error.toString() });
    return false;
  }
}

/**
 * Get script owner's email
 * Priority: Script Properties > ActiveUser > EffectiveUser
 * @returns {string} Owner email address
 */
function getScriptOwnerEmail() {
  var props = PropertiesService.getScriptProperties();

  // Option 1: Configured owner email (highest priority)
  var configuredOwner = props.getProperty('ADMIN_OWNER_EMAIL');
  if (configuredOwner) {
    return configuredOwner;
  }

  // Option 2: Try to get active user
  try {
    var activeUser = Session.getActiveUser().getEmail();
    if (activeUser) return activeUser;
  } catch (e) {
    // May not be available in all contexts
  }

  // Option 3: Fall back to effective user
  return Session.getEffectiveUser().getEmail();
}

// ===== ADMIN PANEL API =====

/**
 * Admin API: Get all configuration
 * Owner-only access
 * @returns {Object} Configuration object with players, venues, colors, emojis, etc.
 */
function adminGetConfig() {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  var props = PropertiesService.getScriptProperties();
  var config = getConfig(); // Reuse existing function

  // Handle legacy color/emoji mappings (Player1, Player2, etc.) by converting to actual player names
  // If a player doesn't have a color/emoji, try to match by position (Player1 -> first player, etc.)
  var mappedColors = {};
  var mappedEmojis = {};

  for (var i = 0; i < config.players.length; i++) {
    var playerName = config.players[i];

    // Try direct lookup first
    var color = config.playerColors[playerName];
    var emoji = config.playerEmojis[playerName];

    // If not found, try legacy Player1, Player2, etc. format by position
    if (!color) {
      var legacyKey = 'Player' + (i + 1);
      color = config.playerColors[legacyKey] || '#7c3aed';
    }

    if (!emoji) {
      var legacyKey = 'Player' + (i + 1);
      emoji = config.playerEmojis[legacyKey] || '⚪';
    }

    mappedColors[playerName] = color;
    mappedEmojis[playerName] = emoji;
  }

  return {
    players: config.players,
    playerColors: mappedColors,
    playerEmojis: mappedEmojis,
    venues: config.venues,
    mulliganVenues: config.mulliganVenues,
    sessionGapHours: config.sessionGapHours,
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || ''
  };
}

/**
 * Admin API: Save configuration
 * Owner-only access
 * @param {Object} newConfig - New configuration to save
 * @returns {Object} Success response
 */
function adminSaveConfig(newConfig) {
  if (!isScriptOwner()) {
    throw new Error('Unauthorized: Admin access restricted to script owner');
  }

  try {
    var props = PropertiesService.getScriptProperties();

    // Validate and save players
    if (newConfig.players && Array.isArray(newConfig.players)) {
      var playersStr = newConfig.players
        .map(function(p) { return p.trim(); })
        .filter(function(p) { return p.length > 0; })
        .join(',');

      if (playersStr.length === 0) {
        throw new Error('At least one player is required');
      }

      props.setProperty('PLAYERS', playersStr);
    }

    // Validate and save player colors
    if (newConfig.playerColors && typeof newConfig.playerColors === 'object') {
      var colorsArray = [];
      for (var player in newConfig.playerColors) {
        colorsArray.push(player + ':' + newConfig.playerColors[player]);
      }
      props.setProperty('PLAYER_COLORS', colorsArray.join(','));
    }

    // Validate and save player emojis
    if (newConfig.playerEmojis && typeof newConfig.playerEmojis === 'object') {
      var emojisArray = [];
      for (var player in newConfig.playerEmojis) {
        emojisArray.push(player + ':' + newConfig.playerEmojis[player]);
      }
      props.setProperty('PLAYER_EMOJIS', emojisArray.join(','));
    }

    // Validate and save venues
    if (newConfig.venues && Array.isArray(newConfig.venues)) {
      var venuesStr = newConfig.venues
        .map(function(v) { return v.trim(); })
        .filter(function(v) { return v.length > 0; })
        .join(',');

      if (venuesStr.length === 0) {
        throw new Error('At least one venue is required');
      }

      props.setProperty('VENUES', venuesStr);
    }

    // Validate and save mulligan venues
    if (newConfig.mulliganVenues && Array.isArray(newConfig.mulliganVenues)) {
      var mulliganStr = newConfig.mulliganVenues.join(',');
      props.setProperty('MULLIGAN_VENUES', mulliganStr);
    }

    // Validate and save session gap hours
    if (newConfig.sessionGapHours) {
      var hours = parseInt(newConfig.sessionGapHours, 10);
      if (isNaN(hours) || hours <= 0 || hours >= 100) {
        throw new Error('Session gap hours must be between 1 and 99');
      }
      props.setProperty('SESSION_GAP_HOURS', hours.toString());
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

// ===== BACKUP MANAGEMENT =====

/**
 * Backup a match to the BackupMatches sheet
 * This creates an immutable backup record with a backup timestamp
 * @param {Array} rowData - The match data to backup
 */
function backupMatch(rowData) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    let backupSheet = spreadsheet.getSheetByName('BackupMatches');
    
    // Create BackupMatches sheet if it doesn't exist
    if (!backupSheet) {
      backupSheet = spreadsheet.insertSheet('BackupMatches');
    }
    
    // Add headers if this is a new sheet
    if (backupSheet.getLastRow() === 0) {
      const headers = [
        'Backup Timestamp',
        'Original Timestamp',
        'White Player',
        'Black Player',
        'Winner',
        'Game Ending',
        'Time Limit',
        'Venue',
        'Brutality',
        'Notes',
        'Picture URL',
        'White Mulligan',
        'Black Mulligan',
        'Session ID'
      ];
      backupSheet.appendRow(headers);
      
      // Format header row
      const headerRange = backupSheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4a90e2');
      headerRange.setFontColor('white');
    }
    
    // Prepend backup timestamp to the row data
    const backupRow = [new Date()].concat(rowData);
    backupSheet.appendRow(backupRow);
    
    logEvent('match_backed_up', { 
      sessionId: rowData[rowData.length - 1],
      originalTimestamp: rowData[0]
    });
    
  } catch (error) {
    logEvent('backup_match_error', { 
      error: error.toString(), 
      stack: error.stack 
    });
    throw error;
  }
}

// ===== SESSION MANAGEMENT =====

// ===== SESSION MANAGEMENT =====

/**
 * Retrieve the last match timestamp, session id, and venue from the sheet
 * @param {Sheet} sheet - The Matches sheet
 * @returns {Object|null} { timestamp: Date, sessionId: string, venue: string } or null if no data rows
 */
function getLastMatchInfo(sheet) {
  var lastRow = sheet.getLastRow();
  // If only header exists or sheet empty
  if (!lastRow || lastRow <= 1) return null;

  var lastValues = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Find Session ID and Venue columns if present
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var sessionCol = headers.indexOf('Session ID');
  var venueCol = headers.indexOf('Venue');

  var sessionId = '';
  if (sessionCol >= 0 && sessionCol < lastValues.length) {
    sessionId = (lastValues[sessionCol] || '').toString().trim();
  }

  var venue = '';
  if (venueCol >= 0 && venueCol < lastValues.length) {
    venue = (lastValues[venueCol] || '').toString().trim();
  }

  return {
    timestamp: lastValues[0] ? new Date(lastValues[0]) : null,
    sessionId: sessionId,
    venue: venue
  };
}

/**
 * Decide whether to start a new session based on time gap (hours) and venue change
 * Returns an existing sessionId or new UUID
 * @param {Sheet} sheet - The Matches sheet
 * @param {number} gapHours - Hours threshold for new session
 * @param {string} currentVenue - Venue for the current match
 * @returns {string} Session ID (existing or new UUID)
 */
function assignSessionIdForNewMatch(sheet, gapHours, currentVenue) {
  var info = getLastMatchInfo(sheet);
  if (!info || !info.timestamp) {
    return Utilities.getUuid();
  }

  // Check if venue changed - if so, start new session
  if (currentVenue && info.venue && currentVenue !== info.venue) {
    logEvent('new_session_venue_change', {
      previousVenue: info.venue,
      currentVenue: currentVenue
    });
    return Utilities.getUuid();
  }

  // Check time gap
  var now = new Date();
  var diffMs = now - info.timestamp;
  var diffMinutes = diffMs / 60000;
  var thresholdMinutes = gapHours * 60;
  if (diffMinutes > thresholdMinutes || !info.sessionId) {
    return Utilities.getUuid();
  }

  return info.sessionId;
}

// ===== FORM SUBMISSION & VALIDATION =====

/**
 * Processes chess game form submissions with validation and data persistence
 * @param {string[]} formData - Array: [whitePlayer, blackPlayer, winner, gameEnding, timeLimit, venue, brutality, notes, pictureData, whiteMulligan, blackMulligan]
 * @returns {Object} Success response with timestamp
 * @throws {Error} If validation fails or spreadsheet access fails
 */
function addRow(formData) {
  try {
    // Rate limiting - prevent spam submissions
    const lastSubmission = PropertiesService.getScriptProperties().getProperty('lastSubmission');
    const now = Date.now();
    if (lastSubmission && (now - parseInt(lastSubmission)) < VALIDATION_LIMITS.RATE_LIMIT_MS) {
      throw new Error('Please wait before submitting again');
    }
    PropertiesService.getScriptProperties().setProperty('lastSubmission', now.toString());
    
    logEvent('form_submission_attempt', { dataLength: formData ? formData.length : 0 });
    
    // Enhanced input validation
    if (!formData || !Array.isArray(formData) || formData.length < 8) {
      throw new Error('Invalid form data structure');
    }
    
    // Validate and sanitize inputs
    const whitePlayer = (formData[0] || '').toString().trim();
    if (!whitePlayer || whitePlayer.length === 0) {
      throw new Error('White player is required');
    }
    if (whitePlayer.length > VALIDATION_LIMITS.PLAYER_NAME_MAX) {
      throw new Error(`White player name must be less than ${VALIDATION_LIMITS.PLAYER_NAME_MAX} characters`);
    }
    
    const blackPlayer = (formData[1] || '').toString().trim();
    if (!blackPlayer || blackPlayer.length === 0) {
      throw new Error('Black player is required');
    }
    if (blackPlayer.length > VALIDATION_LIMITS.PLAYER_NAME_MAX) {
      throw new Error(`Black player name must be less than ${VALIDATION_LIMITS.PLAYER_NAME_MAX} characters`);
    }
    
    if (whitePlayer === blackPlayer) {
      throw new Error('White and black players must be different');
    }
    
    const winner = (formData[2] || '').toString().trim();
    if (!winner || !VALID_VALUES.WINNER.includes(winner)) {
      throw new Error('Valid winner is required');
    }
    
    const gameEnding = (formData[3] || '').toString().trim();
    if (!gameEnding) {
      throw new Error('Game ending is required');
    }
    
    const venue = (formData[5] || '').toString().trim();
    if (venue.length > VALIDATION_LIMITS.VENUE_MAX) {
      throw new Error(`Venue must be less than ${VALIDATION_LIMITS.VENUE_MAX} characters`);
    }
    
    // Time limit validation: required if game ending is "Time Out"
    const timeLimit = (formData[4] || '').toString().trim();
    if (gameEnding === 'Time Out' && (!timeLimit || timeLimit.length === 0)) {
      throw new Error('Time limit is required when game ends by Time Out');
    }
    
    // Open or create the spreadsheet
    const spreadsheet = getOrCreateSpreadsheet();
    let sheet = spreadsheet.getSheetByName('Matches');
    
    // Create Matches if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Matches');
    }
    
    // Add headers if this is the first row
    if (sheet.getLastRow() === 0) {
      const headers = [
        'Timestamp',
        'White Player',
        'Black Player',
        'Winner',
        'Game Ending',
        'Time Limit',
        'Venue',
        'Brutality',
        'Notes',
        'Picture URL',
        'White Mulligan',
        'Black Mulligan',
        'Session ID'
      ];
      sheet.appendRow(headers);

      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4a90e2');
      headerRange.setFontColor('white');
    }
    
    // Handle picture upload if provided
    let pictureUrl = '';
    const pictureData = formData[8] || '';
    
    if (pictureData && pictureData.startsWith('data:image/')) {
      try {
        // Extract base64 data and file extension
        const mimeMatch = pictureData.match(/data:image\/([^;]+);base64,(.+)/);
        if (mimeMatch) {
          const extension = mimeMatch[1];
          const base64Data = mimeMatch[2];
          
          // Create blob from base64
          const blob = Utilities.newBlob(
            Utilities.base64Decode(base64Data),
            `image/${extension}`,
            `chess-game-${new Date().toISOString().slice(0,10)}-${Date.now()}.${extension}`
          );
          
          // Save to Google Drive
          const file = DriveApp.createFile(blob);
          
          // Make file publicly viewable
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          // Get shareable URL
          pictureUrl = file.getUrl();
          
          logEvent('picture_uploaded', {
            fileName: file.getName(),
            fileSize: file.getSize(),
            fileId: file.getId()
          });
        }
      } catch (error) {
        handleError('picture_upload', error, false); // Log but don't throw
        // Continue without picture if upload fails
      }
    }
    
    // Determine session ID: prefer client-provided, otherwise assign based on time gap and venue change
    const clientSessionId = (formData[11] || '').toString().trim();
    let sessionId = clientSessionId;
    if (!sessionId) {
      try {
        const config = getConfig();
        sessionId = assignSessionIdForNewMatch(sheet, config.sessionGapHours, venue);
      } catch (e) {
        // If session assignment fails, create new UUID as fallback
        handleError('session_assignment', e, false);
        sessionId = Utilities.getUuid();
      }
    }
    logEvent('session_assigned', { sessionId: sessionId, clientProvided: !!clientSessionId, venue: venue });

    // Prepare sanitized row data with timestamp
    const rowData = [
      new Date(),
      whitePlayer, // Already validated
      blackPlayer, // Already validated
      winner, // Already validated
      gameEnding, // Already validated
      (formData[4] || '').toString().trim(), // Time Limit (optional)
      venue, // Already validated and sanitized
      Math.max(0, Math.min(5, parseInt(formData[6]) || 0)), // Brutality (clamped to 0-5)
      (formData[7] || '').toString().trim(),  // Notes (optional)
      pictureUrl, // Picture URL (optional)
      (formData[9] || 'No').toString().trim(), // White Mulligan (Yes/No)
      (formData[10] || 'No').toString().trim() // Black Mulligan (Yes/No)
      , sessionId
    ];
    
    sheet.appendRow(rowData);

    // Backup match to BackupMatches sheet (skip for test matches)
    const notes = (formData[7] || '').toString().trim();
    if (notes.indexOf('Test match') === -1) {
      try {
        backupMatch(rowData);
      } catch (e) {
        logEvent('backup_match_error', { error: e.toString() });
        // Non-blocking - don't fail submission if backup fails
      }
    }

    // Attempt to update session summary (non-blocking).
    try {
      saveSessionSummary(sessionId);
    } catch (e) {
      logEvent('save_session_summary_called_error', { sessionId: sessionId, error: e.toString() });
    }

    const result_obj = {
      success: true,
      message: 'Chess game logged successfully',
      timestamp: new Date().toISOString()
    };
    
    logEvent('form_submission_success', { 
      white_player: whitePlayer,
      black_player: blackPlayer,
      winner: winner,
      game_ending: gameEnding,
      venue: venue || 'Not specified',
      has_time_limit: !!timeLimit,
      brutality: rowData[7],
      session_id: sessionId
    });
    
    return result_obj;
      
  } catch (error) {
    handleError('form_submission', error, false);
    throw new Error('Failed to save chess game: ' + error.message);
  }
}

/**
 * Compute aggregate statistics for a session identified by `sessionId`.
 * Returns an object with counts and timing.
 * @param {string} sessionId
 * @returns {Object|null}
 */
function computeSessionStats(sessionId) {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  const spreadsheet = getOrCreateSpreadsheet();
  const matchesSheet = spreadsheet.getSheetByName('Matches');
  if (!matchesSheet) return null;

  const data = matchesSheet.getDataRange().getValues();
  if (data.length < 2) return { sessionId: sessionId, matches: 0 };

  const headers = data[0];
  const col = {};
  for (let i = 0; i < headers.length; i++) col[headers[i]] = i;

  if (typeof col['Session ID'] === 'undefined') return null;

  const sidCol = col['Session ID'];
  const winnerCol = col['Winner'];
  const brutalityCol = col['Brutality'];
  const tsCol = col['Timestamp'];

  let matches = 0, whiteWins = 0, blackWins = 0, draws = 0, brutalitySum = 0;
  let startTime = null, endTime = null;

  // Per-player session stats using configured players
  const config = getConfig();
  const players = config.players;
  const perPlayer = {};
  players.forEach(function(p) {
    perPlayer[p] = {
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      inflicted: 0,
      suffered: 0,
      // color breakdown
      wins_as_white: 0,
      wins_as_black: 0,
      losses_as_white: 0,
      losses_as_black: 0,
      draws_as_white: 0,
      draws_as_black: 0
    };
  });

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const sid = (row[sidCol] || '').toString();
    if (sid !== sessionId) continue;
    matches++;
    const winner = (row[winnerCol] || '').toString();
    if (winner === 'White') {
      whiteWins++;
    } else if (winner === 'Black') {
      blackWins++;
    } else if (winner === 'Draw') {
      draws++;
    }

    const b = parseInt(row[brutalityCol]) || 0;
    brutalitySum += b;

    const tsVal = row[tsCol];
    const ts = tsVal ? new Date(tsVal) : null;
    if (ts) {
      if (!startTime || ts < startTime) startTime = ts;
      if (!endTime || ts > endTime) endTime = ts;
    }
    // Per-player counting and brutality attribution
    const whiteName = (row[col['White Player']] || '').toString();
    const blackName = (row[col['Black Player']] || '').toString();
    players.forEach(function(p) {
      var playedThisMatch = false;
      var playedAs = null;
      if (whiteName === p) { playedThisMatch = true; playedAs = 'white'; }
      if (blackName === p) { playedThisMatch = true; playedAs = 'black'; }
      if (!playedThisMatch) return;

      perPlayer[p].played++;
      if (winner === 'Draw') {
        perPlayer[p].draws++;
        perPlayer[p].suffered += b;
        if (playedAs === 'white') perPlayer[p].draws_as_white++;
        if (playedAs === 'black') perPlayer[p].draws_as_black++;
      } else if ((winner === 'White' && whiteName === p) || (winner === 'Black' && blackName === p)) {
        perPlayer[p].wins++;
        perPlayer[p].inflicted += b;
        if (playedAs === 'white') perPlayer[p].wins_as_white++;
        if (playedAs === 'black') perPlayer[p].wins_as_black++;
      } else {
        perPlayer[p].losses++;
        perPlayer[p].suffered += b;
        if (playedAs === 'white') perPlayer[p].losses_as_white++;
        if (playedAs === 'black') perPlayer[p].losses_as_black++;
      }
    });
  }

  const avgBrutality = matches ? (brutalitySum / matches) : 0;

  const stats = {
    sessionId: sessionId,
    matches: matches,
    whiteWins: whiteWins,
    blackWins: blackWins,
    draws: draws,
    avgBrutality: avgBrutality,
    startTime: startTime ? startTime.toISOString() : null,
    endTime: endTime ? endTime.toISOString() : null
  };

  // Attach per-player aggregated stats
  players.forEach(function(p) {
    var keyBase = p.replace(/\s+/g,'_').toLowerCase();
    stats[keyBase + '_played'] = perPlayer[p].played;
    stats[keyBase + '_wins'] = perPlayer[p].wins;
    stats[keyBase + '_losses'] = perPlayer[p].losses;
    stats[keyBase + '_draws'] = perPlayer[p].draws;
    stats[keyBase + '_inflicted'] = perPlayer[p].inflicted;
    stats[keyBase + '_suffered'] = perPlayer[p].suffered;
    // color breakdown
    stats[keyBase + '_wins_as_white'] = perPlayer[p].wins_as_white;
    stats[keyBase + '_wins_as_black'] = perPlayer[p].wins_as_black;
    stats[keyBase + '_losses_as_white'] = perPlayer[p].losses_as_white;
    stats[keyBase + '_losses_as_black'] = perPlayer[p].losses_as_black;
    stats[keyBase + '_draws_as_white'] = perPlayer[p].draws_as_white;
    stats[keyBase + '_draws_as_black'] = perPlayer[p].draws_as_black;
  });

  logEvent('session_stats_computed', { sessionId: sessionId, matches: matches });
  return stats;
}

/**
 * Persist or update a session summary row in the `Sessions` sheet.
 * Columns: Session ID | Start Time | End Time | Matches | White Wins | Black Wins | Draws | Avg Brutality | Last Updated
 */
function saveSessionSummary(sessionId) {
  try {
    if (!sessionId) throw new Error('sessionId required');

    const spreadsheet = getOrCreateSpreadsheet();

    // --- Sessions sheet (session-level aggregates) ---
    let sheet = spreadsheet.getSheetByName('Sessions');
    if (!sheet) sheet = spreadsheet.insertSheet('Sessions');

    // Ensure session-level headers
    if (sheet.getLastRow() === 0) {
      const headers = ['Session ID', 'Start Time', 'End Time', 'Matches', 'White Wins', 'Black Wins', 'Draws', 'Avg Brutality', 'Last Updated'];
      sheet.appendRow(headers);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4a90e2');
      headerRange.setFontColor('white');
    }

    const stats = computeSessionStats(sessionId);
    if (!stats) return null;

    // Upsert session-level row
    const rows = sheet.getDataRange().getValues();
    let existingRow = -1;
    for (let r = 1; r < rows.length; r++) {
      if ((rows[r][0] || '').toString() === sessionId) { existingRow = r + 1; break; }
    }

    const nowIso = new Date().toISOString();
    const sessionValues = [
      stats.sessionId,
      stats.startTime || '',
      stats.endTime || '',
      stats.matches,
      stats.whiteWins,
      stats.blackWins,
      stats.draws,
      stats.avgBrutality,
      nowIso
    ];

    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, sessionValues.length).setValues([sessionValues]);
      logEvent('session_summary_updated', { sessionId: sessionId });
    } else {
      sheet.appendRow(sessionValues);
      logEvent('session_summary_created', { sessionId: sessionId });
    }

    // --- SessionPlayers sheet (per-player stats for each session) ---
    let pSheet = spreadsheet.getSheetByName('SessionPlayers');
    if (!pSheet) pSheet = spreadsheet.insertSheet('SessionPlayers');

    if (pSheet.getLastRow() === 0) {
      const pHeaders = ['Session ID', 'Player', 'Matches', 'Wins', 'Wins as White', 'Wins as Black', 'Losses', 'Losses as White', 'Losses as Black', 'Draws', 'Draws as White', 'Draws as Black', 'Inflicted', 'Suffered', 'Last Updated'];
      pSheet.appendRow(pHeaders);
      const pHeaderRange = pSheet.getRange(1, 1, 1, pHeaders.length);
      pHeaderRange.setFontWeight('bold');
      pHeaderRange.setBackground('#4a90e2');
      pHeaderRange.setFontColor('white');
    }

    // Upsert rows for each configured player who actually played
    const config = getConfig();
    const players = config.players;
    const pData = pSheet.getDataRange().getValues();
    players.forEach(function(p) {
      const keyPlayed = (p.replace(/\s+/g,'_').toLowerCase() + '_played');
      const keyWins = (p.replace(/\s+/g,'_').toLowerCase() + '_wins');
      const keyLosses = (p.replace(/\s+/g,'_').toLowerCase() + '_losses');
      const keyDraws = (p.replace(/\s+/g,'_').toLowerCase() + '_draws');
      const keyInflicted = (p.replace(/\s+/g,'_').toLowerCase() + '_inflicted');
      const keySuffered = (p.replace(/\s+/g,'_').toLowerCase() + '_suffered');

      const matchesPlayed = stats[keyPlayed] || 0;

      // Skip players who didn't play in this session
      if (matchesPlayed === 0) {
        return;
      }

      const prowValues = [
        sessionId,
        p,
        matchesPlayed,
        stats[keyWins] || 0,
        stats[keyWins + '_as_white'] || 0,
        stats[keyWins + '_as_black'] || 0,
        stats[keyLosses] || 0,
        stats[keyLosses + '_as_white'] || 0,
        stats[keyLosses + '_as_black'] || 0,
        stats[keyDraws] || 0,
        stats[keyDraws + '_as_white'] || 0,
        stats[keyDraws + '_as_black'] || 0,
        stats[keyInflicted] || 0,
        stats[keySuffered] || 0,
        nowIso
      ];

      // Find existing row for this session+player
      let existingPRow = -1;
      for (let r = 1; r < pData.length; r++) {
        const sid = (pData[r][0] || '').toString();
        const playerName = (pData[r][1] || '').toString();
        if (sid === sessionId && playerName === p) { existingPRow = r + 1; break; }
      }

      if (existingPRow > 0) {
        pSheet.getRange(existingPRow, 1, 1, prowValues.length).setValues([prowValues]);
      } else {
        pSheet.appendRow(prowValues);
      }
    });

    logEvent('session_players_updated', { sessionId: sessionId });

    return { success: true, sessionId: sessionId };
  } catch (error) {
    logEvent('session_summary_error', { sessionId: sessionId, error: error.toString(), stack: error.stack });
    // Do not throw — session summary errors should not prevent match logging
    return { success: false, error: error.toString() };
  }
}

/**
 * Recompute session statistics from source of truth (Matches sheet)
 * Recalculates Sessions and SessionPlayers sheets based on current match data
 * Use this after deleting matches or when derived data is out of sync
 * 
 * @param {string} sessionId - The session ID to recalculate
 * @returns {Object} Result with success status and details
 */
function recomputeSessionStats(sessionId) {
  try {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }
    
    logEvent('recompute_session_stats_start', { sessionId: sessionId });
    
    const spreadsheet = getOrCreateSpreadsheet();
    const matchesSheet = spreadsheet.getSheetByName('Matches');
    
    if (!matchesSheet) {
      return { success: false, error: 'Matches sheet not found' };
    }
    
    // Check if session has any matches
    const data = matchesSheet.getDataRange().getValues();
    const headers = data[0];
    const sessionIdCol = headers.indexOf('Session ID');
    
    if (sessionIdCol === -1) {
      return { success: false, error: 'Session ID column not found in Matches sheet' };
    }
    
    let hasMatches = false;
    for (let i = 1; i < data.length; i++) {
      if ((data[i][sessionIdCol] || '').toString() === sessionId) {
        hasMatches = true;
        break;
      }
    }
    
    if (!hasMatches) {
      // No matches for this session - remove from Sessions and SessionPlayers
      logEvent('recompute_no_matches', { sessionId: sessionId });
      removeEmptySession(sessionId);
      return { success: true, sessionId: sessionId, action: 'removed', reason: 'no matches found' };
    }
    
    // Clean up stale SessionPlayers entries before recalculating
    cleanupStaleSessionPlayers(sessionId);
    
    // Recalculate using existing saveSessionSummary function
    const result = saveSessionSummary(sessionId);
    
    logEvent('recompute_session_stats_complete', { sessionId: sessionId, result: result });
    
    return { success: true, sessionId: sessionId, action: 'recalculated', result: result };
    
  } catch (error) {
    logEvent('recompute_session_stats_error', { sessionId: sessionId, error: error.toString(), stack: error.stack });
    return { success: false, error: error.toString() };
  }
}

/**
 * Remove session from Sessions and SessionPlayers when it has no matches
 * @param {string} sessionId - Session to remove
 */
function removeEmptySession(sessionId) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    
    // Remove from Sessions sheet
    const sessionsSheet = spreadsheet.getSheetByName('Sessions');
    if (sessionsSheet) {
      const data = sessionsSheet.getDataRange().getValues();
      for (let i = data.length - 1; i > 0; i--) {
        if ((data[i][0] || '').toString() === sessionId) {
          sessionsSheet.deleteRow(i + 1);
          logEvent('removed_empty_session', { sessionId: sessionId });
          break;
        }
      }
    }
    
    // Remove from SessionPlayers sheet
    const playersSheet = spreadsheet.getSheetByName('SessionPlayers');
    if (playersSheet) {
      const data = playersSheet.getDataRange().getValues();
      const rowsToDelete = [];
      for (let i = data.length - 1; i > 0; i--) {
        if ((data[i][0] || '').toString() === sessionId) {
          rowsToDelete.push(i + 1);
        }
      }
      for (let i = 0; i < rowsToDelete.length; i++) {
        playersSheet.deleteRow(rowsToDelete[i] - i);
      }
      if (rowsToDelete.length > 0) {
        logEvent('removed_empty_session_players', { sessionId: sessionId, count: rowsToDelete.length });
      }
    }
  } catch (error) {
    logEvent('remove_empty_session_error', { sessionId: sessionId, error: error.toString() });
  }
}

/**
 * Remove SessionPlayers entries for players who no longer have matches in this session
 * This cleans up entries that exist in SessionPlayers but have no corresponding matches
 * @param {string} sessionId - Session to clean up
 */
function cleanupStaleSessionPlayers(sessionId) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const matchesSheet = spreadsheet.getSheetByName('Matches');
    const playersSheet = spreadsheet.getSheetByName('SessionPlayers');
    
    if (!matchesSheet || !playersSheet) return;
    
    // Get all players who actually played in this session (from Matches)
    const matchData = matchesSheet.getDataRange().getValues();
    const matchHeaders = matchData[0];
    const sessionIdCol = matchHeaders.indexOf('Session ID');
    const whiteCol = matchHeaders.indexOf('White Player');
    const blackCol = matchHeaders.indexOf('Black Player');
    
    if (sessionIdCol === -1 || whiteCol === -1 || blackCol === -1) return;
    
    const actualPlayers = {};
    for (let i = 1; i < matchData.length; i++) {
      if ((matchData[i][sessionIdCol] || '').toString() === sessionId) {
        const white = (matchData[i][whiteCol] || '').toString().trim();
        const black = (matchData[i][blackCol] || '').toString().trim();
        if (white) actualPlayers[white] = true;
        if (black) actualPlayers[black] = true;
      }
    }
    
    // Remove SessionPlayers entries for players not in actualPlayers
    const playerData = playersSheet.getDataRange().getValues();
    const rowsToDelete = [];
    
    for (let i = playerData.length - 1; i > 0; i--) {
      const sid = (playerData[i][0] || '').toString();
      const player = (playerData[i][1] || '').toString().trim();
      
      if (sid === sessionId && !actualPlayers[player]) {
        rowsToDelete.push(i + 1);
        logEvent('removing_stale_player', { sessionId: sessionId, player: player });
      }
    }
    
    for (let i = 0; i < rowsToDelete.length; i++) {
      playersSheet.deleteRow(rowsToDelete[i] - i);
    }
    
    if (rowsToDelete.length > 0) {
      logEvent('cleanup_stale_players', { sessionId: sessionId, removed: rowsToDelete.length });
    }
    
  } catch (error) {
    logEvent('cleanup_stale_players_error', { sessionId: sessionId, error: error.toString() });
  }
}

/**
 * Get list of all sessions for dropdown selection
 * @returns {Array} Array of session objects with id, venue, startTime, matchCount
 */
function getAllSessions() {
  try {
    var spreadsheet = getOrCreateSpreadsheet();
    var sessionsSheet = spreadsheet.getSheetByName('Sessions');

    if (!sessionsSheet || sessionsSheet.getLastRow() <= 1) {
      return []; // No sessions yet
    }

    var data = sessionsSheet.getDataRange().getValues();
    var headers = data[0];
    var sessionIdCol = headers.indexOf('Session ID');
    var startTimeCol = headers.indexOf('Start Time');
    var matchesCol = headers.indexOf('Matches');

    var sessions = [];

    // Get venue from Matches sheet for each session
    var matchesSheet = spreadsheet.getSheetByName('Matches');
    var matchData = matchesSheet ? matchesSheet.getDataRange().getValues() : [];
    var matchHeaders = matchData.length > 0 ? matchData[0] : [];
    var matchSessionIdCol = matchHeaders.indexOf('Session ID');
    var matchVenueCol = matchHeaders.indexOf('Venue');

    for (var i = 1; i < data.length; i++) {
      var sessionId = data[i][sessionIdCol];
      var startTime = data[i][startTimeCol];
      var matchCount = data[i][matchesCol];

      // Find venue from first match of this session
      var venue = 'Unknown';
      if (matchesSheet && matchSessionIdCol !== -1 && matchVenueCol !== -1) {
        for (var j = 1; j < matchData.length; j++) {
          if (matchData[j][matchSessionIdCol] === sessionId) {
            venue = matchData[j][matchVenueCol];
            break;
          }
        }
      }

      sessions.push({
        id: sessionId,
        venue: venue,
        startTime: startTime ? new Date(startTime).toISOString() : null,
        matchCount: matchCount
      });
    }

    // Sort by start time descending (most recent first)
    sessions.sort(function(a, b) {
      return new Date(b.startTime) - new Date(a.startTime);
    });

    return sessions;

  } catch (error) {
    logEvent('get_all_sessions_error', { error: error.toString() });
    return [];
  }
}

/**
 * Get current session statistics
 * Returns data about the most recent active session for display in the UI
 * @param {string} sessionId - Optional session ID to fetch specific session
 * @returns {Object|null} Current session data or null if no active session
 */
function getCurrentSessionData(sessionId) {
  try {
    logEvent('get_current_session_request', { requestedSessionId: sessionId });

    var spreadsheet = getOrCreateSpreadsheet();
    var matchesSheet = spreadsheet.getSheetByName('Matches');

    if (!matchesSheet || matchesSheet.getLastRow() <= 1) {
      return null; // No matches yet
    }

    var headers = matchesSheet.getRange(1, 1, 1, matchesSheet.getLastColumn()).getValues()[0];
    var sessionIdCol = headers.indexOf('Session ID');
    var venueCol = headers.indexOf('Venue');
    var timestampCol = 0; // Always first column

    if (sessionIdCol === -1) {
      return null; // Session ID column doesn't exist yet
    }

    // If no sessionId provided, get the session ID from the most recent match
    var currentSessionId = sessionId;
    var lastMatchData;

    if (!currentSessionId) {
      var lastRow = matchesSheet.getLastRow();
      lastMatchData = matchesSheet.getRange(lastRow, 1, 1, matchesSheet.getLastColumn()).getValues()[0];
      currentSessionId = lastMatchData[sessionIdCol];

      if (!currentSessionId) {
        return null; // No session ID on last match
      }
    }

    // Fetch session data from Sessions and SessionPlayers sheets
    var sessionsSheet = spreadsheet.getSheetByName('Sessions');
    var sessionPlayersSheet = spreadsheet.getSheetByName('SessionPlayers');

    if (!sessionsSheet || !sessionPlayersSheet) {
      // Fallback: compute stats directly from Matches sheet
      return computeCurrentSessionFromMatches(matchesSheet, currentSessionId);
    }

    // Get session metadata from Sessions sheet
    var sessionData = findSessionInSheet(sessionsSheet, currentSessionId);

    // Get player stats from SessionPlayers sheet
    var playerStats = findSessionPlayersInSheet(sessionPlayersSheet, currentSessionId);

    // Get last match info - need to find last match for this specific session
    if (!lastMatchData) {
      // Find the last match for this session
      var allData = matchesSheet.getDataRange().getValues();
      for (var i = allData.length - 1; i >= 1; i--) {
        if (allData[i][sessionIdCol] === currentSessionId) {
          lastMatchData = allData[i];
          break;
        }
      }
    }

    var lastMatchInfo = null;
    if (lastMatchData) {
      lastMatchInfo = {
        timestamp: lastMatchData[timestampCol],
        whitePlayer: lastMatchData[headers.indexOf('White Player')],
        blackPlayer: lastMatchData[headers.indexOf('Black Player')],
        winner: lastMatchData[headers.indexOf('Winner')],
        venue: lastMatchData[venueCol]
      };
    }

    // Calculate white vs black wins
    var whiteWins = 0;
    var blackWins = 0;
    var draws = 0;
    
    if (matchesSheet && matchesSheet.getLastRow() > 1) {
      var allMatches = matchesSheet.getDataRange().getValues();
      var winnerCol = allMatches[0].indexOf('Winner');
      
      for (var m = 1; m < allMatches.length; m++) {
        if (allMatches[m][sessionIdCol] === currentSessionId) {
          var winner = allMatches[m][winnerCol];
          if (winner === 'White') {
            whiteWins++;
          } else if (winner === 'Black') {
            blackWins++;
          } else if (winner === 'Draw') {
            draws++;
          }
        }
      }
    }

    // Convert Date objects to ISO strings for proper serialization
    var result = {
      sessionId: currentSessionId,
      venue: lastMatchInfo ? lastMatchInfo.venue : 'Unknown',
      startTime: sessionData.startTime ? new Date(sessionData.startTime).toISOString() : null,
      matchCount: sessionData.matchCount,
      playerStats: playerStats,
      whiteWins: whiteWins,
      blackWins: blackWins,
      draws: draws,
      lastMatch: lastMatchInfo ? {
        timestamp: lastMatchInfo.timestamp ? new Date(lastMatchInfo.timestamp).toISOString() : null,
        whitePlayer: lastMatchInfo.whitePlayer,
        blackPlayer: lastMatchInfo.blackPlayer,
        winner: lastMatchInfo.winner,
        venue: lastMatchInfo.venue
      } : null
    };

    logEvent('get_current_session_success', {
      sessionId: currentSessionId,
      matchCount: sessionData.matchCount,
      playerCount: playerStats.length,
      hasStartTime: !!result.startTime,
      hasLastMatch: !!result.lastMatch
    });

    return result;

  } catch (error) {
    logEvent('get_current_session_error', { error: error.toString(), stack: error.stack });
    return null;
  }
}

/**
 * Get aggregated stats for the current year (all sessions in 2026)
 */
function getYearToDateStats() {
  try {
    logEvent('get_year_to_date_request', {});

    var spreadsheet = getOrCreateSpreadsheet();
    var sessionPlayersSheet = spreadsheet.getSheetByName('SessionPlayers');
    var sessionsSheet = spreadsheet.getSheetByName('Sessions');

    if (!sessionPlayersSheet || sessionPlayersSheet.getLastRow() <= 1) {
      return null; // No session player data yet
    }

    // Get headers from SessionPlayers sheet
    var spHeaders = sessionPlayersSheet.getRange(1, 1, 1, sessionPlayersSheet.getLastColumn()).getValues()[0];
    var playerCol = spHeaders.indexOf('Player');
    var matchesCol = spHeaders.indexOf('Matches');
    var winsCol = spHeaders.indexOf('Wins');
    var lossesCol = spHeaders.indexOf('Losses');
    var drawsCol = spHeaders.indexOf('Draws');
    var inflictedCol = spHeaders.indexOf('Inflicted');
    var sufferedCol = spHeaders.indexOf('Suffered');

    logEvent('ytd_headers', {
      headers: spHeaders.toString(),
      playerCol: playerCol,
      matchesCol: matchesCol,
      winsCol: winsCol,
      lossesCol: lossesCol,
      drawsCol: drawsCol,
      inflictedCol: inflictedCol,
      sufferedCol: sufferedCol
    });

    // Get all data from SessionPlayers
    var sessionPlayersData = sessionPlayersSheet.getDataRange().getValues();

    // Aggregate by player
    var playerStatsMap = {};
    for (var i = 1; i < sessionPlayersData.length; i++) {
      var player = sessionPlayersData[i][playerCol];
      var matches = sessionPlayersData[i][matchesCol] || 0;
      var wins = sessionPlayersData[i][winsCol] || 0;
      var losses = sessionPlayersData[i][lossesCol] || 0;
      var draws = sessionPlayersData[i][drawsCol] || 0;
      var inflicted = sessionPlayersData[i][inflictedCol] || 0;
      var suffered = sessionPlayersData[i][sufferedCol] || 0;

      if (!playerStatsMap[player]) {
        playerStatsMap[player] = { player: player, matches: 0, wins: 0, losses: 0, draws: 0, inflicted: 0, suffered: 0 };
      }

      playerStatsMap[player].matches += matches;
      playerStatsMap[player].wins += wins;
      playerStatsMap[player].losses += losses;
      playerStatsMap[player].draws += draws;
      playerStatsMap[player].inflicted += inflicted;
      playerStatsMap[player].suffered += suffered;
    }

    // Convert to array and sort by wins descending
    var playerStats = [];
    for (var playerName in playerStatsMap) {
      if (playerStatsMap.hasOwnProperty(playerName)) {
        playerStats.push(playerStatsMap[playerName]);
      }
    }

    playerStats.sort(function(a, b) {
      return b.wins - a.wins;
    });

    logEvent('ytd_player_stats', {
      playerStats: JSON.stringify(playerStats)
    });

    // Get white/black wins and draws from Sessions sheet
    var whiteWins = 0;
    var blackWins = 0;
    var draws = 0;
    var matchCount = 0;
    var sessionCount = 0;
    var venuesSet = {};

    if (sessionsSheet && sessionsSheet.getLastRow() > 1) {
      var sessionsData = sessionsSheet.getDataRange().getValues();
      var sessHeaders = sessionsData[0];
      var sWhiteWinsCol = sessHeaders.indexOf('White Wins');
      var sBlackWinsCol = sessHeaders.indexOf('Black Wins');
      var sDrawsCol = sessHeaders.indexOf('Draws');
      var sMatchesCol = sessHeaders.indexOf('Matches');
      var sVenueCol = sessHeaders.indexOf('Venue');

      // Aggregate all sessions
      for (var s = 1; s < sessionsData.length; s++) {
        whiteWins += sessionsData[s][sWhiteWinsCol] || 0;
        blackWins += sessionsData[s][sBlackWinsCol] || 0;
        draws += sessionsData[s][sDrawsCol] || 0;
        matchCount += sessionsData[s][sMatchesCol] || 0;
        sessionCount++;
        
        // Track unique venues
        var venue = sessionsData[s][sVenueCol];
        if (venue) {
          venuesSet[venue] = true;
        }
      }
    }

    var result = {
      sessionId: 'ytd-' + new Date().getFullYear(),
      matchCount: matchCount,
      sessionCount: sessionCount,
      venueCount: Object.keys(venuesSet).length,
      playerStats: playerStats,
      whiteWins: whiteWins,
      blackWins: blackWins,
      draws: draws
    };

    logEvent('get_year_to_date_success', {
      matchCount: matchCount,
      playerCount: playerStats.length,
      whiteWins: whiteWins,
      blackWins: blackWins,
      draws: draws
    });

    return result;

  } catch (error) {
    logEvent('get_year_to_date_error', { error: error.toString(), stack: error.stack });
    return null;
  }
}

/**
 * Helper: Find session data in Sessions sheet
 * @param {Sheet} sheet - The Sessions sheet
 * @param {string} sessionId - The session ID to find
 * @returns {Object} Session metadata
 */
function findSessionInSheet(sheet, sessionId) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var sessionIdCol = headers.indexOf('Session ID');

  for (var i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === sessionId) {
      return {
        startTime: data[i][headers.indexOf('Start Time')],
        endTime: data[i][headers.indexOf('End Time')],
        matchCount: data[i][headers.indexOf('Matches')]
      };
    }
  }
  return { startTime: null, endTime: null, matchCount: 0 };
}

/**
 * Helper: Find player stats in SessionPlayers sheet
 * @param {Sheet} sheet - The SessionPlayers sheet
 * @param {string} sessionId - The session ID to find
 * @returns {Array} Array of player stat objects
 */
function findSessionPlayersInSheet(sheet, sessionId) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var sessionIdCol = headers.indexOf('Session ID');
  var playerStats = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === sessionId) {
      playerStats.push({
        player: data[i][headers.indexOf('Player')],
        matches: data[i][headers.indexOf('Matches')],
        wins: data[i][headers.indexOf('Wins')],
        losses: data[i][headers.indexOf('Losses')],
        draws: data[i][headers.indexOf('Draws')],
        inflicted: data[i][headers.indexOf('Inflicted')],
        suffered: data[i][headers.indexOf('Suffered')]
      });
    }
  }
  return playerStats;
}

/**
 * Fallback: Compute session stats directly from Matches sheet
 * Used when Sessions/SessionPlayers sheets don't exist
 * @param {Sheet} sheet - The Matches sheet
 * @param {string} sessionId - The session ID to compute
 * @returns {Object|null} Session data or null
 */
function computeCurrentSessionFromMatches(sheet, sessionId) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var config = getConfig();

  // Find all matches with this session ID
  var sessionMatches = [];
  var sessionIdCol = headers.indexOf('Session ID');

  for (var i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === sessionId) {
      sessionMatches.push(data[i]);
    }
  }

  if (sessionMatches.length === 0) {
    return null;
  }

  // Compute stats
  var startTime = sessionMatches[0][0]; // First match timestamp
  var venue = sessionMatches[0][headers.indexOf('Venue')];
  var matchCount = sessionMatches.length;

  // Compute per-player stats
  var playerStats = {};
  config.players.forEach(function(player) {
    playerStats[player] = {
      matches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      inflicted: 0,
      suffered: 0
    };
  });

  sessionMatches.forEach(function(match) {
    var whitePlayer = match[headers.indexOf('White Player')];
    var blackPlayer = match[headers.indexOf('Black Player')];
    var winner = match[headers.indexOf('Winner')];
    var brutality = parseInt(match[headers.indexOf('Brutality')] || 0);

    // Update match counts
    if (playerStats[whitePlayer]) playerStats[whitePlayer].matches++;
    if (playerStats[blackPlayer]) playerStats[blackPlayer].matches++;

    // Update wins/losses/draws
    if (winner === 'Draw') {
      if (playerStats[whitePlayer]) {
        playerStats[whitePlayer].draws++;
        playerStats[whitePlayer].suffered += brutality;
      }
      if (playerStats[blackPlayer]) {
        playerStats[blackPlayer].draws++;
        playerStats[blackPlayer].suffered += brutality;
      }
    } else {
      var winnerPlayer = (winner === 'White') ? whitePlayer : blackPlayer;
      var loserPlayer = (winner === 'White') ? blackPlayer : whitePlayer;

      if (playerStats[winnerPlayer]) {
        playerStats[winnerPlayer].wins++;
        playerStats[winnerPlayer].inflicted += brutality;
      }
      if (playerStats[loserPlayer]) {
        playerStats[loserPlayer].losses++;
        playerStats[loserPlayer].suffered += brutality;
      }
    }
  });

  // Convert to array
  var playerStatsArray = [];
  Object.keys(playerStats).forEach(function(player) {
    if (playerStats[player].matches > 0) {
      playerStatsArray.push({
        player: player,
        matches: playerStats[player].matches,
        wins: playerStats[player].wins,
        losses: playerStats[player].losses,
        draws: playerStats[player].draws,
        inflicted: playerStats[player].inflicted,
        suffered: playerStats[player].suffered
      });
    }
  });

  // Convert Date objects to ISO strings for proper serialization
  var lastMatchIndex = sessionMatches.length - 1;
  return {
    sessionId: sessionId,
    venue: venue,
    startTime: startTime ? new Date(startTime).toISOString() : null,
    matchCount: matchCount,
    playerStats: playerStatsArray,
    lastMatch: {
      timestamp: sessionMatches[lastMatchIndex][0] ? new Date(sessionMatches[lastMatchIndex][0]).toISOString() : null,
      whitePlayer: sessionMatches[lastMatchIndex][headers.indexOf('White Player')],
      blackPlayer: sessionMatches[lastMatchIndex][headers.indexOf('Black Player')],
      winner: sessionMatches[lastMatchIndex][headers.indexOf('Winner')],
      venue: venue
    }
  };
}

/**
 * Manages Google Sheets integration with automatic fallbacks
 * Handles permissions, missing sheets, and automatic creation
 * @returns {Spreadsheet} The target spreadsheet for data storage
 * @throws {Error} If unable to access or create spreadsheet
 */
function getOrCreateSpreadsheet() {
  const DEFAULT_SPREADSHEET_ID = 'your-default-spreadsheet-id-here'; // Replace with your spreadsheet ID if needed
  const SPREADSHEET_NAME = 'Friend Chess Games';
  
  try {
    logEvent('spreadsheet_access_attempt', {});
    
    // Try to get spreadsheet ID from Properties first
    const properties = PropertiesService.getScriptProperties();
    let spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    
    // If no stored ID, use the default one and store it
    if (!spreadsheetId) {
      spreadsheetId = DEFAULT_SPREADSHEET_ID;
      properties.setProperty('SPREADSHEET_ID', spreadsheetId);
      logEvent('using_default_spreadsheet', { spreadsheetId });
    }
    
    // Try to open the specific spreadsheet
    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      logEvent('spreadsheet_access_success', { 
        spreadsheetId, 
        name: spreadsheet.getName() 
      });
      return spreadsheet;
    } catch (accessError) {
      logEvent('spreadsheet_access_failed', { 
        spreadsheetId, 
        error: accessError.toString() 
      });
      
      // If we can't access the specified sheet, try to find one by name as fallback
      const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
      if (files.hasNext()) {
        const file = files.next();
        const fallbackId = file.getId();
        logEvent('using_fallback_spreadsheet', { fallbackId });
        
        // Update stored ID to the one we can actually access
        properties.setProperty('SPREADSHEET_ID', fallbackId);
        return SpreadsheetApp.openById(fallbackId);
      }
      
      // Last resort: create new spreadsheet
      logEvent('creating_new_spreadsheet', { name: SPREADSHEET_NAME });
      const newSpreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
      const newId = newSpreadsheet.getId();
      
      // Store the new ID
      properties.setProperty('SPREADSHEET_ID', newId);
      
      // Share with owner (optional - for visibility)
      const owner = Session.getActiveUser().getEmail();
      if (owner) {
        DriveApp.getFileById(newId).addEditor(owner);
      }
      
      logEvent('spreadsheet_created_success', { 
        spreadsheetId: newId, 
        owner 
      });
      return newSpreadsheet;
    }
    
  } catch (error) {
    logEvent('spreadsheet_error', { error: error.toString(), stack: error.stack });
    throw new Error('Failed to access or create spreadsheet: ' + error.toString());
  }
}