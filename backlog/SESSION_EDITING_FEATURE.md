# Session & Match Editing - Feature Specification

## Overview
Allow admin users to edit session metadata and individual match details directly from the admin panel.

## User Stories

**As an admin**, I want to edit a session's venue, so I can correct mistakes when the wrong venue was selected.

**As an admin**, I want to edit match details (winner, game ending, brutality, notes, players), so I can fix data entry errors without deleting and re-entering matches.

## Feature Requirements

### 1. Edit Session Venue

**UI Location**: Session details modal header

**Editable Fields**:
- Venue (dropdown populated from configured venues)

**Behavior**:
- Click edit icon next to venue name
- Venue becomes editable dropdown
- Save/Cancel buttons appear
- On save: update Sessions sheet + all matches in session
- On cancel: revert to display mode

### 2. Edit Individual Matches

**UI Location**: Session details modal, matches list

**Editable Fields**:
- White Player (dropdown)
- Black Player (dropdown)
- Winner (White/Black/Draw dropdown)
- Game Ending (dropdown: Checkmate, Resignation, etc.)
- Time Limit (number, required if Game Ending is "Time Out")
- Brutality (number 0-10)
- Notes (text)

**Behavior**:
- Click edit icon on match row
- Match row expands to edit form
- Save/Cancel buttons
- On save: update Matches sheet, recompute session stats
- Validation: white != black, winner in valid values

## Technical Design

### Server-Side APIs (code.gs)

```javascript
/**
 * Update session venue
 * @param {string} sessionId - Session to update
 * @param {string} newVenue - New venue name
 * @returns {Object} { success, message } or { success: false, error }
 */
function adminUpdateSession(sessionId, newVenue) {
  // 1. Validate owner
  // 2. Validate venue exists in config
  // 3. Update Sessions sheet venue column
  // 4. Update all Matches with this sessionId
  // 5. Return success
}

/**
 * Update match details
 * @param {number} rowIndex - 1-based row index in Matches sheet
 * @param {Object} updates - Fields to update
 * @returns {Object} { success, message } or { success: false, error }
 */
function adminUpdateMatch(rowIndex, updates) {
  // 1. Validate owner
  // 2. Validate rowIndex exists
  // 3. Validate updates (players exist, winner valid, etc.)
  // 4. Update Matches sheet row
  // 5. Get sessionId from row
  // 6. Recompute session stats
  // 7. Return success
}
```

### Client-Side (admin-panel.html)

**Session Venue Edit**:
- Add edit button next to venue in modal header
- Toggle between display/edit modes
- Call `adminUpdateSession()` on save

**Match Edit**:
- Add edit button to each match row
- Expand row to show edit form
- Call `adminUpdateMatch()` on save
- Refresh modal data after save

## Implementation Phases

### Phase 1: Session Venue Editing (MVP) ✅
- [x] `adminUpdateSession()` API
- [x] Edit button in modal header
- [x] Venue dropdown with configured venues
- [x] Save/cancel functionality
- [x] Success/error feedback

### Phase 2: Match Editing ✅
- [x] `adminUpdateMatch()` API
- [x] Edit button on match rows
- [x] Inline edit form with all fields
- [x] Validation (players, winner, time limit)
- [x] Auto-recompute session stats after save

## Testing Checklist

- [ ] Edit venue - verify Sessions sheet updated
- [ ] Edit venue - verify all session matches updated
- [ ] Edit match winner - verify session stats recomputed
- [ ] Edit match players - verify white != black validation
- [ ] Edit Time Out match - verify time limit required
- [ ] Non-owner cannot access edit APIs
- [ ] Cancel edit - no changes persisted

## Dependencies

- Existing admin panel Sessions tab (complete)
- Existing `adminGetSessionDetails()` API
- Existing `recomputeSessionStats()` function
