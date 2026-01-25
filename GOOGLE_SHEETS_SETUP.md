# Google Sheets Setup Guide

This guide explains how to set up and use the Google Sheets integration for SpeechEQ Arena.

## Prerequisites

1. A Google Sheet with two tabs: **"Questions"** and **"Responses"**
2. Google Apps Script project with the code from `GOOGLE_SCRIPT_WITH_FEEDBACK.js`
3. Your `questions.json` file hosted and accessible via URL (e.g., on GitHub Pages)

## Initial Setup

### Step 1: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Create two tabs:
   - **"Questions"** (will be auto-populated)
   - **"Responses"** (will be auto-populated)
4. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`

### Step 2: Set Up Google Apps Script

1. Go to [Google Apps Script](https://script.google.com)
2. Create a new project
3. Paste the code from `GOOGLE_SCRIPT_WITH_FEEDBACK.js`
4. Update the configuration:
   ```javascript
   const SHEET_ID = 'YOUR_SHEET_ID'; // Replace with your actual sheet ID
   ```
   And in the `syncQuestionsFromJSON()` function:
   ```javascript
   const QUESTIONS_JSON_URL = 'YOUR_QUESTIONS_JSON_URL'; // e.g., 'https://yourusername.github.io/SpeechEQ-Arena/questions.json'
   ```

### Step 3: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type" → **Web app**
3. Configure:
   - **Description**: "SpeechEQ Arena API"
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**
5. Copy the **Web app URL** (this is your `GOOGLE_FORM_URL`)

### Step 4: Initial Sync - Run `syncQuestionsFromJSON()`

1. In the Apps Script editor, select `syncQuestionsFromJSON` from the function dropdown (top toolbar)
2. Click **Run** ▶️
3. If prompted, click **Review Permissions** → **Allow**
4. Check the execution log:
   - Click **View** → **Logs** (or press `Ctrl+Enter` / `Cmd+Enter`)
   - You should see messages like:
     ```
     Fetching questions.json from: https://...
     Added new question: 20251208_160022_000001_213287e3
     Sync complete. New questions added: 10
     ```
5. Verify in your Google Sheet:
   - Open the **"Questions"** tab
   - You should see all questions from `questions.json` with assignment counts set to 0

## How It Works

### Questions Tab Structure
- **Column A**: Question ID
- **Column B**: Assignment Count (how many times this question has been assigned)

### Responses Tab Structure
- **Columns**: Timestamp, Email, Native Speaker, Q1_ID, Q1_Q1, Q1_Q2, ..., Feedback
- One row per user submission

### Workflow

1. **User starts study**: Frontend calls `GET ?action=getQuestions&count=10`
   - Returns 10 question IDs with the least assignment count

2. **User completes study**: Frontend calls `POST` with submission data
   - Records response in **"Responses"** tab
   - Increments assignment count in **"Questions"** tab for each question

3. **Adding new questions**: Run `syncQuestionsFromJSON()` again
   - Adds new questions from `questions.json`
   - Preserves existing assignment counts (doesn't delete or reset)

## Running `syncQuestionsFromJSON()` Again

You can run `syncQuestionsFromJSON()` whenever you update `questions.json`:

1. Open Google Apps Script editor
2. Select `syncQuestionsFromJSON` from function dropdown
3. Click **Run** ▶️
4. Check logs to see how many new questions were added

**Note**: This function only **adds** new questions. It never deletes existing questions or resets their assignment counts.

## Troubleshooting

### "Script function not found"
- Make sure you've saved the script file
- Check that the function name is exactly `syncQuestionsFromJSON`

### "Authorization required"
- Click **Review Permissions** → **Allow**
- You may need to click "Advanced" → "Go to [Project Name] (unsafe)" if Google shows a warning

### "Failed to fetch questions.json"
- Verify the `QUESTIONS_JSON_URL` is correct and accessible
- Make sure the URL is publicly accessible (no authentication required)
- Test the URL in a browser to confirm it returns valid JSON

### "Sheet not found"
- Verify the `SHEET_ID` is correct
- Make sure the sheet exists and you have access to it

## Optional: Set Up Automatic Sync

You can set up a time-driven trigger to automatically sync questions periodically:

1. In Apps Script editor, click **Triggers** (clock icon) on the left
2. Click **+ Add Trigger** (bottom right)
3. Configure:
   - **Choose which function to run**: `syncQuestionsFromJSON`
   - **Select event source**: Time-driven
   - **Select type of time based trigger**: Day timer / Week timer / etc.
   - **Select time of day**: Choose a time
4. Click **Save**

This will automatically run `syncQuestionsFromJSON()` on the schedule you set.
