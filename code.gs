/**
 * Google Apps Script Server Code - Chess Game Tracker
 * Version: 1.0.0
 * Last Updated: 2026-01-08
 * 
 * Features:
 * - Chess game logging with result tracking
 * - Rating and performance analysis
 * - Opponent and opening tracking
 * - Time control and platform recording
 */

const VERSION = '1.0.0';
const LAST_UPDATED = '2026-01-08';

/**
 * Structured logging helper
 * @param {string} event - Event name
 * @param {Object} data - Event data
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
 * Serves the HTML form when web app is accessed
 * @param {Object} e - Event object with request parameters
 * @returns {HtmlOutput} The chess game logging form
 */
function doGet(e) {
  try {
    logEvent('form_served', { parameters: e.parameter, userAgent: e.parameter.userAgent });
    
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Chess Game Tracker')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      
  } catch (error) {
    logEvent('form_serve_error', { error: error.toString(), stack: error.stack });
    throw error;
  }
}

/**
 * Retrieve the last match timestamp and session id from the sheet.
 * @param {Sheet} sheet
 * @returns {Object|null} { timestamp: Date, sessionId: string } or null if no data rows
 */
function getLastMatchInfo(sheet) {
  var lastRow = sheet.getLastRow();
  // If only header exists or sheet empty
  if (!lastRow || lastRow <= 1) return null;

  var lastValues = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Find Session ID column if present
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var sessionCol = headers.indexOf('Session ID');

  var sessionId = '';
  if (sessionCol >= 0 && sessionCol < lastValues.length) {
    sessionId = (lastValues[sessionCol] || '').toString().trim();
  }

  return {
    timestamp: lastValues[0] ? new Date(lastValues[0]) : null,
    sessionId: sessionId
  };
}

/**
 * Decide whether to start a new session based on time gap (hours).
 * Returns an existing sessionId or new UUID.
 */
function assignSessionIdForNewMatch(sheet, gapHours) {
  var info = getLastMatchInfo(sheet);
  if (!info || !info.timestamp) {
    return Utilities.getUuid();
  }
  var now = new Date();
  var diffMs = now - info.timestamp;
  var diffMinutes = diffMs / 60000;
  var thresholdMinutes = (gapHours || 8) * 60; // default 8 hours
  if (diffMinutes > thresholdMinutes || !info.sessionId) {
    return Utilities.getUuid();
  }
  return info.sessionId;
}

/**
 * Processes chess game form submissions
 * @param {string[]} formData - Array: [whitePlayer, blackPlayer, winner, gameEnding, timeLimit, venue, brutality, notes, pictureData, whiteMulligan, blackMulligan]
 * @returns {Object} Success response with timestamp
 * @throws {Error} If validation fails or spreadsheet access fails
 */
function addRow(formData) {
  try {
    // Rate limiting - prevent spam submissions
    const lastSubmission = PropertiesService.getScriptProperties().getProperty('lastSubmission');
    const now = Date.now();
    if (lastSubmission && (now - parseInt(lastSubmission)) < 1000) {
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
    if (whitePlayer.length > 50) {
      throw new Error('White player name must be less than 50 characters');
    }
    
    const blackPlayer = (formData[1] || '').toString().trim();
    if (!blackPlayer || blackPlayer.length === 0) {
      throw new Error('Black player is required');
    }
    if (blackPlayer.length > 50) {
      throw new Error('Black player name must be less than 50 characters');
    }
    
    if (whitePlayer === blackPlayer) {
      throw new Error('White and black players must be different');
    }
    
    const winner = (formData[2] || '').toString().trim();
    if (!winner || !['White', 'Black', 'Draw'].includes(winner)) {
      throw new Error('Valid winner is required');
    }
    
    const gameEnding = (formData[3] || '').toString().trim();
    if (!gameEnding) {
      throw new Error('Game ending is required');
    }
    
    const venue = (formData[5] || '').toString().trim();
    if (venue.length > 100) {
      throw new Error('Venue must be less than 100 characters');
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
        logEvent('picture_upload_error', { error: error.toString() });
        // Continue without picture if upload fails
      }
    }
    
    // Determine session ID: prefer client-provided, otherwise assign based on time gap (8 hours)
    const clientSessionId = (formData[11] || '').toString().trim();
    let sessionId = clientSessionId;
    if (!sessionId) {
      sessionId = assignSessionIdForNewMatch(sheet, 8); // 8 hour gap
    }
    logEvent('session_assigned', { sessionId: sessionId, clientProvided: !!clientSessionId });

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
    logEvent('form_submission_error', { 
      error: error.toString(), 
      stack: error.stack,
      formDataValid: Array.isArray(formData)
    });
    
    throw new Error('Failed to save friend chess game: ' + error.message);
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

  // Per-player session stats for specific players
  const players = ['Carey', 'Carlos', 'Jorge'];
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

    // Upsert rows for each known player
    const players = ['Carey', 'Carlos', 'Jorge'];
    const pData = pSheet.getDataRange().getValues();
    players.forEach(function(p) {
      const keyPlayed = (p.replace(/\s+/g,'_').toLowerCase() + '_played');
      const keyWins = (p.replace(/\s+/g,'_').toLowerCase() + '_wins');
      const keyLosses = (p.replace(/\s+/g,'_').toLowerCase() + '_losses');
      const keyDraws = (p.replace(/\s+/g,'_').toLowerCase() + '_draws');
      const keyInflicted = (p.replace(/\s+/g,'_').toLowerCase() + '_inflicted');
      const keySuffered = (p.replace(/\s+/g,'_').toLowerCase() + '_suffered');

      const prowValues = [
        sessionId,
        p,
        stats[keyPlayed] || 0,
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