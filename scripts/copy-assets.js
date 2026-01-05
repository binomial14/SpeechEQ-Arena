import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.resolve(rootDir, 'dist')

// Copy data folder
const dataSource = path.resolve(rootDir, 'data')
const dataDest = path.resolve(distDir, 'data')

if (fs.existsSync(dataSource)) {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true })
  }
  
  // Copy directory recursively
  function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src)
    const stats = exists && fs.statSync(src)
    const isDirectory = exists && stats.isDirectory()
    
    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
      }
      fs.readdirSync(src).forEach(childItemName => {
        copyRecursiveSync(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        )
      })
    } else {
      fs.copyFileSync(src, dest)
    }
  }
  
  copyRecursiveSync(dataSource, dataDest)
  console.log('✓ Copied data folder to dist/')
} else {
  console.warn('⚠ data folder not found')
}

// Copy questions.json
const questionsSource = path.resolve(rootDir, 'questions.json')
const questionsDest = path.resolve(distDir, 'questions.json')

if (fs.existsSync(questionsSource)) {
  fs.copyFileSync(questionsSource, questionsDest)
  console.log('✓ Copied questions.json to dist/')
} else {
  console.warn('⚠ questions.json not found')
  console.warn('💡 Run "npm run generate-questions" to auto-generate it from data/ folder')
}

console.log('✓ Assets copied successfully!')

