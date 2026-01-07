/**
 * Google Apps Script Server Code - Chess Game Tracker
 * Version: 1.0.0
 * Last Updated: 2025-08-13
 * 
 * Features:
 * - Chess game logging with result tracking
 * - Rating and performance analysis
 * - Opponent and opening tracking
 * - Time control and platform recording
 */

const VERSION = '1.0.0';
const LAST_UPDATED = '2025-08-13';

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
 * Processes chess game form submissions
 * @param {string[]} formData - Array: [whitePlayer, blackPlayer, winner, gameEnding, timeLimit, venue, brutality, notes, pictureData]
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
    let sheet = spreadsheet.getSheetByName('Sheet5');
    
    // Create Sheet5 if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Sheet5');
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
        'Picture URL'
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
      pictureUrl // Picture URL (optional)
    ];
    
    sheet.appendRow(rowData);
    
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
      brutality: rowData[7]
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