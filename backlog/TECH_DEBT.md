# Technical Debt: API Response Pattern Standardization

This document tracks the work needed to standardize all `google.script.run` callable functions to use consistent error handling and response patterns.

## Problem Statement

Functions called via `google.script.run` currently use inconsistent patterns:
- Some throw errors (causes `google.script.run` to return `null` to client)
- Some return `{ success, message }`, others return data directly
- Some have authorization checks that throw, others return error responses
- Client-side handlers have inconsistent error checking

This inconsistency makes the codebase harder to maintain and debug.

## Target Pattern

### Server-Side (code.gs)

```javascript
function apiFunction(params) {
  // Authorization check (if needed) - return, don't throw
  if (!isScriptOwner()) {
    return { success: false, error: 'Unauthorized' };
  }

  // Validate required params - return, don't throw
  if (!params.required) {
    return { success: false, error: 'Required param missing' };
  }

  try {
    // Business logic here
    var result = doWork(params);

    // Success: flat structure with success flag + payload
    // JSON serialize if complex objects (dates, nested data)
    return JSON.parse(JSON.stringify({
      success: true,
      fieldA: result.fieldA,
      fieldB: result.fieldB
    }));

  } catch (error) {
    logEvent('api_function_error', { error: error.toString() });
    return { success: false, error: error.message || error.toString() };
  }
}
```

### Client-Side (HTML files)

```javascript
google.script.run
  .withSuccessHandler(function(result) {
    if (!result || !result.success) {
      showError(result ? result.error : 'No response from server');
      return;
    }
    // Use result.fieldA, result.fieldB directly
    processData(result);
  })
  .withFailureHandler(function(error) {
    showError('Server error: ' + (error.message || error));
  })
  .apiFunction(params);
```

### Key Principles

1. **Never throw from `google.script.run` functions** - thrown errors can cause null returns
2. **Always include `success` boolean** - client can reliably check success/failure
3. **Flat response structure** - `{ success: true, ...payload }` not `{ success: true, data: {...} }`
4. **JSON serialize complex objects** - `JSON.parse(JSON.stringify(result))` for dates, nested objects
5. **Authorization returns error response** - `return { success: false, error: '...' }` not `throw`
6. **Log errors server-side** - use `logEvent()` before returning error response
7. **Client always checks `result.success`** - before accessing any payload fields

---

## Current State Audit

### Admin Panel Functions (admin-panel.html)

| Function | Current Pattern | Status |
|----------|-----------------|--------|
| `adminGetConfig()` | Returns object directly | Needs update (Phase 1) |
| `adminSaveConfig()` | `{ success, message }` | Correct pattern |
| `adminGetStableVersion()` | `{ stableVersion }` | Needs update (Phase 1) |
| `adminSetStableVersion()` | `{ success, message }` | Correct pattern |
| `adminGetSessions()` | `{ success, ...payload }` | **Done (Phase 0)** |
| `adminGetSessionDetails()` | `{ success, ...payload }` | **Done (Phase 0)** |
| `adminRecomputeSession()` | `{ success, ...payload }` | **Done (Phase 0)** |
| `adminDeleteSession()` | `{ success, ...payload }` | **Done (Phase 0)** |

### Main Form Functions (index.html)

| Function | Current Pattern | Issues |
|----------|-----------------|--------|
| `getConfig()` | Returns object directly | No success flag, throws on error |
| `addRow()` | Returns string or throws | No success flag, throws on validation |
| `getCurrentSessionData()` | Returns object or throws | No success flag |
| `getYearToDateStats()` | Returns object directly | No success flag |
| `getPastSessions()` | Returns array directly | No success flag |
| `uploadPicture()` | Returns URL string or throws | No success flag |

---

## Implementation Phases

### Phase 0: Flatten Recent Changes (Immediate) - COMPLETE
**Scope:** Fix the 4 session functions to use flat structure instead of `data` wrapper

**Files:**
- [x] `code.gs`: `adminGetSessions`, `adminGetSessionDetails`, `adminRecomputeSession`, `adminDeleteSession`
- [x] `admin-panel.html`: Update handlers to access flat structure

**Effort:** Small (undo wrapper, adjust client access)

---

### Phase 1: Complete Admin Panel Standardization
**Scope:** Standardize all admin functions and their client handlers

**Server-side (code.gs):**
- [ ] `adminGetConfig()` - wrap in try/catch, add success flag
- [ ] `adminSaveConfig()` - already good, verify error handling
- [ ] `adminGetStableVersion()` - add success flag, try/catch
- [ ] `adminSetStableVersion()` - already good, verify error handling

**Client-side (admin-panel.html):**
- [ ] Update `loadConfig()` handler for new pattern
- [ ] Update `loadStableVersion()` handler for new pattern
- [ ] Verify all handlers check `result.success`

**Effort:** Medium

---

### Phase 2: Main Form - Read Operations
**Scope:** Standardize read-only functions that don't modify data

**Server-side (code.gs):**
- [ ] `getConfig()` - add success flag, try/catch
- [ ] `getCurrentSessionData()` - add success flag, ensure JSON serialization
- [ ] `getYearToDateStats()` - add success flag
- [ ] `getPastSessions()` - add success flag

**Client-side (index.html):**
- [ ] Update config loading handler
- [ ] Update session stats loading handlers
- [ ] Update session selector population

**Effort:** Medium

---

### Phase 3: Main Form - Write Operations
**Scope:** Standardize functions that modify data (higher risk)

**Server-side (code.gs):**
- [ ] `addRow()` - convert validation throws to error returns, add success flag
- [ ] `uploadPicture()` - add success flag, handle Drive API errors

**Client-side (index.html):**
- [ ] Update form submission handler
- [ ] Update picture upload handler
- [ ] Ensure error messages display correctly

**Effort:** Medium-High (most user-facing, needs thorough testing)

---

### Phase 4: Audit & Documentation
**Scope:** Final verification and documentation

- [ ] Audit all `google.script.run` calls match pattern
- [ ] Update CLAUDE.md with final patterns
- [ ] Remove this tech debt file or mark complete
- [ ] Add automated test coverage for error responses

**Effort:** Small

---

## Testing Checklist

For each phase, verify:

- [ ] Success case returns `{ success: true, ...payload }`
- [ ] Validation error returns `{ success: false, error: '...' }`
- [ ] Server error returns `{ success: false, error: '...' }`
- [ ] Authorization failure returns `{ success: false, error: '...' }`
- [ ] Client shows appropriate error message for each failure type
- [ ] Client handles `null` response gracefully
- [ ] No console errors in browser
- [ ] No uncaught exceptions in Apps Script logs

---

## Notes

- Phase 0 should be done immediately to avoid inconsistent state
- Phases 1-3 can be done incrementally
- Main form changes (Phase 2-3) have higher risk since they affect end users
- Consider deploying after each phase and testing in production
