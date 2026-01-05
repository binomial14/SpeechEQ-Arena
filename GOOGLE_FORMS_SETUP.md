# Google Forms Submission Setup

This guide explains how to set up Google Forms to receive submission data from the Speech EQ Arena.

## Option 1: Google Apps Script Web App (Recommended)

This is the most flexible option and allows you to receive structured JSON data.

### Steps:

1. **Create a Google Sheet** (to store the results):
   - Go to [sheets.google.com](https://sheets.google.com)
   - Create a new spreadsheet
   - Name it something like "Speech EQ Arena Results"
   - **Copy the Sheet ID** from the URL: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`
   - Keep this sheet open - you'll see results appear here!

2. **Create a Google Apps Script**:
   - Go to [script.google.com](https://script.google.com)
   - Create a new project
   - Name it "Speech EQ Arena Receiver"
   - Paste the following code (replace `YOUR_SHEET_ID` with the ID you copied):

```javascript
// Replace this with your Google Sheet ID
// Get it from the URL: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
const SHEET_ID = 'YOUR_SHEET_ID';

function doPost(e) {
  try {
    Logger.log('=== NEW REQUEST RECEIVED ===');
    
    let data;
    
    // Handle both form-encoded and JSON data
    if (e.parameter && e.parameter.data) {
      // Form-encoded data (from form submission)
      Logger.log('Parsing form-encoded data');
      data = JSON.parse(e.parameter.data);
    } else if (e.postData && e.postData.contents) {
      // Direct JSON data
      Logger.log('Parsing JSON data');
      data = JSON.parse(e.postData.contents);
    } else {
      throw new Error('No data found in request');
    }
    
    Logger.log('Email: ' + (data.email || 'N/A'));
    Logger.log('Questions: ' + (data.questions?.length || 0));
    
    // Open the Google Sheet
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getActiveSheet();
    
    // Extract user info
    const timestamp = data.timestamp || new Date().toISOString();
    const email = data.email || 'N/A';
    const nativeSpeaker = data.nativeSpeaker || 'N/A';
    
    // Process questions - flatten into one row per user
    const questions = data.questions || [];
    
    Logger.log('Processing ' + questions.length + ' questions for one row');
    
    // Extract feedback
    const feedback = data.feedback || '';
    Logger.log('Feedback: ' + (feedback ? feedback.substring(0, 50) + '...' : 'N/A'));
    
    // Build header row if first time (dynamic based on number of questions)
    if (sheet.getLastRow() === 0) {
      const headerRow = ['Timestamp', 'Email', 'Native Speaker'];
      // Add columns for each question: q_id, q1bool, q2bool
      for (let i = 0; i < questions.length; i++) {
        headerRow.push(`Q${i+1}_ID`, `Q${i+1}_Q1`, `Q${i+1}_Q2`);
      }
      // Add feedback column at the end
      headerRow.push('Feedback');
      sheet.appendRow(headerRow);
    }
    
    // Build data row - one row per user with all questions
    const dataRow = [timestamp, email, nativeSpeaker];
    
    // Add data for each question in order
    questions.forEach((question, index) => {
      const q_id = question.q_id || 'N/A';
      const q1bool = question.q1bool === true ? 'true' : 'false';
      const q2bool = question.q2bool === true ? 'true' : 'false';
      
      Logger.log('Question ' + (index + 1) + ': ' + q_id + ', Q1: ' + q1bool + ', Q2: ' + q2bool);
      
      dataRow.push(q_id, q1bool, q2bool);
    });
    
    // Add feedback at the end
    dataRow.push(feedback);
    
    // Append the single row for this user
    sheet.appendRow(dataRow);
    
    Logger.log('Data saved successfully. Total rows: ' + sheet.getLastRow());
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true, 
        message: 'Data saved successfully',
        rowsAdded: 1
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + (error.stack || 'No stack trace'));
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false, 
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function to verify the script can access the sheet
function testSheetAccess() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getActiveSheet();
    sheet.appendRow(['Test', 'Test', 'Test', 'Test', 'Test']);
    Logger.log('Test successful - sheet is accessible');
    return 'Success';
  } catch (error) {
    Logger.log('Test failed: ' + error.toString());
    return 'Error: ' + error.toString();
  }
}

// Add this function to test if the Web App is receiving requests
function doGet(e) {
  Logger.log('=== GET REQUEST RECEIVED ===');
  Logger.log('Parameters: ' + JSON.stringify(e.parameter));
  return ContentService.createTextOutput('Web app is working! Current time: ' + new Date().toISOString())
    .setMimeType(ContentService.MimeType.TEXT);
}
```

3. **Deploy as Web App**:
   - In the Apps Script editor, click "Deploy" > "New deployment"
   - Click the gear icon ⚙️ next to "Select type"
   - Select type: "Web app"
   - Description: "Speech EQ Arena Data Receiver"
   - Execute as: "Me"
   - Who has access: "Anyone" (required for the app to work)
   - Click "Deploy"
   - **Copy the Web App URL** (looks like: `https://script.google.com/macros/s/.../exec`)
   - Click "Done"

4. **Update the app**:
   - Update `src/App.jsx` directly with your Web App URL:
   ```javascript
   const GOOGLE_FORM_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'
   ```
   - Or create a `.env.local` file for local development:
   ```
   VITE_GOOGLE_FORM_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```

5. **View Results**:
   - Go back to your Google Sheet
   - Results will appear automatically when users submit
   - Each row contains:
     - Timestamp of submission
     - User's email
     - Native speaker status
     - Total questions answered
     - Full submission data (as JSON in the last column)

## Option 2: Google Forms (Alternative)

If you prefer using a standard Google Form (note: this is less ideal for structured JSON data):

1. **Create a Google Form**:
   - Go to [forms.google.com](https://forms.google.com)
   - Create a new form
   - Add fields:
     - Short answer: "Email"
     - Multiple choice: "Native Speaker" (Yes/No)
     - Long answer: "Submission Data"

2. **Get Form Submission URL**:
   - Open the form in edit mode
   - View the page source (right-click > View Page Source)
   - Search for `form action=` to find the submission URL
   - Note: This method requires converting JSON to form-encoded data

3. **View Results**:
   - Go to the "Responses" tab in your Google Form
   - Click the Google Sheets icon to link to a spreadsheet
   - Or view responses directly in the form

## Alternative Method: Direct Form Submission (If fetch doesn't work)

If the fetch method isn't working, the app now uses a form/iframe approach that should be more reliable. However, if you're still having issues, try this alternative Apps Script code that's even simpler:

```javascript
const SHEET_ID = 'YOUR_SHEET_ID';

function doPost(e) {
  try {
    Logger.log('=== REQUEST RECEIVED ===');
    
    // Get data from form parameter
    const dataStr = e.parameter.data || e.postData.contents;
    const data = JSON.parse(dataStr);
    
    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    
    // Extract user info
    const timestamp = data.timestamp || new Date().toISOString();
    const email = data.email || '';
    const nativeSpeaker = data.nativeSpeaker || '';
    
    // Process questions - flatten into one row per user
    const questions = data.questions || [];
    
    // Extract feedback
    const feedback = data.feedback || '';
    
    // Build header row if first time
    if (sheet.getLastRow() === 0) {
      const headerRow = ['Timestamp', 'Email', 'Native Speaker'];
      for (let i = 0; i < questions.length; i++) {
        headerRow.push(`Q${i+1}_ID`, `Q${i+1}_Q1`, `Q${i+1}_Q2`);
      }
      // Add feedback column at the end
      headerRow.push('Feedback');
      sheet.appendRow(headerRow);
    }
    
    // Build data row - one row per user
    const dataRow = [timestamp, email, nativeSpeaker];
    questions.forEach((question) => {
      const q_id = question.q_id || 'N/A';
      const q1bool = question.q1bool === true ? 'true' : 'false';
      const q2bool = question.q2bool === true ? 'true' : 'false';
      dataRow.push(q_id, q1bool, q2bool);
    });
    
    // Add feedback at the end
    dataRow.push(feedback);
    
    sheet.appendRow(dataRow);
    Logger.log('Data saved. One row added for user: ' + email);
    return ContentService.createTextOutput('Success').setMimeType(ContentService.MimeType.TEXT);
    
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    return ContentService.createTextOutput('Error: ' + error.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Web app is working!').setMimeType(ContentService.MimeType.TEXT);
}
```

## Alternative: Simpler Google Apps Script (If above doesn't work)

If the above method isn't working, try this simpler version that handles CORS better:

```javascript
const SHEET_ID = 'YOUR_SHEET_ID';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Email', 'Native Speaker', 'Total Questions', 'Submissions Data']);
    }
    
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.userInfo?.email || '',
      data.userInfo?.nativeSpeaker || '',
      data.totalQuestions || 0,
      JSON.stringify(data.submissions || [])
    ]);
    
    return ContentService.createTextOutput('Success').setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return ContentService.createTextOutput('Error: ' + error.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

// Also add doGet for testing
function doGet(e) {
  return ContentService.createTextOutput('Web app is working!').setMimeType(ContentService.MimeType.TEXT);
}
```

**Important**: After updating the code, you MUST:
1. Save the script (Ctrl+S or Cmd+S)
2. Go to Deploy > Manage deployments
3. Click the pencil icon to edit
4. Click "New version"
5. Click "Deploy"
6. Copy the NEW URL (it might have changed)

## Option 3: Third-party Service

You can also use services like:
- **Formspree**: https://formspree.io
- **Webhook.site**: For testing
- **Zapier Webhooks**: For automation

Update the `GOOGLE_FORM_URL` constant in `src/App.jsx` with your webhook URL.

## Environment Variables

For production deployment on GitHub Pages, you'll need to:

1. Set the environment variable in your build process, or
2. Update the URL directly in `src/App.jsx` before building

Note: GitHub Pages doesn't support server-side environment variables, so you'll need to either:
- Build with the URL baked in, or
- Use a client-side configuration approach

## Testing

To test locally:
1. Set up your Google Apps Script and Google Sheet as described above
2. Create a `.env.local` file with:
   ```
   VITE_GOOGLE_FORM_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```
3. Restart your dev server: `npm run dev`
4. Complete a test submission in the app
5. **Check your Google Sheet** - you should see a new row appear with the test data!

## Troubleshooting: Results Not Appearing

If results aren't showing in your Google Sheet, follow these steps:

### Step 1: Verify Sheet ID
1. Open your Google Sheet
2. Check the URL: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`
3. Copy the `YOUR_SHEET_ID` part (the long string between `/d/` and `/edit`)
4. Make sure it's exactly the same in your Apps Script code (including quotes)

### Step 2: Test Sheet Access
1. In your Apps Script editor, click on the function dropdown
2. Select `testSheetAccess`
3. Click the Run button ▶️
4. Check the Execution log (View > Execution log)
5. If you see an error, the Sheet ID is wrong or you don't have permission

### Step 3: Check Permissions
1. Make sure your Apps Script has permission to access the Sheet
2. When you first run the script, Google will ask for permission
3. Click "Review Permissions" and allow access
4. If you see "This app isn't verified", click "Advanced" > "Go to [Your Project] (unsafe)"

### Step 4: Verify Web App Deployment
1. In Apps Script, go to Deploy > Manage deployments
2. Make sure the Web App is deployed
3. Check that "Who has access" is set to "Anyone"
4. Copy the Web App URL again (it should end with `/exec`)

### Step 5: Check Browser Console
1. Open your app in the browser
2. Open Developer Tools (F12 or Right-click > Inspect)
3. Go to the Console tab
4. Complete a test submission
5. Look for any error messages
6. Check if you see "Submitting data to: [your URL]"

### Step 6: Test if Web App is Working
**FIRST, test if your Web App is accessible:**

1. **Add the `doGet` function** to your Apps Script (see code above)
2. **Save and redeploy** (Deploy > Manage deployments > Edit > New version > Deploy)
3. **Test the URL directly**:
   - Open your Web App URL in a browser (the one ending with `/exec`)
   - You should see: "Web app is working! Current time: [timestamp]"
   - If you see an error, the deployment is wrong

### Step 7: Check Apps Script Logs (CRITICAL)
1. **Before testing**: In Apps Script editor, go to View > Execution log (keep it open)
2. **Test GET request first**: Visit your Web App URL in browser
   - You should see "=== GET REQUEST RECEIVED ===" in the logs
   - If you don't see this, the Web App isn't deployed correctly
3. **Then test POST**: Complete a test submission in your app
4. **Immediately check the Execution log** - you should see:
   - "=== NEW REQUEST RECEIVED ==="
   - "Post data contents: ..."
   - "Parsed data successfully"
   - "Row appended successfully"
5. **If you see NOTHING in the logs**: The request isn't reaching the Apps Script
   - The form/iframe method should work better than fetch
   - Make sure Web App is set to "Anyone" access
   - Try the alternative method below

### Step 7: Manual Test
Test the Web App URL directly:
1. Copy your Web App URL
2. Use a tool like Postman or curl to send a test request:
   ```bash
   curl -X POST "YOUR_WEB_APP_URL" \
     -H "Content-Type: application/json" \
     -d '{"timestamp":"2024-01-01T00:00:00.000Z","userInfo":{"email":"test@test.com","nativeSpeaker":"yes"},"totalQuestions":1,"submissions":[]}'
   ```
3. Check your Google Sheet - a row should appear

### Common Issues:

**Issue: "Script function not found"**
- Make sure the function is named exactly `doPost`
- Make sure you saved the script

**Issue: "Cannot find spreadsheet"**
- Double-check the Sheet ID
- Make sure the Sheet is not deleted or moved to trash
- Make sure you have access to the Sheet

**Issue: "Permission denied"**
- Run the `testSheetAccess` function first to grant permissions
- Make sure you're the owner of the Sheet

**Issue: "CORS error" in browser**
- This is normal with Google Apps Script
- The data should still be submitted (check the Sheet)
- The app uses `no-cors` mode which is correct for Google Apps Script

## Viewing Results

### For Option 1 (Google Apps Script + Google Sheet):

1. **Open your Google Sheet** that you created in step 1
2. **Results appear automatically** - each question creates one row
3. **Column structure**:
   - **Column A: Timestamp** - When the submission was made
   - **Column B: Email** - User's email address
   - **Column C: Native Speaker** - "yes" or "no"
   - **Column D: Question ID** - Unique identifier for each question
   - **Column E: Answer 1 (Correct)** - "true" if user selected the high EQ option (04), "false" if low EQ (05)
   - **Column F: Answer 2 (Correct)** - "true" if user selected the high EQ option (07), "false" if low EQ (08)

4. **Data format**:
   - One row per question answered
   - If a user answers 3 questions, you'll see 3 rows (same timestamp, email, native speaker)
   - Answer columns show "true" for correct (high EQ) selections, "false" for incorrect (low EQ) selections

### Example Data:

```
Timestamp              | Email          | Native | Question ID | Answer 1 | Answer 2
2024-01-01T12:00:00Z  | user@test.com  | yes    | abc123     | true     | false
2024-01-01T12:05:00Z  | user@test.com  | yes    | def456     | false    | true
```

### Tips for Analyzing Data:

- **Filter and sort** by email, timestamp, or native speaker status
- **Count correct answers**: Use `COUNTIF` to count "true" values in Answer columns
- **Export to CSV** for analysis in Excel or other tools
- **Create pivot tables** to analyze performance by native speaker status
- **Create charts** to visualize response patterns

## Data Format

The app sends data in this simplified format:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "email": "user@example.com",
  "nativeSpeaker": "yes",
  "questions": [
    {
      "q_id": "20251208_160022_000001_213287e3",
      "q1bool": true,
      "q2bool": false
    }
  ]
}
```

**Structure:**
- `timestamp`: When the submission was made
- `email`: User's email address
- `nativeSpeaker`: "yes" or "no"
- `questions`: Array of question results
  - `q_id`: Question identifier
  - `q1bool`: Boolean for first choice (true = correct/high EQ, false = incorrect/low EQ)
  - `q2bool`: Boolean for second choice (true = correct/high EQ, false = incorrect/low EQ)

