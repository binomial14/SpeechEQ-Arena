// Google Apps Script Code - Updated to Include Feedback
// Replace YOUR_SHEET_ID with your actual Google Sheet ID
// Get it from the URL: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit

const SHEET_ID = 'YOUR_SHEET_ID';

function doGet(e) {
  Logger.log('=== GET REQUEST RECEIVED ===');
  return ContentService.createTextOutput("Web app is working! Current time: " + new Date().toISOString());
}

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
    Logger.log('Feedback: ' + (data.feedback ? data.feedback.substring(0, 50) + '...' : 'N/A'));
    
    // Open the Google Sheet
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getActiveSheet();
    
    // Extract user info
    const timestamp = data.timestamp || new Date().toISOString();
    const email = data.email || 'N/A';
    const nativeSpeaker = data.nativeSpeaker || 'N/A';
    const feedback = data.feedback || '';
    
    // Process questions - flatten into one row per user
    const questions = data.questions || [];
    
    Logger.log('Processing ' + questions.length + ' questions for one row');
    
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
      Logger.log('Headers added: ' + headerRow.join(', '));
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
    Logger.log('Row data: ' + dataRow.join(', '));
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true, 
        message: 'Data saved successfully'
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('=== ERROR OCCURRED ===');
    Logger.log('Error message: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false, 
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

