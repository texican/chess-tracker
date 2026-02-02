/**
 * Test Data Cleanup Utilities
 * Removes test data created by automated tests
 */

/**
 * Clean up test data from spreadsheet
 * Removes test matches and recalculates session stats from source of truth
 */
function cleanupTestData() {
  Logger.log('\n=== CLEANING UP TEST DATA ===');
  
  try {
    var ss = getOrCreateSpreadsheet();
    
    // Step 1: Find all sessions that contain test matches
    var sessionsWithTests = findSessionsWithTestMatches(ss);
    Logger.log('Found ' + sessionsWithTests.length + ' session(s) containing test matches');
    
    // Step 2: Remove test matches from Matches sheet
    var matchesSheet = ss.getSheetByName('Matches');
    if (matchesSheet) {
      var deletedCount = cleanupSheet(matchesSheet, 'Notes', 'Test match', 'Matches');
      Logger.log('Removed ' + deletedCount + ' test match(es)');
    }
    
    // Step 3: Recalculate stats for affected sessions from source of truth
    Logger.log('Recalculating ' + sessionsWithTests.length + ' affected session(s)...');
    for (var i = 0; i < sessionsWithTests.length; i++) {
      var sessionId = sessionsWithTests[i];
      try {
        var result = recomputeSessionStats(sessionId);
        if (result.success) {
          Logger.log('✓ Recalculated session ' + sessionId + ' - ' + result.action);
        } else {
          Logger.log('⚠️  Failed to recalculate session ' + sessionId + ': ' + result.error);
        }
      } catch (e) {
        Logger.log('⚠️  Error recalculating session ' + sessionId + ': ' + e.message);
      }
    }
    
    Logger.log('✅ Test data cleanup complete');
    
  } catch (error) {
    Logger.log('⚠️  Error during cleanup: ' + error.message);
  }
}

/**
 * Clean up rows from a sheet based on a column value
 * @returns {number} Number of rows deleted
 */
function cleanupSheet(sheet, columnName, searchValue, sheetName, maxRows) {
  try {
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var columnIndex = headers.indexOf(columnName);
    
    if (columnIndex === -1) {
      Logger.log('⚠️  Column "' + columnName + '" not found in ' + sheetName);
      return 0;
    }
    
    var rowsToDelete = [];
    var limitCheck = maxRows ? data.length - maxRows : 1;
    
    // Find rows with test data (start from bottom to avoid index issues)
    for (var i = data.length - 1; i > Math.max(0, limitCheck); i--) {
      var cellValue = data[i][columnIndex];
      if (cellValue && cellValue.toString().indexOf(searchValue) !== -1) {
        rowsToDelete.push(i + 1); // +1 because sheet rows are 1-indexed
      }
    }
    
    // Delete rows
    var deletedCount = 0;
    for (var i = 0; i < rowsToDelete.length; i++) {
      var rowNum = rowsToDelete[i] - i; // Adjust for already deleted rows
      sheet.deleteRow(rowNum);
      deletedCount++;
    }
    
    if (deletedCount > 0) {
      Logger.log('🗑️  Deleted ' + deletedCount + ' row(s) from ' + sheetName);
    } else {
      Logger.log('✓ No matching data found in ' + sheetName);
    }
    
    return deletedCount;
    
  } catch (error) {
    Logger.log('⚠️  Error cleaning ' + sheetName + ': ' + error.message);
    return 0;
  }
}

/**
 * Find all sessions that contain any test matches
 * @param {Spreadsheet} ss - The spreadsheet
 * @returns {Array} Array of session IDs that have test matches
 */
function findSessionsWithTestMatches(ss) {
  var matchesSheet = ss.getSheetByName('Matches');
  
  if (!matchesSheet || matchesSheet.getLastRow() <= 1) {
    return [];
  }
  
  var data = matchesSheet.getDataRange().getValues();
  var headers = data[0];
  var notesCol = headers.indexOf('Notes');
  var sessionIdCol = headers.indexOf('Session ID');
  
  if (notesCol === -1 || sessionIdCol === -1) {
    Logger.log('⚠️  Required columns not found. Notes col: ' + notesCol + ', Session ID col: ' + sessionIdCol);
    return [];
  }
  
  var sessionsSet = {};
  
  for (var i = 1; i < data.length; i++) {
    var notes = data[i][notesCol];
    var sessionId = data[i][sessionIdCol];
    
    if (notes && notes.toString().indexOf('Test match') !== -1 && sessionId) {
      var sid = sessionId.toString().trim();
      sessionsSet[sid] = true;
    }
  }
  
  // Convert to array
  var sessions = [];
  for (var sid in sessionsSet) {
    if (sessionsSet.hasOwnProperty(sid)) {
      sessions.push(sid);
    }
  }
  
  return sessions;
}

/**
 * Manual cleanup function - removes ALL test data
 * Use this if automated cleanup fails
 */
function manualCleanupAllTestData() {
  Logger.log('=== MANUAL TEST DATA CLEANUP ===');
  
  var ss = getOrCreateSpreadsheet();
  
  // Show what will be deleted
  var matchesSheet = ss.getSheetByName('Matches');
  if (matchesSheet) {
    var data = matchesSheet.getDataRange().getValues();
    var headers = data[0];
    var notesCol = headers.indexOf('Notes');
    var testRows = 0;
    for (var i = 1; i < data.length; i++) {
      var notes = data[i][notesCol];
      if (notes && notes.toString().indexOf('Test match') !== -1) {
        testRows++;
      }
    }
    Logger.log('Found ' + testRows + ' test match(es) in Matches sheet');
  }
  
  // Confirm and clean
  cleanupTestData();
  
  Logger.log('Manual cleanup complete');
}
