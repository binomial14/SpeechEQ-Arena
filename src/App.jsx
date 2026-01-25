import { useState, useEffect } from 'react'

// Google Form submission URL - Update this with your Google Form URL
// To get this: Create a Google Form, go to Settings > Responses > Get pre-filled link
// Or use Google Apps Script to create a web app that accepts POST requests
const GOOGLE_FORM_URL = import.meta.env.VITE_GOOGLE_FORM_URL ||'https://script.google.com/macros/s/AKfycbw74eVRALWCzJ-lxTdqQixM3RahQcG6UN56oIrMd8A_Q4yn0G_2rl8pwYcdiY04nfquqQ/exec'
const PROLIFIC_EXIT_URL = 'https://app.prolific.com/submissions/complete?cc=C1GDHKVZ'

function App() {
  const [questions, setQuestions] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userSelections, setUserSelections] = useState({})
  const [groundTruth, setGroundTruth] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showIntroduction, setShowIntroduction] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState(null)
  const [audioPlayedStatus, setAudioPlayedStatus] = useState({}) // Track which audios have been played per question: { [questionId]: { [audioId]: true } }
  const [feedback, setFeedback] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [prolificIds, setProlificIds] = useState({
    prolificPid: '',
    studyId: '',
    sessionId: ''
  })

  // Function to fetch questions from Google Sheets (10 with least assignments)
  const fetchQuestionsFromGoogleSheets = async () => {
    try {
      const response = await fetch(`${GOOGLE_FORM_URL}?action=getQuestions&count=10`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.questions) {
          console.log('Fetched questions from Google Sheets:', result.questions)
          return result.questions // Array of question IDs
        } else {
          console.warn('No questions returned from Google Sheets')
          return []
        }
      } else {
        console.warn('Failed to fetch questions from Google Sheets:', response.status)
        return []
      }
    } catch (error) {
      console.warn('Error fetching questions from Google Sheets:', error)
      return [] // Return empty array on error
    }
  }

  useEffect(() => {
    // Extract Prolific IDs from URL query parameters
    const urlParams = new URLSearchParams(window.location.search)
    const prolificPid = urlParams.get('PROLIFIC_PID') || ''
    const studyId = urlParams.get('STUDY_ID') || ''
    const sessionId = urlParams.get('SESSION_ID') || ''
    
    setProlificIds({
      prolificPid,
      studyId,
      sessionId
    })
    
    console.log('Prolific IDs:', { prolificPid, studyId, sessionId })
    
    loadQuestions()
  }, [])

  const loadQuestions = async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL
      
      // Step 1: Fetch question IDs from Google Sheets (10 with least assignments)
      const questionIds = await fetchQuestionsFromGoogleSheets()
      
      if (questionIds.length === 0) {
        console.error('No questions returned from Google Sheets')
        setError(true)
        setLoading(false)
        return
      }
      
      // Step 2: Load questions.json to get paths for the selected question IDs
      let questionManifest = null
      try {
        const manifestResponse = await fetch(`${baseUrl}questions.json`)
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json()
          questionManifest = manifest
        } else {
          console.error('Failed to load questions.json')
          setError(true)
          setLoading(false)
          return
        }
      } catch (error) {
        console.error('Error loading questions.json:', error)
        setError(true)
        setLoading(false)
        return
      }
      
      // Step 3: Load metadata for each selected question
      const loadedQuestions = []
      
      for (const questionId of questionIds) {
        // Find question info in manifest
        const questionInfo = questionManifest.questions.find(q => q.id === questionId)
        
        if (!questionInfo) {
          console.warn(`Question ${questionId} not found in questions.json`)
          continue
        }
        
        try {
          const metadataPath = questionInfo.metadataPath.startsWith('/') 
            ? `${baseUrl}${questionInfo.metadataPath.slice(1)}`
            : `${baseUrl}${questionInfo.metadataPath}`
          
          const response = await fetch(metadataPath)
          if (response.ok) {
            const metadata = await response.json()
            loadedQuestions.push({
              id: questionInfo.id,
              path: questionInfo.path,
              metadata: metadata
            })
          } else {
            console.error(`Failed to load question ${questionId}: ${response.status}`)
          }
        } catch (error) {
          console.error(`Error loading question ${questionId}:`, error)
        }
      }

      if (loadedQuestions.length > 0) {
        setQuestions(loadedQuestions)
        setLoading(false)
      } else {
        console.error('No questions could be loaded')
        setError(true)
        setLoading(false)
      }
    } catch (error) {
      console.error('Error loading questions:', error)
      setError(true)
      setLoading(false)
    }
  }

  const getAudioPath = (questionPath, audioFileName) => {
    // Construct path based on question's file structure: questionPath/audio/01.mp3
    // questionPath is like: "data/decision_making_impulse_control/20251208_160022_000003_88fee74e"
    // audioFileName is like: "01.mp3"
    
    // Use relative path starting from data/... (no base URL prefix)
    // HTML audio elements resolve paths relative to the current page location
    // The base URL in vite.config.js handles the routing, but audio src needs relative paths
    const cleanPath = questionPath.startsWith('/') ? questionPath.slice(1) : questionPath
    const audioPath = `${cleanPath}/audio/${audioFileName}`
    console.log('Audio path resolution:', { questionPath, audioFileName, audioPath })
    return audioPath
  }

  const handleAudioPlay = (audioId, audioElement, questionId, sequenceOrder, customCanPlay = null) => {
    // Check if this audio can be played
    let canPlay
    
    if (customCanPlay !== null) {
      // Use custom canPlay check (for audio 06 which has special conditions)
      canPlay = customCanPlay
    } else if (sequenceOrder === 1) {
      // First audio (sequenceOrder === 1) should always be playable
      canPlay = true
    } else {
      // Use standard sequential check
      canPlay = canPlayAudio(audioId, sequenceOrder, questionId)
    }
    
    if (!canPlay) {
      // Prevent playback if not allowed
      const audioEl = document.getElementById(audioId)
      if (audioEl) {
        audioEl.pause()
        audioEl.currentTime = 0
        console.warn(`Audio ${audioId} blocked: sequenceOrder=${sequenceOrder}, canPlay=${canPlay}`)
      }
      return
    }
    
    // Stop currently playing audio if any
    if (currentlyPlayingAudio && currentlyPlayingAudio !== audioId) {
      const prevAudio = document.getElementById(currentlyPlayingAudio)
      if (prevAudio) {
        prevAudio.pause()
        prevAudio.currentTime = 0
      }
    }
    
    setCurrentlyPlayingAudio(audioId)
    
    // Mark this audio as played when it starts (per question)
    setAudioPlayedStatus(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [audioId]: true
      }
    }))
  }

  const handleAudioEnded = (audioId) => {
    setCurrentlyPlayingAudio(null)
  }

  const canPlayAudio = (audioId, sequenceOrder, questionId) => {
    // First audio in sequence can always play
    if (sequenceOrder === 1) return true
    
    // Check if previous audio in sequence has been played (per question)
    const prevAudioId = `${questionId}_audio_${sequenceOrder - 1}`
    return audioPlayedStatus[questionId]?.[prevAudioId] === true
  }

  const initializeQuestion = (question) => {
    // Only initialize if not already initialized (preserve randomization and selections)
    if (groundTruth[question.id]) {
      return // Already initialized, don't reset
    }

    // Randomize the order for choices
    const choice1Order = Math.random() < 0.5 ? [4, 5] : [5, 4]
    const choice2Order = Math.random() < 0.5 ? [7, 8] : [8, 7]
    
    // Store ground truth
    const newGroundTruth = {
      choice1: {
        order: choice1Order,
        correctAudioNumber: 4,  // 04 is the correct (high EQ) answer
        correctPosition: choice1Order.indexOf(4),  // 0 or 1
        audioMapping: {
          4: 'high',
          5: 'low'
        }
      },
      choice2: {
        order: choice2Order,
        correctAudioNumber: 7,  // 07 is the correct (high EQ) answer
        correctPosition: choice2Order.indexOf(7),  // 0 or 1
        audioMapping: {
          7: 'high',
          8: 'low'
        }
      }
    }

    setGroundTruth(prev => ({
      ...prev,
      [question.id]: newGroundTruth
    }))

    // Only initialize selections if they don't exist
    setUserSelections(prev => {
      if (!prev[question.id]) {
        return {
          ...prev,
          [question.id]: {
            choice1: null,
            choice2: null
          }
        }
      }
      return prev // Keep existing selections
    })
  }

  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex < questions.length) {
      initializeQuestion(questions[currentQuestionIndex])
      // Stop currently playing audio when question changes, but preserve unlock status
      setCurrentlyPlayingAudio(null)
      // Don't reset audioPlayedStatus - preserve unlock status per question
    }
  }, [questions, currentQuestionIndex])

  const handleAudioChoice = (choiceNumber, audioNumber, eqLevel) => {
    if (!questions[currentQuestionIndex]) return

    const questionId = questions[currentQuestionIndex].id

    setUserSelections(prev => {
      const updated = {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          [`choice${choiceNumber}`]: {
            audioNumber: audioNumber,
            eqLevel: eqLevel
          }
        }
      }
      
      return updated
    })
    
    // Auto-save after state update
    setTimeout(() => {
      setUserSelections(currentSelections => {
        const questionSelections = currentSelections[questionId]
        if (questionSelections?.choice1 && questionSelections?.choice2) {
          autoSaveAnswer(questionId)
        }
        return currentSelections
      })
    }, 50)
  }

  const submitFeedbackToGoogleForms = async (submissionData) => {
    if (!GOOGLE_FORM_URL) {
      console.warn('Google Form URL not configured. Cannot submit feedback.')
      throw new Error('Google Form URL not configured')
    }

    return new Promise((resolve, reject) => {
      try {
        // Use form submission with iframe to detect completion
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = GOOGLE_FORM_URL
        form.target = 'submission_iframe'
        form.style.display = 'none'

        // Add data as hidden input
        const dataInput = document.createElement('input')
        dataInput.type = 'hidden'
        dataInput.name = 'data'
        dataInput.value = JSON.stringify(submissionData)
        form.appendChild(dataInput)

        // Create hidden iframe for submission
        const iframe = document.createElement('iframe')
        iframe.name = 'submission_iframe'
        iframe.id = 'submission_iframe'
        iframe.style.display = 'none'
        
        // Listen for iframe load to detect when submission completes
        iframe.onload = () => {
          console.log('Submission iframe loaded - data should be written')
          // Clean up
          setTimeout(() => {
            if (document.body.contains(form)) {
              document.body.removeChild(form)
            }
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe)
            }
          }, 500)
          
          // Wait a bit more to ensure data is fully written
          setTimeout(() => {
            resolve(true)
          }, 1000)
        }
        
        iframe.onerror = () => {
          console.error('Submission iframe error')
          // Clean up
          if (document.body.contains(form)) {
            document.body.removeChild(form)
          }
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
          reject(new Error('Submission failed'))
        }

        document.body.appendChild(iframe)
        document.body.appendChild(form)
        
        console.log('Submitting feedback to Google Sheets...')
        form.submit()
        
        // Fallback timeout in case iframe events don't fire
        setTimeout(() => {
          if (document.body.contains(form) || document.body.contains(iframe)) {
            console.log('Submission timeout - assuming success')
            if (document.body.contains(form)) {
              document.body.removeChild(form)
            }
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe)
            }
            resolve(true)
          }
        }, 5000)
        
      } catch (error) {
        console.error('Error submitting feedback:', error)
        reject(error)
      }
    })
  }

  const submitToGoogleForms = async (allSubmissions) => {
    if (!GOOGLE_FORM_URL) {
      console.warn('Google Form URL not configured. Cannot submit data.')
      return
    }

    // Prevent multiple submissions
    if (hasSubmitted) {
      console.log('Already submitted, skipping duplicate submission')
      return
    }

    try {
      setHasSubmitted(true)
      
      // Simplified data structure - only what we need
      const submissionData = {
        timestamp: new Date().toISOString(),
        email: 'N/A',
        nativeSpeaker: 'N/A',
        prolificPid: prolificIds.prolificPid || 'N/A',
        studyId: prolificIds.studyId || 'N/A',
        sessionId: prolificIds.sessionId || 'N/A',
        questions: allSubmissions // Just the list of {q_id, q1bool, q2bool}
      }

      console.log('Submitting data to:', GOOGLE_FORM_URL)
      console.log('Number of questions:', allSubmissions.length)
      console.log('Submission data:', JSON.stringify(submissionData, null, 2))

      // Use form submission method (single submission, no duplicates)
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = GOOGLE_FORM_URL
      form.target = 'hidden_iframe'
      form.style.display = 'none'

      // Add data as hidden input
      const dataInput = document.createElement('input')
      dataInput.type = 'hidden'
      dataInput.name = 'data'
      dataInput.value = JSON.stringify(submissionData)
      form.appendChild(dataInput)

      // Create hidden iframe to receive response
      const iframe = document.createElement('iframe')
      iframe.name = 'hidden_iframe'
      iframe.style.display = 'none'
      document.body.appendChild(iframe)

      // Submit form
      document.body.appendChild(form)
      form.submit()

      console.log('Form submitted successfully (once)')

      // Clean up after a delay
      setTimeout(() => {
        if (document.body.contains(form)) {
          document.body.removeChild(form)
        }
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }, 1000)
      
    } catch (error) {
      setHasSubmitted(false) // Reset on error
      console.error('Error submitting to Google Forms:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        url: GOOGLE_FORM_URL
      })
    }
  }

  const autoSaveAnswer = (questionId) => {
    const userSelectionsData = userSelections[questionId]
    const groundTruthData = groundTruth[questionId]

    if (!userSelectionsData || !userSelectionsData.choice1 || !userSelectionsData.choice2) {
      return // Not ready to save yet
    }

    // Calculate correctness
    const choice1Correct = userSelectionsData.choice1.audioNumber === groundTruthData.choice1.correctAudioNumber
    const choice2Correct = userSelectionsData.choice2.audioNumber === groundTruthData.choice2.correctAudioNumber

    // Auto-save submission for this question
    const submission = {
      q_id: questionId,
      q1bool: choice1Correct,
      q2bool: choice2Correct
    }

    // Store submission in state
    setUserSelections(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        submission: submission
      }
    }))
  }

  const handleSubmit = () => {
    // Ensure all questions are saved before moving to feedback
    questions.forEach(q => {
      const selection = userSelections[q.id]
      if (selection && selection.choice1 && selection.choice2) {
        autoSaveAnswer(q.id)
      }
    })

    // Wait a moment for state to update, then check
    setTimeout(() => {
      // Check if all questions are answered (check selections, not just submission)
      const allAnswered = questions.every(q => {
        const selection = userSelections[q.id]
        return selection?.choice1 && selection?.choice2
      })

      if (!allAnswered) {
        alert('Please answer all questions before proceeding.')
        return
      }

      // Just move to feedback page, don't submit yet
      setShowResults(true)
    }, 100)
  }

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault()
    
    // Feedback is optional, no validation needed

    // Ensure all questions are saved
    questions.forEach(q => {
      const selection = userSelections[q.id]
      if (selection && selection.choice1 && selection.choice2) {
        autoSaveAnswer(q.id)
      }
    })

    // Wait a moment for state to update, then collect all submissions
    setTimeout(async () => {
      // Collect all submissions (ensure they're all saved)
      const finalSubmissions = questions.map(q => {
        const selection = userSelections[q.id]
        if (selection?.submission) {
          return selection.submission
        }
        // If submission doesn't exist, create it now
        const groundTruthData = groundTruth[q.id]
        const choice1Correct = selection.choice1.audioNumber === groundTruthData.choice1.correctAudioNumber
        const choice2Correct = selection.choice2.audioNumber === groundTruthData.choice2.correctAudioNumber
        return {
          q_id: q.id,
          q1bool: choice1Correct,
          q2bool: choice2Correct
        }
      })

      // Include feedback in submission
      const submissionData = {
        timestamp: new Date().toISOString(),
        email: 'N/A',
        nativeSpeaker: 'N/A',
        prolificPid: prolificIds.prolificPid || 'N/A',
        studyId: prolificIds.studyId || 'N/A',
        sessionId: prolificIds.sessionId || 'N/A',
        questions: finalSubmissions,
        feedback: feedback.trim()
      }

      // Submit everything (answers + feedback) to Google Sheets
      setSubmitting(true)
      try {
        await submitFeedbackToGoogleForms(submissionData)
        setSubmitting(false)
        setFeedbackSubmitted(true)
        
        // Wait a moment to show success message, then redirect
        setTimeout(() => {
          // Redirect to Prolific exit URL
          window.location.href = PROLIFIC_EXIT_URL
        }, 1500)
      } catch (error) {
        setSubmitting(false)
        console.error('Failed to submit:', error)
        alert('Failed to submit your responses. Please try again or contact support.')
      }
    }, 100)
  }

  const handleQuestionChange = (newIndex, direction) => {
    if (newIndex >= 0 && newIndex < questions.length) {
      // Only validate if going forward (Next)
      if (direction === 'next') {
        const currentQuestion = questions[currentQuestionIndex]
        const currentSelections = userSelections[currentQuestion.id]
        
        if (!currentSelections || !currentSelections.choice1 || !currentSelections.choice2) {
          alert('Please complete both selections before moving to the next question.')
          return
        }
        
        // Auto-save current question if both selections are made
        autoSaveAnswer(currentQuestion.id)
      }
      
      setCurrentQuestionIndex(newIndex)
      
      // After navigation, check if we need to auto-save the new question
      setTimeout(() => {
        const newQuestion = questions[newIndex]
        if (newQuestion) {
          const newSelections = userSelections[newQuestion.id]
          if (newSelections && newSelections.choice1 && newSelections.choice2) {
            autoSaveAnswer(newQuestion.id)
          }
        }
      }, 100)
    }
  }



  const getSpeakerName = (speaker, scenario) => {
    if (speaker === 'speaker1') {
      return scenario.speaker1_name || 'Speaker 1'
    } else if (speaker === 'speaker2') {
      return scenario.speaker2_name || 'Speaker 2'
    }
    return 'Unknown'
  }

  if (showIntroduction) {
    return (
      <div className="container">
        <header>
          <h1>SpeechEQ Arena</h1>
          <p className="subtitle">Speech Emotional Appropriateness Study</p>
        </header>
        <div className="consent-container">
          <h2>Welcome to the SpeechEQ Arena</h2>
          
          <div className="consent-section">
            <h3>Instructions</h3>
            <div className="instructions">
              <p><strong>⏱️ Expected Time: Approximately 5 minutes</strong></p>
              <p>In this study, you will evaluate how well a speaker's tone matches a specific social situation.</p>
              <ol>
                <li><strong>Understand the Context:</strong> Read the scenario description to understand the relationship between the speakers and the goal of the conversation.</li>
                <li><strong>Listen & Compare:</strong> You will hear two versions of the same response. The words are identical, but the vocal tone and emotion are different.</li>
                <li><strong>Evaluate:</strong> Select the version that sounds more emotionally appropriate for the given context.</li>
              </ol>
              <p><strong>Please listen to all audio clips before making your selection. The goal is to select the voice that has a more positive impact on the interaction.</strong></p>
            </div>
          </div>

          <div className="consent-section">
            <h3>Example Scenario</h3>
            <p>To help you get started, here is an example of what we are looking for:</p>
            <div className="example-scenario">
              <p><strong>The Situation:</strong> A friend is telling a coworker that they are sorry for missing a deadline.</p>
              <p><strong>The Sentence:</strong> "I am so sorry, I'll have it to you by tomorrow."</p>
              <ul>
                <li><strong>Option A:</strong> Sounds upbeat, cheerful, and fast.</li>
                <li><strong>Option B:</strong> Sounds sincere, slightly lowered pitch, and regretful.</li>
              </ul>
              <p><strong>Which is the right fit?</strong> In this case, Option B is the correct choice. Even though Option A sounds "happy," it is not a good fit for an apology.</p>
            </div>
          </div>

          <div className="consent-section">
            <h3>Consent</h3>
            <p>By participating in this study, you agree that:</p>
            <ul>
              <li>Your responses will be recorded anonymously for research purposes.</li>
              <li>You can withdraw at any time.</li>
            </ul>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="submit-btn"
              onClick={() => setShowIntroduction(false)}
            >
              I Agree and Start the Test
            </button>
          </div>
        </div>
        <footer className="app-footer">
          <p>&copy; {new Date().getFullYear()} <a href="https://binomial14.github.io" target="_blank" rel="noopener noreferrer">Leo Wu</a>. All rights reserved.</p>
        </footer>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container">
        <header>
          <h1>SpeechEQ Arena</h1>
          <p className="subtitle">Speech Emotional Appropriateness Study</p>
        </header>
        <div className="loading">
          <p>Loading questions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <header>
          <h1>SpeechEQ Arena</h1>
          <p className="subtitle">Speech Emotional Appropriateness Study</p>
        </header>
        <div className="error-container">
          <p>Error loading questions. Please check the data folder.</p>
        </div>
      </div>
    )
  }


  if (showResults) {
    return (
      <div className="container">
        <header>
          <h1>SpeechEQ Arena</h1>
          <p className="subtitle">Speech Emotional Appropriateness Study</p>
        </header>
        <div className="results-container">
          {!feedbackSubmitted ? (
            <>
              <h2>Thank you for completing all questions!</h2>
              <p>You may provide feedback below (optional), then submit your responses.</p>
              {submitting && (
                <p className="submitting-message">Submitting your responses and feedback...</p>
              )}
              {!submitting && (
                <div className="feedback-section">
                  <h3>Feedback (Optional)</h3>
                  <p>Please share any comments, suggestions, or thoughts about your experience:</p>
                  <form className="feedback-form" onSubmit={handleFeedbackSubmit}>
                    <div className="form-group">
                      <textarea
                        id="feedback"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Enter your feedback here (optional)..."
                        rows={6}
                        className="feedback-textarea"
                      />
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="submit-btn">
                        Submit All Responses
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          ) : (
            <>
              <h2>Thank you!</h2>
              <p>Your responses and feedback have been submitted successfully.</p>
              <p className="submitting-message">Redirecting you back...</p>
            </>
          )}
        </div>
        <footer className="app-footer">
          <p>&copy; {new Date().getFullYear()} <a href="https://binomial14.github.io" target="_blank" rel="noopener noreferrer">Leo Wu</a>. All rights reserved.</p>
        </footer>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  if (!currentQuestion) return null

  const metadata = currentQuestion.metadata
  const scenario = metadata.scenario
  const questionId = currentQuestion.id
  const currentSelections = userSelections[questionId] || { choice1: null, choice2: null }
  const currentGroundTruth = groundTruth[questionId]

  if (!currentGroundTruth) return null

  const choice1Order = currentGroundTruth.choice1.order
  const choice2Order = currentGroundTruth.choice2.order

  const canSubmit = currentSelections.choice1 && currentSelections.choice2

  return (
    <div className="container">
      <header>
        <h1>SpeechEQ Arena</h1>
        <p className="subtitle">Speech Emotional Appropriateness Study</p>
      </header>

      <div className="question-container">
        <div className="question-header">
          <div className="question-progress">
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
            <div className="question-number">
              Question {currentQuestionIndex + 1} of {questions.length}
            </div>
          </div>
          <h2>{scenario.title}</h2>
          {userSelections[questionId]?.submission && (
            <div className="question-meta">
              <span className="saved-indicator">✓ Saved</span>
            </div>
          )}
        </div>

        <div className="scenario-section">
          <div className="scenario-block">
            <h3>Context</h3>
            <p>{scenario.context}</p>
          </div>
          <div className="scenario-block">
            <h3>Description</h3>
            <p>{scenario.description}</p>
          </div>
        </div>

        <div className="audio-section">
          <div className="audio-group">
            <h4>Listen to the conversation...</h4>
            <div className="audio-players">
              {[1, 2, 3].map(num => {
                const audioFile = metadata.audio_files.find(f => 
                  f.audio_path.includes(`/${String(num).padStart(2, '0')}.mp3`)
                )
                if (!audioFile) return null
                const audioFileName = `${String(num).padStart(2, '0')}.mp3`
                const audioPath = getAudioPath(currentQuestion.path, audioFileName)
                const speakerName = getSpeakerName(audioFile.speaker, scenario)
                const audioId = `${questionId}_audio_${num}`
                const sequenceOrder = num
                // First audio (sequenceOrder === 1) should always be playable
                const canPlay = sequenceOrder === 1 ? true : canPlayAudio(audioId, sequenceOrder, questionId)
                const isPlaying = currentlyPlayingAudio === audioId
                
                return (
                  <div key={`${questionId}_${num}`} className="audio-player">
                    <span className="audio-label">{speakerName}</span>
                    <audio 
                      id={audioId}
                      controls
                      preload="metadata"
                      onPlay={(e) => handleAudioPlay(audioId, audioId, questionId, sequenceOrder)}
                      onEnded={() => handleAudioEnded(audioId)}
                      onPause={() => {
                        if (!isPlaying) setCurrentlyPlayingAudio(null)
                      }}
                      onError={(e) => {
                        console.error(`Error loading audio ${audioId}:`, audioPath, e)
                      }}
                      onLoadedMetadata={(e) => {
                        console.log(`Audio ${audioId} loaded:`, audioPath, `Duration: ${e.target.duration}s`, `CanPlay: ${canPlay}`, `SequenceOrder: ${sequenceOrder}`)
                      }}
                      onCanPlay={(e) => {
                        console.log(`Audio ${audioId} can play:`, audioPath, `CanPlay: ${canPlay}`)
                      }}
                      onClick={(e) => {
                        if (!canPlay) {
                          e.preventDefault()
                          e.stopPropagation()
                          console.warn(`Audio ${audioId} click blocked - canPlay: ${canPlay}`)
                        }
                      }}
                      style={{ opacity: canPlay ? 1 : 0.5 }}
                      className={!canPlay ? 'audio-disabled' : ''}
                    >
                      <source src={audioPath} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="audio-group">
            <h4><span className="highlight-select">Select</span> the speech that sounds more appropriate in this context <span className="required">*</span></h4>
            <div className="audio-choice">
              <div className="audio-options">
                {choice1Order.map((num, index) => {
                  const audioFile = metadata.audio_files.find(f => 
                    f.audio_path.includes(`/${String(num).padStart(2, '0')}.mp3`)
                  )
                  if (!audioFile) return null
                  const audioFileName = `${String(num).padStart(2, '0')}.mp3`
                  const audioPath = getAudioPath(currentQuestion.path, audioFileName)
                  const eqLevel = audioFile.eq_level
                  const isSelected = currentSelections.choice1?.audioNumber === num
                  const speakerName = getSpeakerName(audioFile.speaker, scenario)
                  
                  const audioId = `${questionId}_choice1_${num}`
                  // Choice 1 (04/05) can only play after audio 03 has been played
                  const canPlay = audioPlayedStatus[questionId]?.[`${questionId}_audio_3`] === true
                  const isPlaying = currentlyPlayingAudio === audioId
                  
                  return (
                    <div
                      key={`${questionId}_choice1_${num}`}
                      className={`audio-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleAudioChoice(1, num, eqLevel)}
                    >
                      <div className="audio-option-content">
                        <span className="option-label">{speakerName}</span>
                        <audio 
                          id={audioId}
                          controls
                          disabled={!canPlay}
                      onPlay={(e) => handleAudioPlay(audioId, audioId, questionId, 4)}
                      onEnded={() => handleAudioEnded(audioId)}
                      onPause={() => {
                        if (!isPlaying) setCurrentlyPlayingAudio(null)
                      }}
                      onClick={(e) => {
                        if (!canPlay) {
                          e.stopPropagation()
                          e.preventDefault()
                        } else {
                          e.stopPropagation()
                        }
                      }}
                      style={{ opacity: canPlay ? 1 : 0.5, pointerEvents: canPlay ? 'auto' : 'none' }}
                      className={!canPlay ? 'audio-disabled' : ''}
                    >
                      <source src={audioPath} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="audio-group">
            {(() => {
              const audioFile06 = metadata.audio_files.find(f => 
                f.audio_path.includes('/06.mp3')
              )
              const speakerName06 = audioFile06 ? getSpeakerName(audioFile06.speaker, scenario) : 'Speaker'
              return <h4>After that, {speakerName06} says...</h4>
            })()}
            <div className="audio-players">
              {[6].map(num => {
                const audioFile = metadata.audio_files.find(f => 
                  f.audio_path.includes(`/${String(num).padStart(2, '0')}.mp3`)
                )
                if (!audioFile) return null
                const audioFileName = `${String(num).padStart(2, '0')}.mp3`
                const audioPath = getAudioPath(currentQuestion.path, audioFileName)
                const speakerName = getSpeakerName(audioFile.speaker, scenario)
                const audioId = `${questionId}_audio_${num}`
                const sequenceOrder = 6
                // Audio 06 can play if audio 03 has been played AND choice 1 has been made
                const audio03Played = audioPlayedStatus[questionId]?.[`${questionId}_audio_3`] === true
                const choice1Made = currentSelections.choice1 !== null
                const canPlay = audio03Played && choice1Made
                const isPlaying = currentlyPlayingAudio === audioId
                
                return (
                  <div key={`${questionId}_${num}`} className="audio-player">
                    <span className="audio-label">{speakerName}</span>
                    <audio 
                      id={audioId}
                      controls
                      onPlay={(e) => handleAudioPlay(audioId, audioId, questionId, 6, canPlay)}
                      onEnded={() => handleAudioEnded(audioId)}
                      onPause={() => {
                        if (!isPlaying) setCurrentlyPlayingAudio(null)
                      }}
                      onError={(e) => {
                        console.error(`Error loading audio 06 ${audioId}:`, audioPath, e)
                      }}
                      onLoadedMetadata={(e) => {
                        console.log(`Audio 06 ${audioId} loaded:`, audioPath, `Duration: ${e.target.duration}s`, `CanPlay: ${canPlay}`, `Audio03Played: ${audio03Played}`, `Choice1Made: ${choice1Made}`)
                      }}
                      style={{ opacity: canPlay ? 1 : 0.5 }}
                      className={!canPlay ? 'audio-disabled' : ''}
                    >
                      <source src={audioPath} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="audio-group">
            <h4><span className="highlight-select">Select</span> the speech that sounds more appropriate in this context <span className="required">*</span></h4>
            <div className="audio-choice">
              <div className="audio-options">
                {choice2Order.map((num, index) => {
                  const audioFile = metadata.audio_files.find(f => 
                    f.audio_path.includes(`/${String(num).padStart(2, '0')}.mp3`)
                  )
                  if (!audioFile) return null
                  const audioFileName = `${String(num).padStart(2, '0')}.mp3`
                  const audioPath = getAudioPath(currentQuestion.path, audioFileName)
                  const eqLevel = audioFile.eq_level
                  const isSelected = currentSelections.choice2?.audioNumber === num
                  const speakerName = getSpeakerName(audioFile.speaker, scenario)
                  
                  const audioId = `${questionId}_choice2_${num}`
                  // Choice 2 (07/08) can only play after audio 06 has been played
                  const canPlay = audioPlayedStatus[questionId]?.[`${questionId}_audio_6`] === true
                  const isPlaying = currentlyPlayingAudio === audioId
                  
                  return (
                    <div
                      key={`${questionId}_choice2_${num}`}
                      className={`audio-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleAudioChoice(2, num, eqLevel)}
                    >
                      <div className="audio-option-content">
                        <span className="option-label">{speakerName}</span>
                        <audio 
                          id={audioId}
                          controls
                          disabled={!canPlay}
                      onPlay={(e) => handleAudioPlay(audioId, audioId, questionId, 7)}
                      onEnded={() => handleAudioEnded(audioId)}
                      onPause={() => {
                        if (!isPlaying) setCurrentlyPlayingAudio(null)
                      }}
                      onClick={(e) => {
                        if (!canPlay) {
                          e.stopPropagation()
                          e.preventDefault()
                        } else {
                          e.stopPropagation()
                        }
                      }}
                      style={{ opacity: canPlay ? 1 : 0.5, pointerEvents: canPlay ? 'auto' : 'none' }}
                      className={!canPlay ? 'audio-disabled' : ''}
                    >
                      <source src={audioPath} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="submit-section">
          <div className="navigation-buttons">
            <button 
              className="btn-nav"
              disabled={currentQuestionIndex === 0}
              onClick={() => handleQuestionChange(currentQuestionIndex - 1, 'previous')}
            >
              ← Previous
            </button>
            <span className="question-counter">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            {currentQuestionIndex < questions.length - 1 ? (
              <button 
                className="btn-nav"
                onClick={() => handleQuestionChange(currentQuestionIndex + 1, 'next')}
              >
                Next →
              </button>
            ) : (
              <button 
                className="submit-btn" 
                disabled={!questions.every(q => {
                  const selection = userSelections[q.id]
                  return selection?.choice1 && selection?.choice2
                })}
                onClick={handleSubmit}
              >
                Submit All Answers
              </button>
            )}
          </div>
        </div>
        <footer className="app-footer">
          <p>&copy; {new Date().getFullYear()} <a href="https://binomial14.github.io" target="_blank" rel="noopener noreferrer">Leo Wu</a>. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}

export default App

