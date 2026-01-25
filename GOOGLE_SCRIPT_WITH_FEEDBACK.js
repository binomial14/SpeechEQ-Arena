// Google Apps Script Code - Questions and Responses Management
// Replace YOUR_SHEET_ID with your actual Google Sheet ID
// Get it from the URL: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
// 
// The sheet should have two tabs:
// - "Questions": Tracks question IDs and assignment counts
// - "Responses": Records user responses

const SHEET_ID = 'YOUR_SHEET_ID';

// Helper function to get or create sheet by name
function getOrCreateSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    Logger.log('Created new sheet: ' + sheetName);
  }
  return sheet;
}

// Function to sync questions.json to Questions tab
// This will reorder the Questions sheet to match the order in questions.json
// while preserving assignment counts for existing questions
function syncQuestionsFromJSON() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const questionsSheet = getOrCreateSheet(spreadsheet, 'Questions');
    
    // Get questions.json from the web (you'll need to host it or provide URL)
    const QUESTIONS_JSON_URL = 'YOUR_QUESTIONS_JSON_URL'; // e.g., 'https://yourusername.github.io/SpeechEQ-Arena/questions.json'
    
    Logger.log('Fetching questions.json from: ' + QUESTIONS_JSON_URL);
    const response = UrlFetchApp.fetch(QUESTIONS_JSON_URL);
    const questionsData = JSON.parse(response.getContentText());
    
    // Get existing questions and their assignment counts from sheet
    const lastRow = questionsSheet.getLastRow();
    const existingQuestions = {}; // Map: questionId -> assignmentCount
    
    if (lastRow > 1) {
      // Header row exists, read existing data
      const dataRange = questionsSheet.getRange(2, 1, lastRow - 1, 2);
      const dataValues = dataRange.getValues();
      
      for (let i = 0; i < dataValues.length; i++) {
        const questionId = dataValues[i][0];
        const assignmentCount = parseInt(dataValues[i][1] || '0', 10);
        if (questionId && questionId.toString().trim() !== '') {
          existingQuestions[questionId.toString().trim()] = assignmentCount;
        }
      }
      Logger.log('Found ' + Object.keys(existingQuestions).length + ' existing questions in sheet');
    }
    
    // Get questions from questions.json in order
    const questions = questionsData.questions || [];
    Logger.log('Found ' + questions.length + ' questions in questions.json');
    
    // Clear the sheet (except header) and rebuild in the new order
    if (lastRow > 1) {
      // Clear all data rows (keep header)
      questionsSheet.deleteRows(2, lastRow - 1);
    }
    
    // Set up headers
    if (lastRow === 0) {
      questionsSheet.appendRow(['Question ID', 'Assignment Count']);
    }
    
    // Rebuild sheet in the order from questions.json
    let newQuestionsAdded = 0;
    const orderedRows = [];
    
    for (let i = 0; i < questions.length; i++) {
      const questionId = questions[i].id;
      const questionIdStr = questionId.toString().trim();
      
      // Get assignment count: use existing if available, otherwise 0
      const assignmentCount = existingQuestions.hasOwnProperty(questionIdStr) 
        ? existingQuestions[questionIdStr] 
        : 0;
      
      if (assignmentCount === 0 && !existingQuestions.hasOwnProperty(questionIdStr)) {
        newQuestionsAdded++;
        Logger.log('Adding new question: ' + questionIdStr);
      } else {
        Logger.log('Preserving question: ' + questionIdStr + ' with count: ' + assignmentCount);
      }
      
      orderedRows.push([questionIdStr, assignmentCount]);
    }
    
    // Write all rows at once (more efficient)
    if (orderedRows.length > 0) {
      const range = questionsSheet.getRange(2, 1, orderedRows.length, 2);
      range.setValues(orderedRows);
    }
    
    Logger.log('Sync complete. New questions added: ' + newQuestionsAdded);
    Logger.log('Total questions in sheet: ' + orderedRows.length);
    Logger.log('Sheet now follows the order from questions.json');
    
    return {
      success: true,
      newQuestionsAdded: newQuestionsAdded,
      totalQuestions: orderedRows.length,
      preservedCount: Object.keys(existingQuestions).length - newQuestionsAdded
    };
    
  } catch (error) {
    Logger.log('ERROR syncing questions: ' + error.toString());
    Logger.log('Stack: ' + (error.stack || 'No stack trace'));
    return {
      success: false,
      error: error.toString()
    };
  }
}

// GET endpoint: Return 10 questions with least assignment count
function doGet(e) {
  Logger.log('=== GET REQUEST RECEIVED ===');
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const questionsSheet = getOrCreateSheet(spreadsheet, 'Questions');
    
    // Check if requesting questions
    if (e.parameter && e.parameter.action === 'getQuestions') {
      const count = parseInt(e.parameter.count || '10', 10);
      
      const lastRow = questionsSheet.getLastRow();
      
      if (lastRow <= 1) {
        // No questions in sheet, return empty array
        Logger.log('No questions found in Questions sheet');
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            questions: []
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Get all questions with assignment counts
      const dataRange = questionsSheet.getRange(2, 1, lastRow - 1, 2);
      const dataValues = dataRange.getValues();
      
      // Convert to array of objects and filter out empty rows
      const questions = [];
      for (let i = 0; i < dataValues.length; i++) {
        const questionId = dataValues[i][0];
        const assignmentCount = parseInt(dataValues[i][1] || '0', 10);
        if (questionId && questionId.toString().trim() !== '') {
          questions.push({
            id: questionId.toString().trim(),
            assignmentCount: assignmentCount
          });
        }
      }
      
      // Sort by assignment count (ascending)
      questions.sort((a, b) => a.assignmentCount - b.assignmentCount);
      
      // Get first N questions with least assignments
      const selectedQuestions = questions.slice(0, Math.min(count, questions.length));
      
      Logger.log('Selected ' + selectedQuestions.length + ' questions with least assignments');
      
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          questions: selectedQuestions.map(q => q.id)
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Default response
    return ContentService.createTextOutput("Web app is working! Current time: " + new Date().toISOString());
    
  } catch (error) {
    Logger.log('ERROR in doGet: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// POST endpoint: Record responses and update assignment counts
function doPost(e) {
  try {
    Logger.log('=== POST REQUEST RECEIVED ===');
    
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
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const responsesSheet = getOrCreateSheet(spreadsheet, 'Responses');
    const questionsSheet = getOrCreateSheet(spreadsheet, 'Questions');
    
    // Extract user info
    const timestamp = data.timestamp || new Date().toISOString();
    const email = data.email || 'N/A';
    const nativeSpeaker = data.nativeSpeaker || 'N/A';
    const feedback = data.feedback || '';
    const questions = data.questions || [];
    
    // 1. Record responses in Responses tab
    Logger.log('Recording responses in Responses sheet');
    
    // Build header row if first time
    if (responsesSheet.getLastRow() === 0) {
      const headerRow = ['Timestamp', 'Email', 'Native Speaker'];
      // Add columns for each question: q_id, q1bool, q2bool
      for (let i = 0; i < questions.length; i++) {
        headerRow.push(`Q${i+1}_ID`, `Q${i+1}_Q1`, `Q${i+1}_Q2`);
      }
      // Add feedback column at the end
      headerRow.push('Feedback');
      responsesSheet.appendRow(headerRow);
      Logger.log('Headers added to Responses sheet');
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
    responsesSheet.appendRow(dataRow);
    Logger.log('Response recorded in Responses sheet');
    
    // 2. Update assignment counts in Questions tab
    Logger.log('Updating assignment counts in Questions sheet');
    
    const questionsLastRow = questionsSheet.getLastRow();
    
    if (questionsLastRow > 1) {
      // Get all questions from sheet
      const questionsDataRange = questionsSheet.getRange(2, 1, questionsLastRow - 1, 2);
      const questionsDataValues = questionsDataRange.getValues();
      
      // Create a map of question IDs to row indices
      const questionRowMap = {};
      for (let i = 0; i < questionsDataValues.length; i++) {
        const questionId = questionsDataValues[i][0];
        if (questionId) {
          questionRowMap[questionId.toString().trim()] = i + 2; // +2 because row 1 is header, and array is 0-indexed
        }
      }
      
      // Increment assignment count for each question in the submission
      for (let i = 0; i < questions.length; i++) {
        const questionId = questions[i].q_id;
        if (questionId && questionRowMap[questionId]) {
          const rowIndex = questionRowMap[questionId];
          const currentCount = parseInt(questionsSheet.getRange(rowIndex, 2).getValue() || '0', 10);
          const newCount = currentCount + 1;
          questionsSheet.getRange(rowIndex, 2).setValue(newCount);
          Logger.log('Updated question ' + questionId + ': ' + currentCount + ' -> ' + newCount);
        } else {
          Logger.log('Warning: Question ID ' + questionId + ' not found in Questions sheet');
        }
      }
    }
    
    Logger.log('Data saved successfully. Total response rows: ' + responsesSheet.getLastRow());
    
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
