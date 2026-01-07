# Changelog

All notable changes to the Chess Game Tracker project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-13

### Added
- Complete chess game tracking form with Google Apps Script backend
- Opponent name tracking with validation
- Game result selection (Win/Loss/Draw) with visual indicators
- Rating tracking for both player and opponent (0-4000 range)
- Time control selection (Bullet, Blitz, Rapid, Classical, Correspondence)
- Platform tracking (Chess.com, Lichess, Chess24, ICC, FICS, OTB, Other)
- Opening tracking with free text input
- Game notes for insights and analysis
- Automatic Google Sheets integration with "Chess Game Data" spreadsheet
- Mobile-responsive design with dark mode support
- Rate limiting with 1-second cooldown
- Comprehensive error handling and validation
- Properties Service integration for persistent configuration
- Fallback spreadsheet creation and management
- Client-side validation with floating error messages
- Visual feedback for form submission states
- Brown/orange chess-themed color scheme
- Inline CSS and JavaScript for single-file deployment
- Comprehensive deployment documentation
- Developer guidance documentation (CLAUDE.md)
- MIT License
- Google Apps Script configuration (appsscript.json)

### Technical Features
- Proven Google Apps Script patterns for maximum reliability
- Server-side input validation and sanitization
- Automatic header creation for new spreadsheets
- Structured logging for debugging and monitoring
- Cross-browser compatibility including mobile browsers
- No external dependencies - pure Google Apps Script

### Security
- Input length validation (opponent: 100 chars, notes: 500 chars)
- Rating range validation and clamping (0-4000)
- Required field validation
- XSS prevention through proper input handling
- Rate limiting to prevent spam submissions