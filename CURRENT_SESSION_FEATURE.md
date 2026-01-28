# Current Session Display - Feature Specification

## Overview
Display real-time statistics about the ongoing chess session at the top of the match logging form.

## User Story
**As a chess player**, I want to see current session statistics while logging matches, so that I can track progress and standings without leaving the form.

## Feature Requirements

### Functional Requirements

1. **Session Detection**
   - Automatically detect the current active session
   - Use the most recent match's session ID as "current session"
   - Handle case where no matches exist yet (show "No active session")

2. **Data Display**
   - Show session metadata: venue, start time, duration
   - Show match count in current session
   - Display per-player statistics table
   - Show last match summary

3. **Real-time Updates**
   - Manual refresh button to update statistics
   - Auto-refresh after successful match submission
   - Loading indicator during data fetch

4. **Responsive Design**
   - Collapsible section (expand/collapse)
   - Mobile-friendly table layout
   - Consistent with existing form styling

### Non-Functional Requirements

1. **Performance**
   - Load session data in < 2 seconds
   - Efficient querying (use Sessions/SessionPlayers sheets)
   - Minimal impact on form load time

2. **Reliability**
   - Graceful error handling if data fetch fails
   - Don't block form submission if stats fail to load
   - Clear error messages

## Technical Design

### Server-Side Functions (code.gs)

```javascript
/**
 * Get current session statistics
 * @returns {Object|null} Current session data or null if no active session
 */
function getCurrentSessionData() {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    const matchesSheet = spreadsheet.getSheetByName('Matches');

    if (!matchesSheet || matchesSheet.getLastRow() <= 1) {
      return null; // No matches yet
    }

    // Get the session ID from the most recent match
    const lastRow = matchesSheet.getLastRow();
    const headers = matchesSheet.getRange(1, 1, 1, matchesSheet.getLastColumn()).getValues()[0];
    const sessionIdCol = headers.indexOf('Session ID');
    const venueCol = headers.indexOf('Venue');
    const timestampCol = 0; // Always first column

    if (sessionIdCol === -1) {
      return null; // Session ID column doesn't exist yet
    }

    const lastMatchData = matchesSheet.getRange(lastRow, 1, 1, matchesSheet.getLastColumn()).getValues()[0];
    const currentSessionId = lastMatchData[sessionIdCol];

    if (!currentSessionId) {
      return null; // No session ID on last match
    }

    // Fetch session data from Sessions and SessionPlayers sheets
    const sessionsSheet = spreadsheet.getSheetByName('Sessions');
    const sessionPlayersSheet = spreadsheet.getSheetByName('SessionPlayers');

    if (!sessionsSheet || !sessionPlayersSheet) {
      // Fallback: compute stats directly from Matches sheet
      return computeCurrentSessionFromMatches(matchesSheet, currentSessionId);
    }

    // Get session metadata from Sessions sheet
    const sessionData = findSessionInSheet(sessionsSheet, currentSessionId);

    // Get player stats from SessionPlayers sheet
    const playerStats = findSessionPlayersInSheet(sessionPlayersSheet, currentSessionId);

    // Get last match info
    const lastMatchInfo = {
      timestamp: lastMatchData[timestampCol],
      whitePlayer: lastMatchData[headers.indexOf('White Player')],
      blackPlayer: lastMatchData[headers.indexOf('Black Player')],
      winner: lastMatchData[headers.indexOf('Winner')],
      venue: lastMatchData[venueCol]
    };

    return {
      sessionId: currentSessionId,
      venue: lastMatchInfo.venue,
      startTime: sessionData.startTime,
      matchCount: sessionData.matchCount,
      playerStats: playerStats,
      lastMatch: lastMatchInfo
    };

  } catch (error) {
    logEvent('get_current_session_error', { error: error.toString() });
    return null;
  }
}

/**
 * Helper: Find session data in Sessions sheet
 */
function findSessionInSheet(sheet, sessionId) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sessionIdCol = headers.indexOf('Session ID');

  for (let i = 1; i < data.length; i++) {
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
 */
function findSessionPlayersInSheet(sheet, sessionId) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sessionIdCol = headers.indexOf('Session ID');
  const playerStats = [];

  for (let i = 1; i < data.length; i++) {
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
 */
function computeCurrentSessionFromMatches(sheet, sessionId) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const config = getConfig();

  // Find all matches with this session ID
  const sessionMatches = [];
  const sessionIdCol = headers.indexOf('Session ID');

  for (let i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === sessionId) {
      sessionMatches.push(data[i]);
    }
  }

  if (sessionMatches.length === 0) {
    return null;
  }

  // Compute stats
  const startTime = sessionMatches[0][0]; // First match timestamp
  const venue = sessionMatches[0][headers.indexOf('Venue')];
  const matchCount = sessionMatches.length;

  // Compute per-player stats
  const playerStats = {};
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
    const whitePlayer = match[headers.indexOf('White Player')];
    const blackPlayer = match[headers.indexOf('Black Player')];
    const winner = match[headers.indexOf('Winner')];
    const brutality = parseInt(match[headers.indexOf('Brutality')] || 0);

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
      const winnerPlayer = (winner === 'White') ? whitePlayer : blackPlayer;
      const loserPlayer = (winner === 'White') ? blackPlayer : whitePlayer;

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
  const playerStatsArray = [];
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

  return {
    sessionId: sessionId,
    venue: venue,
    startTime: startTime,
    matchCount: matchCount,
    playerStats: playerStatsArray,
    lastMatch: {
      timestamp: sessionMatches[sessionMatches.length - 1][0],
      whitePlayer: sessionMatches[sessionMatches.length - 1][headers.indexOf('White Player')],
      blackPlayer: sessionMatches[sessionMatches.length - 1][headers.indexOf('Black Player')],
      winner: sessionMatches[sessionMatches.length - 1][headers.indexOf('Winner')],
      venue: venue
    }
  };
}
```

### Client-Side Implementation (index.html)

```html
<!-- Add this section at the top of the form, after the header -->
<div id="current-session-container" style="margin-bottom: 20px;">
  <div class="session-header" onclick="toggleSessionDisplay()">
    <h3 style="margin: 0; display: inline;">📊 Current Session</h3>
    <button type="button" id="refresh-session-btn" onclick="loadCurrentSession(event)" style="float: right;">
      🔄 Refresh
    </button>
  </div>

  <div id="session-content" class="session-content">
    <div id="session-loading" style="text-align: center; padding: 20px; display: none;">
      Loading session data...
    </div>

    <div id="session-data" style="display: none;">
      <!-- Session metadata -->
      <div class="session-meta">
        <p><strong>🏠 Venue:</strong> <span id="session-venue">-</span></p>
        <p><strong>⏱️ Started:</strong> <span id="session-start-time">-</span> (<span id="session-duration">-</span>)</p>
        <p><strong>🎮 Matches:</strong> <span id="session-match-count">0</span></p>
      </div>

      <!-- Player stats table -->
      <div class="session-stats">
        <h4>Player Stats:</h4>
        <table id="session-stats-table" class="stats-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Games</th>
              <th>Wins</th>
              <th>Losses</th>
              <th>Draws</th>
              <th>Inflicted</th>
              <th>Suffered</th>
            </tr>
          </thead>
          <tbody id="session-stats-body">
            <!-- Populated dynamically -->
          </tbody>
        </table>
      </div>

      <!-- Last match -->
      <div class="session-last-match">
        <p id="session-last-match-text" style="font-style: italic; color: #666;">
          <!-- Populated dynamically -->
        </p>
      </div>
    </div>

    <div id="session-no-data" style="text-align: center; padding: 20px; color: #666; display: none;">
      No active session. Start logging matches to begin a new session!
    </div>

    <div id="session-error" style="text-align: center; padding: 20px; color: #d9534f; display: none;">
      Failed to load session data. Please try again.
    </div>
  </div>
</div>

<style>
.session-header {
  background: #4a90e2;
  color: white;
  padding: 15px;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  user-select: none;
}

.session-content {
  border: 1px solid #4a90e2;
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 15px;
  background: #f9f9f9;
}

.session-content.collapsed {
  display: none;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  background: white;
}

.stats-table th,
.stats-table td {
  padding: 8px 12px;
  text-align: center;
  border: 1px solid #ddd;
}

.stats-table th {
  background: #4a90e2;
  color: white;
  font-weight: bold;
}

.stats-table tbody tr:nth-child(even) {
  background: #f2f2f2;
}

.stats-table tbody tr:hover {
  background: #e8f4ff;
}

#refresh-session-btn {
  background: white;
  color: #4a90e2;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

#refresh-session-btn:hover {
  background: #e8f4ff;
}

#refresh-session-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .stats-table {
    font-size: 12px;
  }

  .stats-table th,
  .stats-table td {
    padding: 6px 4px;
  }
}
</style>

<script>
var sessionDisplayCollapsed = false;

function toggleSessionDisplay() {
  var content = document.getElementById('session-content');
  sessionDisplayCollapsed = !sessionDisplayCollapsed;

  if (sessionDisplayCollapsed) {
    content.classList.add('collapsed');
  } else {
    content.classList.remove('collapsed');
  }
}

function loadCurrentSession(event) {
  if (event) {
    event.stopPropagation(); // Prevent toggle when clicking refresh
  }

  // Show loading state
  var loading = document.getElementById('session-loading');
  var data = document.getElementById('session-data');
  var noData = document.getElementById('session-no-data');
  var error = document.getElementById('session-error');
  var refreshBtn = document.getElementById('refresh-session-btn');

  loading.style.display = 'block';
  data.style.display = 'none';
  noData.style.display = 'none';
  error.style.display = 'none';
  refreshBtn.disabled = true;

  google.script.run
    .withSuccessHandler(function(sessionData) {
      loading.style.display = 'none';
      refreshBtn.disabled = false;

      if (!sessionData) {
        noData.style.display = 'block';
        return;
      }

      // Populate session metadata
      document.getElementById('session-venue').textContent = sessionData.venue || 'Unknown';
      document.getElementById('session-match-count').textContent = sessionData.matchCount || 0;

      // Format start time
      if (sessionData.startTime) {
        var startDate = new Date(sessionData.startTime);
        var now = new Date();
        var diffMs = now - startDate;
        var diffMins = Math.floor(diffMs / 60000);
        var duration = formatDuration(diffMins);

        document.getElementById('session-start-time').textContent = formatTime(startDate);
        document.getElementById('session-duration').textContent = duration + ' ago';
      }

      // Populate player stats table
      var tbody = document.getElementById('session-stats-body');
      tbody.innerHTML = '';

      if (sessionData.playerStats && sessionData.playerStats.length > 0) {
        // Sort by wins descending
        sessionData.playerStats.sort(function(a, b) {
          return b.wins - a.wins;
        });

        sessionData.playerStats.forEach(function(stat) {
          var row = tbody.insertRow();
          row.insertCell(0).textContent = stat.player;
          row.insertCell(1).textContent = stat.matches;
          row.insertCell(2).textContent = stat.wins;
          row.insertCell(3).textContent = stat.losses;
          row.insertCell(4).textContent = stat.draws;
          row.insertCell(5).textContent = stat.inflicted;
          row.insertCell(6).textContent = stat.suffered;
        });
      } else {
        var row = tbody.insertRow();
        var cell = row.insertCell(0);
        cell.colSpan = 7;
        cell.textContent = 'No player stats available';
        cell.style.textAlign = 'center';
        cell.style.fontStyle = 'italic';
        cell.style.color = '#666';
      }

      // Format last match text
      if (sessionData.lastMatch) {
        var lastMatch = sessionData.lastMatch;
        var matchDate = new Date(lastMatch.timestamp);
        var timeSince = formatTimeSince(matchDate);
        var resultText = '';

        if (lastMatch.winner === 'Draw') {
          resultText = lastMatch.whitePlayer + ' (White) drew with ' + lastMatch.blackPlayer + ' (Black)';
        } else {
          var winner = (lastMatch.winner === 'White') ? lastMatch.whitePlayer : lastMatch.blackPlayer;
          var loser = (lastMatch.winner === 'White') ? lastMatch.blackPlayer : lastMatch.whitePlayer;
          resultText = winner + ' (' + lastMatch.winner + ') defeated ' + loser;
        }

        document.getElementById('session-last-match-text').textContent =
          'Last match: ' + resultText + ' - ' + timeSince;
      }

      data.style.display = 'block';
    })
    .withFailureHandler(function(err) {
      loading.style.display = 'none';
      error.style.display = 'block';
      refreshBtn.disabled = false;
      console.error('Failed to load session data:', err);
    })
    .getCurrentSessionData();
}

function formatTime(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return hours + ':' + minutes + ' ' + ampm;
}

function formatDuration(minutes) {
  if (minutes < 60) {
    return minutes + ' min' + (minutes !== 1 ? 's' : '');
  }
  var hours = Math.floor(minutes / 60);
  var mins = minutes % 60;
  return hours + 'h ' + mins + 'm';
}

function formatTimeSince(date) {
  var now = new Date();
  var diffMs = now - date;
  var diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + ' min' + (diffMins !== 1 ? 's' : '') + ' ago';

  var diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    var mins = diffMins % 60;
    return diffHours + 'h ' + mins + 'm ago';
  }

  return 'over a day ago';
}

// Load session data on page load
window.addEventListener('load', function() {
  loadCurrentSession();
});

// Also refresh after successful form submission
// (Add this to the existing form submission success handler)
function onFormSubmitSuccess(response) {
  // ... existing success handling code ...

  // Refresh session display
  loadCurrentSession();
}
</script>
```

## Implementation Phases

### Phase 1: Basic Display (MVP)
- Server function `getCurrentSessionData()`
- Client-side UI with manual refresh
- Display session metadata and player stats
- No fancy animations or auto-refresh

### Phase 2: Enhanced UX
- Auto-refresh after form submission
- Collapsible section (expand/collapse)
- Loading animations
- Better error handling and messages

### Phase 3: Advanced Features
- Highlight winning player in table
- Show win rate percentages
- Chart/graph visualization (optional)
- Export session summary

## Testing Checklist

- [ ] Load form with no matches - should show "No active session"
- [ ] Load form with existing session - should display stats
- [ ] Submit new match - session display should auto-refresh
- [ ] Click refresh button - should reload data
- [ ] Test with 1, 2, and 3+ players in session
- [ ] Test with Draw results
- [ ] Test with different brutality values
- [ ] Test venue display
- [ ] Test time formatting (minutes, hours)
- [ ] Test mobile responsive layout
- [ ] Test error handling (network failure)
- [ ] Test performance with 20+ matches in session

## Performance Considerations

1. **Caching Strategy**
   - Cache session data for 30 seconds on client side
   - Invalidate cache on form submission
   - Reduce server calls for rapid refreshes

2. **Query Optimization**
   - Use existing Sessions/SessionPlayers sheets (already computed)
   - Fall back to Matches sheet only if summary sheets don't exist
   - Consider adding indexes if query becomes slow

3. **Lazy Loading**
   - Don't load session data until user expands the section (optional)
   - Prioritize form functionality over stats display

## Future Enhancements

- **Real-time sync**: Use a polling mechanism to check for updates from other devices
- **Session history**: Show previous sessions in a dropdown
- **Match-by-match timeline**: Show each match in chronological order
- **Brutality heatmap**: Visual representation of brutality levels
- **Win streak indicator**: Highlight current win streaks
- **Session goals**: Set and track session goals (e.g., "First to 5 wins")

## Notes

- Feature should be **optional** and not interfere with core functionality
- Should work even if Sessions/SessionPlayers sheets are manually deleted
- Must handle the case where session is ongoing across multiple form loads
- Consider adding a "End Session" button to manually close a session
