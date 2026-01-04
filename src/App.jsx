import { useState, useEffect } from 'react'

// Google Form submission URL - Update this with your Google Form URL
// To get this: Create a Google Form, go to Settings > Responses > Get pre-filled link
// Or use Google Apps Script to create a web app that accepts POST requests
const GOOGLE_FORM_URL = import.meta.env.VITE_GOOGLE_FORM_URL || 'https://script.google.com/macros/s/AKfycbwhFhJmxXcgM-JYGVMK0zUkTbJXrw3J66IPpyl37Fg7F6S56Udy-4ZukLAa-pAKoFj9/exec'

function App() {
  const [questions, setQuestions] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userSelections, setUserSelections] = useState({})
  const [groundTruth, setGroundTruth] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showPasskey, setShowPasskey] = useState(true)
  const [passkey, setPasskey] = useState('')
  const [showConsent, setShowConsent] = useState(false)
  const [userInfo, setUserInfo] = useState({
    email: '',
    nativeSpeaker: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  useEffect(() => {
    loadQuestions()
  }, [])

  const loadQuestions = async () => {
    try {
      const loadedQuestions = []
      const baseUrl = import.meta.env.BASE_URL
      
      // Try to load questions from manifest file first
      try {
        const manifestResponse = await fetch(`${baseUrl}questions.json`)
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json()
          
          // Load all questions from manifest
          for (const questionInfo of manifest.questions) {
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
                console.error(`Failed to load question ${questionInfo.id}: ${response.status}`)
              }
            } catch (error) {
              console.error(`Error loading question ${questionInfo.id}:`, error)
            }
          }
        } else {
          console.log('Manifest file not found, trying direct load...')
        }
      } catch (error) {
        console.log('Manifest file not found, trying direct load...', error)
      }
      
      // Fallback: Try to load the example question directly if no questions loaded
      if (loadedQuestions.length === 0) {
        const questionPath = `${baseUrl}data/decision_making_impulse_control/20251208_160022_000001_213287e3/metadata.json`
        try {
          const response = await fetch(questionPath)
          if (response.ok) {
            const metadata = await response.json()
            loadedQuestions.push({
              id: metadata.generation_metadata.dataset_id,
              path: questionPath.replace('/metadata.json', ''),
              metadata: metadata
            })
          } else {
            console.error(`Failed to load question: ${response.status}`)
          }
        } catch (error) {
          console.error('Error loading question:', error)
        }
      }

      if (loadedQuestions.length > 0) {
        setQuestions(loadedQuestions)
        setLoading(false)
      } else {
        setError(true)
        setLoading(false)
      }
    } catch (error) {
      console.error('Error loading questions:', error)
      setError(true)
      setLoading(false)
    }
  }

  const getAudioPath = (audioPath) => {
    const baseUrl = import.meta.env.BASE_URL
    // Extract the actual path - remove 'data/1208_300/' prefix if present
    let path = audioPath
    if (path.startsWith('data/1208_300/')) {
      path = path.replace('data/1208_300/', 'data/')
    }
    // Ensure path starts with base URL
    if (!path.startsWith('http') && !path.startsWith('/')) {
      return `${baseUrl}${path}`
    }
    if (path.startsWith('/')) {
      return `${baseUrl}${path.slice(1)}`
    }
    return path
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
        email: userInfo.email,
        nativeSpeaker: userInfo.nativeSpeaker,
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

  const handleSubmit = async () => {
    // Ensure all questions are saved before submitting
    questions.forEach(q => {
      const selection = userSelections[q.id]
      if (selection && selection.choice1 && selection.choice2) {
        autoSaveAnswer(q.id)
      }
    })

    // Wait a moment for state to update, then check
    setTimeout(async () => {
      // Check if all questions are answered (check selections, not just submission)
      const allAnswered = questions.every(q => {
        const selection = userSelections[q.id]
        return selection?.choice1 && selection?.choice2
      })

      if (!allAnswered) {
        alert('Please answer all questions before submitting.')
        return
      }

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
      
      // Submit to Google Sheets
      setSubmitting(true)
      await submitToGoogleForms(finalSubmissions)
      setSubmitting(false)
      setShowResults(true)
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


  const handleConsentSubmit = (e) => {
    e.preventDefault()
    if (!userInfo.email || !userInfo.nativeSpeaker) {
      alert('Please fill in all required fields.')
      return
    }
    setShowConsent(false)
  }

  const getSpeakerName = (speaker, scenario) => {
    if (speaker === 'speaker1') {
      return scenario.speaker1_name || 'Speaker 1'
    } else if (speaker === 'speaker2') {
      return scenario.speaker2_name || 'Speaker 2'
    }
    return 'Unknown'
  }

  if (loading) {
    return (
      <div className="container">
        <header>
          <h1>Speech EQ Arena</h1>
          <p className="subtitle">Evaluate Emotional Intelligence in Speech</p>
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
          <h1>Speech EQ Arena</h1>
          <p className="subtitle">Evaluate Emotional Intelligence in Speech</p>
        </header>
        <div className="error-container">
          <p>Error loading questions. Please check the data folder.</p>
        </div>
      </div>
    )
  }

  if (showPasskey) {
    return (
      <div className="container">
        <header>
          <h1>Speech EQ Arena</h1>
          <p className="subtitle">Evaluate Emotional Intelligence in Speech</p>
        </header>
        <div className="consent-container">
          <h2>Access Required</h2>
          <div className="consent-section">
            <p>Please enter the access code to continue:</p>
            <form className="consent-form" onSubmit={(e) => {
              e.preventDefault()
              if (passkey === '2026SPEECHEQ') {
                setShowPasskey(false)
                setShowConsent(true)
              } else {
                alert('Invalid access code. Please try again.')
                setPasskey('')
              }
            }}>
              <div className="form-group">
                <label htmlFor="passkey">
                  Access Code <span className="required">*</span>
                </label>
                <input
                  type="password"
                  id="passkey"
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  required
                  placeholder="Enter access code"
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (showPasskey) {
    return (
      <div className="container">
        <header>
          <h1>Speech EQ Arena</h1>
          <p className="subtitle">Evaluate Emotional Intelligence in Speech</p>
        </header>
        <div className="consent-container">
          <h2>Access Required</h2>
          <div className="consent-section">
            <p>Please enter the access code to continue:</p>
            <form className="consent-form" onSubmit={(e) => {
              e.preventDefault()
              if (passkey === '2026SPEECHEQ') {
                setShowPasskey(false)
                setShowConsent(true)
              } else {
                alert('Invalid access code. Please try again.')
                setPasskey('')
              }
            }}>
              <div className="form-group">
                <label htmlFor="passkey">
                  Access Code <span className="required">*</span>
                </label>
                <input
                  type="password"
                  id="passkey"
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  required
                  placeholder="Enter access code"
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (showConsent) {
    return (
      <div className="container">
        <header>
          <h1>Speech EQ Arena</h1>
          <p className="subtitle">Evaluate Emotional Intelligence in Speech</p>
        </header>
        <div className="consent-container">
          <h2>Welcome to the Speech EQ Arena</h2>
          
          <div className="consent-section">
            <h3>Instructions</h3>
            <div className="instructions">
              <p>You will be presented with conversational scenarios. Your task is to:</p>
              <ol>
                <li>Read the scenario context and description carefully.</li>
                <li>Listen to the conversation audio clips.</li>
                <li>Select the response that sounds more appropriate in the given context.</li>
              </ol>
              <p><strong>Please listen to all audio clips before making your selection.</strong></p>
            </div>
          </div>

          <div className="consent-section">
            <h3>Consent</h3>
            <p>By participating in this study, you agree that:</p>
            <ul>
              <li>Your responses will be recorded anonymously for research purposes.</li>
              <li>You can withdraw at any time.</li>
              <li>Your email address will be used only for research purposes and will be kept confidential.</li>
            </ul>
          </div>

          <form className="consent-form" onSubmit={handleConsentSubmit}>
            <div className="form-group">
              <label htmlFor="email">
                Email Address <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={userInfo.email}
                onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
                required
                placeholder="your.email@example.com"
              />
            </div>

            <div className="form-group">
              <label>
                Are you a native English speaker? <span className="required">*</span>
              </label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="nativeSpeaker"
                    value="yes"
                    checked={userInfo.nativeSpeaker === 'yes'}
                    onChange={(e) => setUserInfo({ ...userInfo, nativeSpeaker: e.target.value })}
                    required
                  />
                  <span>Yes</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="nativeSpeaker"
                    value="no"
                    checked={userInfo.nativeSpeaker === 'no'}
                    onChange={(e) => setUserInfo({ ...userInfo, nativeSpeaker: e.target.value })}
                    required
                  />
                  <span>No</span>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">
                I Agree and Start the Test
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (showResults) {
    return (
      <div className="container">
        <header>
          <h1>Speech EQ Arena</h1>
          <p className="subtitle">Evaluate Emotional Intelligence in Speech</p>
        </header>
        <div className="results-container">
          <h2>Thank you for your participation!</h2>
          <p>Your responses have been recorded.</p>
          {submitting && (
            <p className="submitting-message">Submitting your responses...</p>
          )}
        </div>
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
        <h1>Speech EQ Arena</h1>
        <p className="subtitle">Evaluate Emotional Intelligence in Speech</p>
      </header>

      <div className="question-container">
        <div className="question-header">
          <h2>{scenario.title}</h2>
          <div className="question-meta">
            <span>{metadata.eq_scale}</span>
            {userSelections[questionId]?.submission && (
              <span className="saved-indicator">✓ Saved</span>
            )}
          </div>
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
                const audioPath = getAudioPath(audioFile.audio_path)
                const speakerName = getSpeakerName(audioFile.speaker, scenario)
                return (
                  <div key={num} className="audio-player">
                    <span className="audio-label">{speakerName}</span>
                    <audio controls>
                      <source src={audioPath} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="audio-group">
            <h4>Select the speech that sounds more appropriate in this context</h4>
            <div className="audio-choice">
              <div className="audio-options">
                {choice1Order.map((num, index) => {
                  const audioFile = metadata.audio_files.find(f => 
                    f.audio_path.includes(`/${String(num).padStart(2, '0')}.mp3`)
                  )
                  if (!audioFile) return null
                  const audioPath = getAudioPath(audioFile.audio_path)
                  const eqLevel = audioFile.eq_level
                  const isSelected = currentSelections.choice1?.audioNumber === num
                  const speakerName = getSpeakerName(audioFile.speaker, scenario)
                  
                  return (
                    <div
                      key={num}
                      className={`audio-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleAudioChoice(1, num, eqLevel)}
                    >
                      <div className="audio-option-content">
                        <span className="option-label">{speakerName}</span>
                        <audio controls>
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
                const audioPath = getAudioPath(audioFile.audio_path)
                const speakerName = getSpeakerName(audioFile.speaker, scenario)
                return (
                  <div key={num} className="audio-player">
                    <span className="audio-label">{speakerName}</span>
                    <audio controls>
                      <source src={audioPath} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="audio-group">
            <h4>Select the speech that sounds more appropriate in this context</h4>
            <div className="audio-choice">
              <div className="audio-options">
                {choice2Order.map((num, index) => {
                  const audioFile = metadata.audio_files.find(f => 
                    f.audio_path.includes(`/${String(num).padStart(2, '0')}.mp3`)
                  )
                  if (!audioFile) return null
                  const audioPath = getAudioPath(audioFile.audio_path)
                  const eqLevel = audioFile.eq_level
                  const isSelected = currentSelections.choice2?.audioNumber === num
                  const speakerName = getSpeakerName(audioFile.speaker, scenario)
                  
                  return (
                    <div
                      key={num}
                      className={`audio-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleAudioChoice(2, num, eqLevel)}
                    >
                      <div className="audio-option-content">
                        <span className="option-label">{speakerName}</span>
                        <audio controls>
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
      </div>
    </div>
  )
}

export default App

