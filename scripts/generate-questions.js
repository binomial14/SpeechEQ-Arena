import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const dataDir = path.resolve(rootDir, 'data')
const questionsFile = path.resolve(rootDir, 'questions.json')

function generateQuestions() {
  if (!fs.existsSync(dataDir)) {
    console.error('❌ data folder not found')
    process.exit(1)
  }

  // Get all category folders (subscales)
  const categories = fs.readdirSync(dataDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort() // Sort categories alphabetically for consistency

  console.log(`📁 Found ${categories.length} subscales in data/`)

  // Collect questions grouped by subscale
  const questionsBySubscale = {}

  for (const category of categories) {
    const categoryPath = path.join(dataDir, category)
    
    // Get all question folders in this category
    const questionFolders = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort() // Sort questions within each subscale

    console.log(`  📂 ${category}: ${questionFolders.length} questions`)

    const subscaleQuestions = []

    // Iterate through each question folder
    for (const questionId of questionFolders) {
      const questionPath = path.join(categoryPath, questionId)
      const metadataPath = path.join(questionPath, 'metadata.json')

      // Check if metadata.json exists
      if (fs.existsSync(metadataPath)) {
        // Construct relative paths (without leading slash)
        const relativePath = `data/${category}/${questionId}`
        const relativeMetadataPath = `${relativePath}/metadata.json`

        subscaleQuestions.push({
          id: questionId,
          path: relativePath,
          metadataPath: relativeMetadataPath
        })
      } else {
        console.warn(`  ⚠️  Warning: metadata.json not found in ${questionPath}`)
      }
    }

    questionsBySubscale[category] = subscaleQuestions
  }

  // Interleave questions: round 1 from all subscales, then round 2, etc.
  const questions = []
  const maxQuestionsPerSubscale = Math.max(...Object.values(questionsBySubscale).map(q => q.length))

  console.log(`\n🔄 Ordering questions by rounds (max ${maxQuestionsPerSubscale} rounds)...`)

  for (let round = 0; round < maxQuestionsPerSubscale; round++) {
    for (const category of categories) {
      const subscaleQuestions = questionsBySubscale[category]
      if (round < subscaleQuestions.length) {
        questions.push(subscaleQuestions[round])
        console.log(`  Round ${round + 1}: ${category} - ${subscaleQuestions[round].id}`)
      }
    }
  }

  // Generate the JSON structure
  const questionsJson = {
    questions: questions
  }

  // Write to questions.json
  fs.writeFileSync(questionsFile, JSON.stringify(questionsJson, null, 2) + '\n', 'utf8')

  console.log(`\n✅ Generated questions.json with ${questions.length} questions`)
  console.log(`📝 File saved to: ${questionsFile}`)
  console.log(`\n📊 Order: Round 1 (all subscales) → Round 2 (all subscales) → ...`)
}

// Run the script
try {
  generateQuestions()
} catch (error) {
  console.error('❌ Error generating questions.json:', error)
  process.exit(1)
}

