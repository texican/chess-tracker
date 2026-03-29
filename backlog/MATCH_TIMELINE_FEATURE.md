# Match-by-Match Timeline - Feature Specification

## Overview
Display a chronological timeline of individual matches within a session, showing game-by-game progression.

## User Story
**As a chess player**, I want to see a timeline of all matches in the current session, so that I can review the flow of games and see momentum shifts.

## Feature Requirements

### Functional Requirements

1. **Timeline Display**
   - Show each match in chronological order
   - Display key match info: players, winner, time, game ending
   - Visual indicators for win/loss/draw per match
   - Collapsible/expandable for space efficiency

2. **Match Details**
   - White/Black player names with color indicators
   - Winner highlighted (or "Draw" indicator)
   - Game ending type (Checkmate, Resignation, Time Out, etc.)
   - Time since match (relative timestamp)
   - Brutality level indicator
   - Optional: Picture thumbnail if uploaded

3. **Session Context**
   - Group matches by session
   - Show session boundaries clearly
   - Running score/standings after each match
   - Win streak indicators

4. **Interactivity**
   - Click to expand match details
   - Filter by player
   - Filter by result type
   - Jump to specific match

### Non-Functional Requirements

1. **Performance**
   - Lazy load matches (pagination or infinite scroll)
   - Efficient rendering for 50+ match sessions
   - Minimal impact on form load time

2. **Responsiveness**
   - Mobile-friendly compact view
   - Horizontal timeline on desktop (optional)
   - Vertical list on mobile

## UI Concepts

### Vertical Timeline (Mobile-First)
```
┌─────────────────────────────────────────┐
│ 📍 Session Timeline                     │
├─────────────────────────────────────────┤
│ ● 3:45 PM                               │
│ │ 🟣 Carlos vs 🔵 Carey                 │
│ │ White wins by Checkmate ⚔️3           │
│ │ Carlos leads 3-2                      │
│ │                                       │
│ ● 3:32 PM                               │
│ │ 🔵 Carey vs 🟢 Jorge                  │
│ │ Draw by Stalemate                     │
│ │                                       │
│ ● 3:18 PM                               │
│ │ 🟢 Jorge vs 🟣 Carlos                 │
│ │ Black wins by Resignation ⚔️2         │
│ │ Carlos leads 2-2                      │
│ │                                       │
│ ● 3:05 PM (Session Start)               │
│ │ 🟣 Carlos vs 🟢 Jorge                 │
│ │ White wins by Time Out ⚔️1            │
│ │ Carlos leads 1-0                      │
└─────────────────────────────────────────┘
```

### Compact Row View
```
┌──────┬─────────────────┬────────┬─────┐
│ Time │ Match           │ Result │ ⚔️  │
├──────┼─────────────────┼────────┼─────┤
│ 3:45 │ Carlos v Carey  │ W wins │ 3   │
│ 3:32 │ Carey v Jorge   │ Draw   │ 0   │
│ 3:18 │ Jorge v Carlos  │ B wins │ 2   │
│ 3:05 │ Carlos v Jorge  │ W wins │ 1   │
└──────┴─────────────────┴────────┴─────┘
```

## Technical Design

### Server-Side (code.gs)

```javascript
/**
 * Get matches for a session in chronological order
 * @param {string} sessionId - Session ID to fetch matches for
 * @returns {Array} Array of match objects
 */
function getSessionMatches(sessionId) {
  var spreadsheet = getOrCreateSpreadsheet();
  var matchesSheet = spreadsheet.getSheetByName('Matches');

  if (!matchesSheet || matchesSheet.getLastRow() <= 1) {
    return [];
  }

  var data = matchesSheet.getDataRange().getValues();
  var headers = data[0];
  var sessionIdCol = headers.indexOf('Session ID');

  var matches = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === sessionId) {
      matches.push({
        timestamp: data[i][0],
        whitePlayer: data[i][headers.indexOf('White Player')],
        blackPlayer: data[i][headers.indexOf('Black Player')],
        winner: data[i][headers.indexOf('Winner')],
        gameEnding: data[i][headers.indexOf('Game Ending')],
        brutality: data[i][headers.indexOf('Brutality')],
        pictureUrl: data[i][headers.indexOf('Picture URL')] || null
      });
    }
  }

  // Sort by timestamp ascending (oldest first)
  matches.sort(function(a, b) {
    return new Date(a.timestamp) - new Date(b.timestamp);
  });

  return matches;
}
```

### Client-Side (index.html)

```javascript
function loadSessionTimeline(sessionId) {
  google.script.run
    .withSuccessHandler(function(matches) {
      renderTimeline(matches);
    })
    .withFailureHandler(function(err) {
      console.error('Failed to load timeline:', err);
    })
    .getSessionMatches(sessionId);
}

function renderTimeline(matches) {
  var container = document.getElementById('timeline-container');
  container.innerHTML = '';

  var runningScores = {};

  matches.forEach(function(match, index) {
    // Update running scores
    updateRunningScores(runningScores, match);

    // Create timeline entry
    var entry = createTimelineEntry(match, runningScores, index === 0);
    container.appendChild(entry);
  });
}
```

## Implementation Phases

### Phase 1: Basic Timeline (MVP)
- [ ] Server function `getSessionMatches(sessionId)`
- [ ] Simple vertical list of matches
- [ ] Basic match info (players, winner, time)
- [ ] Integration with existing session display

### Phase 2: Enhanced Display
- [ ] Running score after each match
- [ ] Win streak indicators
- [ ] Brutality display
- [ ] Picture thumbnails
- [ ] Relative timestamps ("5 min ago")

### Phase 3: Interactivity
- [ ] Expandable match details
- [ ] Filter by player
- [ ] Filter by result
- [ ] Pagination for large sessions

## Testing Checklist

- [ ] Load timeline with no matches - should show empty state
- [ ] Load timeline with 1 match
- [ ] Load timeline with 10+ matches
- [ ] Verify chronological order (oldest first)
- [ ] Test running score calculation
- [ ] Test with Draw results
- [ ] Test mobile responsive layout
- [ ] Test performance with 50+ matches

## Dependencies

- Requires current session display feature (complete)
- Uses existing Matches sheet schema
- Integrates with session selector dropdown

## Future Enhancements

- Horizontal timeline view for desktop
- Match comparison (side-by-side)
- Export timeline as image
- Animated timeline playback
- Push notifications for new matches (multi-device)
