/**
 * Automated Test Suite for Chess Tracker
 * Run from Apps Script: testAll()
 */

// Test Results Tracker
var testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// Test Data Tracker (for cleanup)
var testData = {
  sessionIds: [],
  rowsAdded: 0,
  spreadsheetId: null
};

/**
 * Main test runner - executes all tests
 */
function testAll() {
  Logger.log('=== STARTING AUTOMATED TESTS ===');
  testResults = { passed: 0, failed: 0, errors: [] };
  
  // Configuration Tests
  testGetConfig();
  testDefaultConfig();
  testPlayerColors();
  
  // Validation Tests
  testValidationLimits();
  testValidValues();
  
  // Session Management Tests
  testSessionIdGeneration();
  testSessionAssignment();
  
  // Form Submission Tests
  testAddRowValidation();
  testAddRowSuccess();
  testRateLimiting();
  
  // Error Handling Tests
  testErrorHandling();
  
  // Print Results
  printTestResults();
  
  // Clean up test data
  Logger.log('');
  cleanupTestData();
  
  return testResults;
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    Logger.log('✅ PASS: ' + message);
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    Logger.log('❌ FAIL: ' + message);
  }
}

/**
 * Test getConfig returns proper structure
 */
function testGetConfig() {
  Logger.log('\n--- Testing getConfig() ---');
  
  try {
    var config = getConfig();
    
    assert(config !== null, 'Config should not be null');
    assert(config.players !== undefined, 'Config should have players array');
    assert(config.playerColors !== undefined, 'Config should have playerColors object');
    assert(config.playerEmojis !== undefined, 'Config should have playerEmojis object');
    assert(config.venues !== undefined, 'Config should have venues array');
    assert(config.mulliganVenues !== undefined, 'Config should have mulliganVenues array');
    assert(config.sessionGapHours !== undefined, 'Config should have sessionGapHours');
    
    assert(Array.isArray(config.players), 'Players should be an array');
    assert(typeof config.playerColors === 'object', 'PlayerColors should be an object');
    assert(typeof config.playerEmojis === 'object', 'PlayerEmojis should be an object');
    assert(config.players.length > 0, 'Players array should not be empty');
    
  } catch (error) {
    assert(false, 'getConfig threw error: ' + error.message);
  }
}

/**
 * Test default configuration values
 */
function testDefaultConfig() {
  Logger.log('\n--- Testing Default Config ---');
  
  try {
    assert(DEFAULT_CONFIG.PLAYERS === 'Player1,Player2,Player3', 'Default players should be Player1,Player2,Player3');
    assert(DEFAULT_CONFIG.PLAYER_COLORS !== undefined, 'Default player colors should exist');
    assert(DEFAULT_CONFIG.PLAYER_EMOJIS !== undefined, 'Default player emojis should exist');
    assert(DEFAULT_CONFIG.VENUES === 'Home,Park', 'Default venues should be Home,Park');
    assert(DEFAULT_CONFIG.SESSION_GAP_HOURS === '6', 'Default session gap should be 6 hours');
    
  } catch (error) {
    assert(false, 'Default config test threw error: ' + error.message);
  }
}

/**
 * Test player color mappings
 */
function testPlayerColors() {
  Logger.log('\n--- Testing Player Colors ---');
  
  try {
    var config = getConfig();
    var colors = config.playerColors;
    var emojis = config.playerEmojis;
    
    assert(colors['Player1'] !== undefined, 'Player1 should have a color');
    assert(colors['Player2'] !== undefined, 'Player2 should have a color');
    assert(colors['Player3'] !== undefined, 'Player3 should have a color');
    
    assert(colors['Player1'].startsWith('#'), 'Player1 color should be hex format');
    assert(colors['Player2'].startsWith('#'), 'Player2 color should be hex format');
    assert(colors['Player3'].startsWith('#'), 'Player3 color should be hex format');
    
    assert(emojis['Player1'] !== undefined, 'Player1 should have an emoji');
    assert(emojis['Player2'] !== undefined, 'Player2 should have an emoji');
    assert(emojis['Player3'] !== undefined, 'Player3 should have an emoji');
    
    assert(emojis['Player1'].length > 0, 'Player1 emoji should not be empty');
    assert(emojis['Player2'].length > 0, 'Player2 emoji should not be empty');
    assert(emojis['Player3'].length > 0, 'Player3 emoji should not be empty');
    
  } catch (error) {
    assert(false, 'Player colors test threw error: ' + error.message);
  }
}

/**
 * Test validation limits are defined
 */
function testValidationLimits() {
  Logger.log('\n--- Testing Validation Limits ---');
  
  try {
    assert(VALIDATION_LIMITS.PLAYER_NAME_MAX === 50, 'Player name max should be 50');
    assert(VALIDATION_LIMITS.VENUE_MAX === 100, 'Venue max should be 100');
    assert(VALIDATION_LIMITS.RATE_LIMIT_MS === 1000, 'Rate limit should be 1000ms');
    assert(VALIDATION_LIMITS.SESSION_GAP_DEFAULT_HOURS === 6, 'Session gap default should be 6');
    
  } catch (error) {
    assert(false, 'Validation limits test threw error: ' + error.message);
  }
}

/**
 * Test valid values constants
 */
function testValidValues() {
  Logger.log('\n--- Testing Valid Values ---');
  
  try {
    assert(Array.isArray(VALID_VALUES.WINNER), 'Winner values should be an array');
    assert(VALID_VALUES.WINNER.includes('White'), 'Winner values should include White');
    assert(VALID_VALUES.WINNER.includes('Black'), 'Winner values should include Black');
    assert(VALID_VALUES.WINNER.includes('Draw'), 'Winner values should include Draw');
    assert(VALID_VALUES.WINNER.length === 3, 'Winner values should have exactly 3 options');
    
    assert(Array.isArray(VALID_VALUES.GAME_ENDINGS), 'Game endings should be an array');
    assert(VALID_VALUES.GAME_ENDINGS.length > 0, 'Game endings should not be empty');
    
  } catch (error) {
    assert(false, 'Valid values test threw error: ' + error.message);
  }
}

/**
 * Test session ID generation
 */
function testSessionIdGeneration() {
  Logger.log('\n--- Testing Session ID Generation ---');
  
  try {
    var uuid1 = Utilities.getUuid();
    var uuid2 = Utilities.getUuid();
    
    assert(uuid1 !== uuid2, 'UUIDs should be unique');
    assert(uuid1.length > 0, 'UUID should not be empty');
    assert(uuid1.includes('-'), 'UUID should contain hyphens');
    
  } catch (error) {
    assert(false, 'Session ID generation threw error: ' + error.message);
  }
}

/**
 * Test session assignment logic
 */
function testSessionAssignment() {
  Logger.log('\n--- Testing Session Assignment ---');
  
  try {
    var spreadsheet = getOrCreateSpreadsheet();
    var sheet = spreadsheet.getSheetByName('Matches');
    
    // Test with empty sheet (should create new session)
    if (sheet) {
      var sessionId = assignSessionIdForNewMatch(sheet, 6, 'Home');
      assert(sessionId !== null, 'Session ID should not be null');
      assert(sessionId.length > 0, 'Session ID should not be empty');
    } else {
      Logger.log('⚠️  Skipping session assignment test - no sheet found');
    }
    
  } catch (error) {
    assert(false, 'Session assignment threw error: ' + error.message);
  }
}

/**
 * Test form validation catches errors
 */
function testAddRowValidation() {
  Logger.log('\n--- Testing Form Validation ---');
  
  // Clear rate limit before starting
  PropertiesService.getScriptProperties().deleteProperty('lastSubmission');
  Utilities.sleep(100);
  
  try {
    // Test empty form data
    try {
      addRow([]);
      assert(false, 'Empty form should throw error');
    } catch (error) {
      assert(error.message.includes('Invalid form data'), 'Empty form should show proper error');
    }
    
    Utilities.sleep(1100); // Wait for rate limit
    
    // Test missing required fields
    try {
      addRow(['', 'Player2', 'White', 'Checkmate', '5:00', 'Home', '1', 'notes']);
      assert(false, 'Missing white player should throw error');
    } catch (error) {
      assert(error.message.includes('required'), 'Should mention required field');
    }
    
    Utilities.sleep(1100); // Wait for rate limit
    
    // Test duplicate players
    try {
      addRow(['Player1', 'Player1', 'White', 'Checkmate', '5:00', 'Home', '1', 'notes']);
      assert(false, 'Duplicate players should throw error');
    } catch (error) {
      assert(error.message.includes('different'), 'Should mention players must be different');
    }
    
    Utilities.sleep(1100); // Wait for rate limit
    
    // Test invalid winner
    try {
      addRow(['Player1', 'Player2', 'Invalid', 'Checkmate', '5:00', 'Home', '1', 'notes']);
      assert(false, 'Invalid winner should throw error');
    } catch (error) {
      assert(error.message.includes('winner'), 'Should mention winner validation');
    }
    
    Utilities.sleep(1100); // Wait for rate limit
    
    // Test time limit required for Time Out
    try {
      addRow(['Player1', 'Player2', 'White', 'Time Out', '', 'Home', '1', 'notes']);
      assert(false, 'Time Out without time limit should throw error');
    } catch (error) {
      assert(error.message.includes('Time limit'), 'Should mention time limit requirement');
    }
    
  } catch (error) {
    assert(false, 'Validation tests threw unexpected error: ' + error.message);
  }
}

/**
 * Test successful form submission
 */
function testAddRowSuccess() {
  Logger.log('\n--- Testing Successful Form Submission ---');
  
  // Clear rate limit and wait for cooldown
  PropertiesService.getScriptProperties().deleteProperty('lastSubmission');
  Utilities.sleep(1100);
  
  try {
    // Valid form data
    var formData = [
      'Player1',          // whitePlayer
      'Player2',          // blackPlayer
      'White',            // winner
      'Checkmate',        // gameEnding
      '5:00',             // timeLimit
      'Home',             // venue
      '2',                // brutality
      'Test match',       // notes
      '',                 // pictureData
      'No',               // whiteMulligan
      'No'                // blackMulligan
    ];
    
    var result = addRow(formData);
    
    assert(result !== null, 'Result should not be null');
    assert(result.success === true, 'Result should indicate success');
    assert(result.timestamp !== undefined, 'Result should have timestamp');
    
    Logger.log('✅ Test match submitted successfully');
    
  } catch (error) {
    assert(false, 'Valid form submission threw error: ' + error.message);
  }
}

/**
 * Test rate limiting
 */
function testRateLimiting() {
  Logger.log('\n--- Testing Rate Limiting ---');
  
  try {
    var props = PropertiesService.getScriptProperties();
    
    // Set last submission to now
    props.setProperty('lastSubmission', Date.now().toString());
    
    // Try to submit immediately (should fail)
    var formData = ['Player1', 'Player2', 'White', 'Checkmate', '5:00', 'Home', '1', 'test'];
    
    try {
      addRow(formData);
      assert(false, 'Rate limiting should prevent immediate resubmission');
    } catch (error) {
      assert(error.message.includes('wait'), 'Should show rate limit message');
    }
    
    // Clear rate limit for future tests
    props.deleteProperty('lastSubmission');
    
  } catch (error) {
    assert(false, 'Rate limiting test threw error: ' + error.message);
  }
}

/**
 * Test error handling utility
 */
function testErrorHandling() {
  Logger.log('\n--- Testing Error Handling ---');
  
  try {
    var testError = new Error('Test error message');
    
    // Test non-throwing error handling
    handleError('test_context', testError, false);
    assert(true, 'handleError with shouldThrow=false should not throw');
    
    // Test throwing error handling
    try {
      handleError('test_context', testError, true);
      assert(false, 'handleError with shouldThrow=true should throw');
    } catch (error) {
      assert(error.message === 'Test error message', 'Should preserve error message');
    }
    
  } catch (error) {
    assert(false, 'Error handling test threw unexpected error: ' + error.message);
  }
}

/**
 * Print test results summary
 */
function printTestResults() {
  Logger.log('\n=== TEST RESULTS ===');
  Logger.log('Passed: ' + testResults.passed);
  Logger.log('Failed: ' + testResults.failed);
  Logger.log('Total:  ' + (testResults.passed + testResults.failed));
  
  if (testResults.failed > 0) {
    Logger.log('\n❌ FAILED TESTS:');
    testResults.errors.forEach(function(error) {
      Logger.log('  - ' + error);
    });
  } else {
    Logger.log('\n🎉 ALL TESTS PASSED!');
  }
  
  return testResults.failed === 0;
}

/**
 * Quick smoke test (runs fastest tests only)
 */
function quickTest() {
  Logger.log('=== QUICK SMOKE TEST ===');
  testResults = { passed: 0, failed: 0, errors: [] };
  
  testGetConfig();
  testDefaultConfig();
  testValidationLimits();
  
  printTestResults();
  return testResults.failed === 0;
}
