# Chess Game Tracker - Google Apps Script Edition

![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285f4?style=flat&logo=google&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![No Dependencies](https://img.shields.io/badge/Dependencies-None-green.svg)

A Google Apps Script-optimized chess game tracker that logs your games and analyzes your performance over time. Uses proven Google Apps Script patterns for reliable deployment and data storage in Google Sheets.

## ✨ Key Features

- **♟️ Complete Game Logging**: Track opponent, result, ratings, time control, and platform
- **📊 Rating Tracking**: Monitor both your rating and opponent ratings (0-4000 range)
- **⏱️ Time Control Support**: From bullet to classical and correspondence games
- **🎯 Result Analysis**: Win/Loss/Draw tracking with visual feedback
- **📖 Opening Tracking**: Record which openings you played
- **📝 Game Notes**: Add insights and key moments from each game
- **📱 Mobile-Friendly**: Responsive design works on all devices
- **🔒 Reliable Design**: Uses only proven Google Apps Script patterns
- **📊 Direct Google Sheets Integration**: No external APIs - direct server-side sheet writing

## 🚀 Quick Start - Google Apps Script Deployment

### Prerequisites

- Google Account (for Apps Script and Sheets)

### Deployment Instructions

1. **Open Google Apps Script**:
   - Go to [script.google.com](https://script.google.com)
   - Click "New Project"

2. **Replace the Server Code**:
   - Select all default code in `Code.gs` and delete it
   - Copy entire contents of `code.gs` from this repository
   - Paste into Google Apps Script editor
   - Save (Ctrl/Cmd + S)

3. **Add the HTML File**:
   - Click "+" next to "Files" → Select "HTML"
   - Name it exactly "index" (no file extension)
   - Delete any default content
   - Copy entire contents of `index.html` from this repository
   - Paste into the HTML editor
   - Save (Ctrl/Cmd + S)

4. **Deploy as Web App**:
   - Click "Deploy" → "New deployment"
   - Click gear icon ⚙️ next to "Type" → Select "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone" (or "Anyone with Google account")
   - Click "Deploy"
   - Authorize when prompted (grant all permissions)
   - Copy the Web app URL

5. **Test the Form**:
   - Visit the deployment URL
   - Fill out and submit a test game
   - Check your Google Drive for the automatically created "Chess Game Data" spreadsheet

## 📁 Project Structure

```
chess-tracker/
├── code.gs                # Server-side Google Apps Script code (DEPLOY THIS)
├── index.html             # Complete HTML form (deploy as "index")
├── appsscript.json        # Google Apps Script configuration
├── README.md              # This file - includes deployment instructions
└── CLAUDE.md              # Developer guidance
```

## 🛠️ Development

Making changes to the form is simple:

### Direct Editing

1. **Clone the repository**:
   ```bash
   git clone https://github.com/texican/personal-web-forms.git
   cd personal-web-forms/chess-tracker
   ```

2. **Edit files directly**:
   - Modify `code.gs` for server-side changes
   - Modify `index.html` for form and styling changes
   - No build process required

3. **Test changes**:
   - Copy updated files to Google Apps Script
   - Deploy and test functionality
   - All files are ready-to-deploy

### Alternative: Google Clasp Workflow

For a more professional development experience, you can use Google Clasp:

```bash
# Install Clasp globally
npm install -g @google/clasp

# Login to your Google account
clasp login

# Create new Apps Script project
clasp create --type standalone --title "Chess Game Tracker"

# Push to Google Apps Script (files are already in correct structure)
clasp push

# Deploy as web app
clasp deploy
```

## 📋 Form Usage

### Form Fields

1. **Opponent** (required): Username or name of your opponent
2. **Result** (required): Win, Loss, or Draw with visual indicators
3. **My Rating**: Your rating before the game (0-4000)
4. **Opponent Rating**: Opponent's rating (0-4000)
5. **Time Control** (required): Bullet, Blitz, Rapid, Classical, or Correspondence
6. **Platform**: Chess.com, Lichess, Chess24, ICC, FICS, Over the Board, or Other
7. **Opening**: Opening played (e.g., Sicilian Defense, Italian Game)
8. **Notes**: Game insights, key moments, what you learned

### Data Storage

The form automatically creates/uses a Google Sheet with columns:
- Timestamp
- Opponent
- Result
- My Rating
- Opponent Rating
- Time Control
- Platform
- Opening
- Notes

## 🔧 Google Apps Script Architecture

### Reliable Design Principles

This form uses **only proven Google Apps Script patterns**:

✅ **Google Apps Script function calls** - Direct server-side function invocation  
✅ **google.script.run API** - Prevents blank page navigation issues  
✅ **Server-side Google Sheets API** - Direct sheet writing without external APIs  
✅ **Simple vanilla JavaScript** - No ES6 modules or modern APIs that fail in GAS  
✅ **Inline event handlers** - Reliable event handling in GAS sandbox  
✅ **Properties Service** - Persistent configuration storage  

### What We DON'T Use (Reliability Issues in GAS)

❌ Modern fetch() API - unreliable in GAS sandbox  
❌ Complex event listeners - often fail in GAS environment  
❌ ES6 modules - not supported in GAS HTML service  
❌ External API calls - unnecessary and unreliable  
❌ Modern JavaScript frameworks - too complex for GAS  

### Server-Side Features

- **Robust error handling** with detailed logging
- **Input validation** with length limits and required field checks  
- **Automatic spreadsheet creation** if none exists
- **Fallback spreadsheet logic** if access issues occur
- **Properties Service integration** for configuration persistence
- **Rate limiting** with 1-second cooldown using Script Properties
- **Rating validation** with 0-4000 range clamping

### Script Properties Usage

This application uses Google Apps Script's **Properties Service** for persistent storage:

#### Rate Limiting
```javascript
// Store last submission timestamp to prevent spam
PropertiesService.getScriptProperties().setProperty('lastSubmission', now.toString());
const lastSubmission = PropertiesService.getScriptProperties().getProperty('lastSubmission');
```

#### Spreadsheet ID Management
```javascript
// Store and retrieve the target spreadsheet ID
PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheetId);
let spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
```

**Properties Stored:**
- `SPREADSHEET_ID` - ID of the Google Sheet used for data storage
- `lastSubmission` - Timestamp of last form submission for rate limiting

### Using a Pre-existing Google Sheet

To configure the form to use your existing Google Sheet instead of creating a new one:

#### Method 1: Set Script Properties (Recommended)
1. **Get your Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/1ABC123xyz.../edit
                                    ^^^^^^^^^^^
                                    This is your Sheet ID
   ```

2. **Set the Script Property** in Google Apps Script:
   - Open your Apps Script project
   - Go to **Project Settings** (gear icon)
   - Scroll to **Script Properties**
   - Click **Add script property**
   - Property: `SPREADSHEET_ID`
   - Value: `1ABC123xyz...` (your actual Sheet ID)
   - Click **Save script property**

#### Method 2: Modify Code Default
Alternatively, edit the `DEFAULT_SPREADSHEET_ID` in `code.gs`:
```javascript
const DEFAULT_SPREADSHEET_ID = '1ABC123xyz...'; // Replace with your Sheet ID
```

#### Sheet Requirements
Your existing sheet should have these column headers (will be added automatically if missing):
- Timestamp | Opponent | Result | My Rating | Opponent Rating | Time Control | Platform | Opening | Notes

## 🔒 Security & Validation

### Client-Side Protection
- Input length limits (100 chars for opponent, 500 for notes)
- Required field validation with user feedback
- Rating validation (0-4000 range)
- Form sanitization before submission

### Server-Side Protection  
- Parameter validation in `addRow()`
- Data type checking and conversion
- Rating clamping to valid ranges
- Error logging for debugging
- Safe spreadsheet operations

## 🐛 Troubleshooting

### Common Issues

1. **Form goes to blank page**:
   - ✅ Fixed: Uses google.script.run API for seamless submission

2. **Submit button doesn't work**:
   - ✅ Fixed: Uses Google Apps Script function calls + inline handlers

3. **No data in spreadsheet**:
   - Check Google Apps Script execution logs
   - Verify deployment permissions (Execute as: Me, Access: Anyone)
   - Check your Google Drive for "Chess Game Data" spreadsheet

4. **Permission errors**:
   - Make sure Google Apps Script has Google Sheets API access
   - Redeploy and reauthorize if needed

## 🎯 Why This Approach Works

This chess tracker succeeds where others fail because it:

1. **Follows Google Apps Script limitations** instead of fighting them
2. **Uses only proven patterns** that work reliably in the GAS environment  
3. **Eliminates modern JavaScript** that breaks in GAS sandbox
4. **Provides reliable form submission** with google.script.run API
5. **Handles all edge cases** with proper error handling and fallbacks

## 📊 Analytics and Insights

With your game data in Google Sheets, you can easily:

- **Track rating progress** over time
- **Analyze win rates** by time control
- **Study opening performance** - which openings work best for you
- **Platform comparison** - performance across different chess sites
- **Opponent analysis** - track results against specific players
- **Time control preferences** - see where you perform best

## 🤝 Contributing

1. Fork the repository
2. Make changes directly to `code.gs` and/or `index.html`
3. Test deployment in Google Apps Script
4. Submit pull request

### Development Guidelines

- All changes must work in Google Apps Script environment
- Test deployments before submitting changes
- Maintain compatibility with proven GAS patterns
- Update documentation when changing functionality

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Issues**: [GitHub Issues](https://github.com/texican/personal-web-forms/issues)
- **Deployment Help**: See deployment section above for detailed instructions
- **Google Apps Script Docs**: [developers.google.com/apps-script](https://developers.google.com/apps-script)

## 🏗️ Built With

- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (GAS-compatible)
- **Backend**: Google Apps Script (V8 runtime)
- **Storage**: Google Sheets API
- **Architecture**: Simple, reliable GAS patterns
- **Deployment**: Direct file copying (no build process)

---

**Track your chess journey with reliable Google Apps Script deployment! ♟️**