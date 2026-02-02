/**
 * Temporary function to recompute specific session with debugging
 * Run this once, then delete this file
 */
function recomputeSpecificSession() {
  var sessionId = '1e604165-b190-4e74-8bcf-e78fcde965f5';
  
  // First check what players are in the config
  var config = getConfig();
  Logger.log('Configured players: ' + JSON.stringify(config.players));
  
  // Check what the stats look like
  var stats = computeSessionStats(sessionId);
  Logger.log('Computed stats: ' + JSON.stringify(stats));
  
  // Now recompute
  var result = recomputeSessionStats(sessionId);
  Logger.log('Recompute result: ' + JSON.stringify(result));
  
  return result;
}
