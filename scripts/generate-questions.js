import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const dataDir = path.resolve(rootDir, 'data')
const questionsFile = path.resolve(rootDir, 'questions.json')

function generateQuestions() {
  const questions = []

  if (!fs.existsSync(dataDir)) {
    console.error('❌ data folder not found')
    process.exit(1)
  }

  // Get all category folders
  const categories = fs.readdirSync(dataDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

  console.log(`📁 Found ${categories.length} categories in data/`)

  // Iterate through each category
  for (const category of categories) {
    const categoryPath = path.join(dataDir, category)
    
    // Get all question folders in this category
    const questionFolders = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

    console.log(`  📂 ${category}: ${questionFolders.length} questions`)

    // Iterate through each question folder
    for (const questionId of questionFolders) {
      const questionPath = path.join(categoryPath, questionId)
      const metadataPath = path.join(questionPath, 'metadata.json')

      // Check if metadata.json exists
      if (fs.existsSync(metadataPath)) {
        // Construct relative paths (without leading slash)
        const relativePath = `data/${category}/${questionId}`
        const relativeMetadataPath = `${relativePath}/metadata.json`

        questions.push({
          id: questionId,
          path: relativePath,
          metadataPath: relativeMetadataPath
        })
      } else {
        console.warn(`  ⚠️  Warning: metadata.json not found in ${questionPath}`)
      }
    }
  }

  // Sort questions by ID for consistency
  questions.sort((a, b) => a.id.localeCompare(b.id))

  // Generate the JSON structure
  const questionsJson = {
    questions: questions
  }

  // Write to questions.json
  fs.writeFileSync(questionsFile, JSON.stringify(questionsJson, null, 2) + '\n', 'utf8')

  console.log(`\n✅ Generated questions.json with ${questions.length} questions`)
  console.log(`📝 File saved to: ${questionsFile}`)
}

// Run the script
try {
  generateQuestions()
} catch (error) {
  console.error('❌ Error generating questions.json:', error)
  process.exit(1)
}

