# Future Work: Configuration Externalization

This document outlines planned improvements to make the repository fully configurable and clone-friendly for other users.

## Current State (2026-01-08)

✅ **Completed:**
- `.clasp.json` added to `.gitignore` in all repositories
- `.clasp.json.example` templates created for both submodules
- Google Apps Script IDs protected from version control
- Never committed sensitive Script IDs to git history

⚠️ **Still Hardcoded:**
- Player names in chess-tracker
- Venue names in chess-tracker
- Venue-specific feature logic (Mulligan section)

---

## Priority 1: Externalize Player Names (Chess Tracker)

### Current Issue
Player names `['Carey', 'Carlos', 'Jorge']` are hardcoded in 5 locations:

- [chess-tracker/code.gs:333](chess-tracker/code.gs#L333) - `computeSessionStats()` function
- [chess-tracker/code.gs:510](chess-tracker/code.gs#L510) - `saveSessionSummary()` function
- [chess-tracker/index.html:773-775](chess-tracker/index.html#L773-L775) - White Player dropdown
- [chess-tracker/index.html:786-788](chess-tracker/index.html#L786-L788) - Black Player dropdown
- [chess-tracker/index.html:1144,1309](chess-tracker/index.html#L1144) - Validation arrays

### Proposed Solution

**Use Google Apps Script Properties Service:**

1. **Server-side changes** (code.gs):
   ```javascript
   /**
    * Get configuration from Script Properties
    * @returns {Object} Configuration object
    */
   function getConfig() {
     const props = PropertiesService.getScriptProperties();

     return {
       players: (props.getProperty('PLAYERS') || 'Player 1,Player 2').split(',').map(p => p.trim()),
       venues: (props.getProperty('VENUES') || 'Home,Park').split(',').map(v => v.trim()),
       mulliganVenues: (props.getProperty('MULLIGAN_VENUES') || '').split(',').map(v => v.trim()).filter(v => v),
       sessionGapHours: parseInt(props.getProperty('SESSION_GAP_HOURS') || '8')
     };
   }
   ```

2. **Generalize statistics functions:**
   - Modify `computeSessionStats()` to load player list from config
   - Modify `saveSessionSummary()` to iterate over configured players dynamically
   - Remove hardcoded player arrays

3. **Client-side changes** (index.html):
   ```javascript
   // On page load, fetch configuration
   google.script.run
     .withSuccessHandler(function(config) {
       populatePlayerDropdowns(config.players);
       populateVenueDropdown(config.venues);
       setupMulliganLogic(config.mulliganVenues);
     })
     .getConfig();

   function populatePlayerDropdowns(players) {
     const whiteSelect = document.getElementById('white-player');
     const blackSelect = document.getElementById('black-player');

     players.forEach(player => {
       whiteSelect.add(new Option(player, player));
       blackSelect.add(new Option(player, player));
     });
   }
   ```

### Configuration Setup Instructions

Users would set Script Properties via:
1. Google Apps Script Editor → Project Settings → Script Properties
2. Add property: `PLAYERS` = `Alice,Bob,Carol`

---

## Priority 2: Externalize Venue Names (Chess Tracker)

### Current Issue
Venues hardcoded at [chess-tracker/index.html:877-878](chess-tracker/index.html#L877-L878):
```html
<option value="Fortalez del Arroyo Trebol">Fortalez del Arroyo Trebol</option>
<option value="House of Tears">House of Tears</option>
```

Mulligan feature enabled only for "Fortalez del Arroyo Trebol" ([index.html:965](chess-tracker/index.html#L965))

### Proposed Solution

1. Store venues in Script Properties: `VENUES=Home,Park,Cafe`
2. Store mulligan-enabled venues: `MULLIGAN_VENUES=Home`
3. Dynamically populate venue dropdown from `getConfig()`
4. Dynamically show/hide mulligan section based on venue selection

### Implementation

```javascript
function setupMulliganLogic(mulliganVenues) {
  const venueSelect = document.getElementById('venue');
  const mulliganSection = document.getElementById('mulligan-section');

  venueSelect.addEventListener('change', function() {
    if (mulliganVenues.includes(this.value)) {
      mulliganSection.style.display = 'block';
    } else {
      mulliganSection.style.display = 'none';
    }
  });
}
```

---

## Priority 3: Enhanced Documentation

### Files to Create/Update

1. **chess-tracker/SETUP.md** (new)
   - Step-by-step first-time setup guide
   - How to configure Script Properties
   - Screenshots of Script Properties interface
   - Example configurations for different use cases

2. **chess-tracker/README.md** (update)
   - Add "Configuration" section
   - Document all Script Properties
   - Explain `.clasp.json` setup
   - Link to SETUP.md

3. **behavior-log/SETUP.md** (new)
   - Similar setup guide for behavior-log project

### Script Properties Reference Table

| Property Key | Type | Default | Example | Description |
|---|---|---|---|---|
| `SPREADSHEET_ID` | String | (auto-create) | `1abc...xyz` | Target Google Sheet ID |
| `PLAYERS` | Comma-separated | `Player 1,Player 2` | `Alice,Bob,Carol` | Chess player names |
| `VENUES` | Comma-separated | `Home,Park` | `Home,Work,Cafe` | Game location options |
| `MULLIGAN_VENUES` | Comma-separated | (none) | `Home,Backyard` | Venues where mulligans are allowed |
| `SESSION_GAP_HOURS` | Number | `8` | `4` | Hours between matches to start new session |

---

## Priority 4: Behavior-Log Audit

### Actions Required

1. Audit behavior-log submodule for hardcoded personal data
2. Check for similar patterns (player names, locations, etc.)
3. Apply same configuration externalization pattern
4. Document any behavior-log specific configuration

### Potential Issues to Check

- Hardcoded behavior categories or impact types
- Personal location names or context
- Default values that should be configurable

---

## Implementation Phases

### Phase 1: Security (✅ COMPLETED)
- [x] Add `.clasp.json` to `.gitignore` (all repos)
- [x] Create `.clasp.json.example` templates
- [x] Update main repo `.gitignore`

### Phase 2: Configuration System (FUTURE)
- [ ] Design configuration schema (Script Properties)
- [ ] Implement server-side `getConfig()` function
- [ ] Add configuration validation
- [ ] Document Script Properties setup

### Phase 3: Chess Tracker Refactoring (FUTURE)
- [ ] Externalize player names
- [ ] Externalize venue names
- [ ] Make mulligan feature configurable
- [ ] Generalize `computeSessionStats()` for dynamic player lists
- [ ] Generalize `saveSessionSummary()` for dynamic player lists
- [ ] Update client-side to populate dropdowns dynamically
- [ ] Remove all hardcoded player/venue references

### Phase 4: Testing & Documentation (FUTURE)
- [ ] Test with different player/venue configurations
- [ ] Write SETUP.md guides
- [ ] Update README files with configuration instructions
- [ ] Test fresh clone and deployment process
- [ ] Create migration guide for existing users

### Phase 5: Behavior Log (FUTURE - IF NEEDED)
- [ ] Audit for personal data
- [ ] Apply same configuration patterns
- [ ] Document configuration
- [ ] Test and validate

---

## Estimated Effort

| Phase | Files Modified | Files Created | Est. Lines Changed |
|-------|---|---|---|
| Phase 2: Config System | 2 | 0 | ~50 |
| Phase 3: Chess Tracker | 2 | 0 | ~150 |
| Phase 4: Documentation | 3 | 2 | ~200 |
| Phase 5: Behavior Log | 1 | 1 | ~50 |
| **TOTAL** | **8** | **3** | **~450** |

---

## Breaking Changes & Migration

### For Existing Users

When this work is implemented, existing deployments will need to:

1. **Set up Script Properties** (one-time):
   - Open Google Apps Script Editor
   - Go to Project Settings → Script Properties
   - Add required properties (PLAYERS, VENUES, etc.)

2. **Update `.clasp.json`** (if using clasp):
   - Copy `.clasp.json.example` to `.clasp.json`
   - Replace with your Script ID

3. **No data migration required** - existing spreadsheets will continue to work

### Migration Guide Template

```markdown
# Migration Guide: v1.x to v2.0

## What's Changed
- Player and venue names are now configured via Script Properties
- `.clasp.json` is no longer in version control

## Migration Steps
1. Open your Google Apps Script project
2. Click Project Settings (⚙️ icon)
3. Scroll to Script Properties section
4. Add the following properties:
   - Key: `PLAYERS`, Value: `Your,Player,Names`
   - Key: `VENUES`, Value: `Your,Venue,Names`
5. Deploy the updated code
6. Test by submitting a game
```

---

## Testing Requirements

Before marking this work complete, test:

- [ ] Fresh clone experience (new user)
- [ ] Configuration via Script Properties
- [ ] Player list with 2, 3, and 5 players
- [ ] Empty venues list (should allow free text)
- [ ] Session stats with different player names
- [ ] Mulligan feature with different venues
- [ ] Form validation with configured players
- [ ] Statistics computation with dynamic player lists

---

## Optional Future Enhancements

### Configuration UI (Admin Panel)
- Web-based configuration interface
- Edit Script Properties through the web app
- No need to access Apps Script Editor

### Configuration Import/Export
- Export configuration as JSON
- Import configuration from JSON
- Share configuration templates

### Multiple Profiles
- Support multiple player groups
- Switch between configurations
- Tournament mode vs casual mode

### Environment-Based Configuration
- Development vs production settings
- Test data vs real data
- Staged deployments

---

## References

- Original scoping discussion: 2026-01-08
- Related issues: Security & Privacy requirements
- Google Apps Script Properties Service: https://developers.google.com/apps-script/reference/properties

---

**Last Updated:** 2026-01-08
**Status:** Security phase complete, configuration externalization planned for future
