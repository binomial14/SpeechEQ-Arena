# Speech EQ Arena

An online arena for evaluating Emotional Intelligence (EQ) in speech. This application presents users with conversational scenarios and asks them to select the most appropriate emotional responses.

## Features

- **Built with React**: Modern React application using Vite for fast development
- **Interactive Audio Evaluation**: Listen to conversation snippets and select the best emotional response
- **Randomized Choices**: Options are randomized to prevent bias
- **Data Collection**: All user submissions are recorded with ground truth for analysis
- **Modern UI**: Beautiful, responsive design that works on all devices
- **GitHub Pages Ready**: Easy to deploy and host

## Prerequisites

- **Node.js** (version 16 or higher recommended)
- **npm** or **yarn** package manager

## Installation

1. **Clone or download this repository**

2. **Install dependencies**:
   ```bash
   npm install
   ```

   or if using yarn:
   ```bash
   yarn install
   ```

## Local Development

To run the development server:

```bash
npm run dev
```

or with yarn:
```bash
yarn dev
```

The app will be available at `http://localhost:5173` (or another port if 5173 is in use).

Vite provides hot module replacement (HMR), so changes to your code will automatically refresh in the browser.

### Testing Checklist

When testing locally, verify:
- ✅ Questions load correctly from the `data/` folder
- ✅ Audio files play properly (01-08)
- ✅ Choices are randomized (refresh to see different orders)
- ✅ Submissions are saved to localStorage
- ✅ Export functionality works
- ✅ UI is responsive on different screen sizes

## Building for Production

To create a production build:

```bash
npm run build
```

or with yarn:
```bash
yarn build
```

This will create a `dist` folder with optimized production files.

To preview the production build locally:

```bash
npm run preview
```

or with yarn:
```bash
yarn preview
```

## Deployment to GitHub Pages

### Step 1: Update Base Path

**IMPORTANT**: Before deploying, update the `base` path in `vite.config.js` to match your repository name.

1. **Open `vite.config.js`**
2. **Find this line**:
   ```javascript
   base: mode === 'production' ? '/SpeechEQ-Arena/' : '/',
   ```
3. **Replace `'/SpeechEQ-Arena/'` with your repository name**:
   - If your repo is `https://github.com/username/my-repo`, change to: `'/my-repo/'`
   - If your repo is `https://github.com/username/SpeechEQ-Arena`, keep it as: `'/SpeechEQ-Arena/'`
   - If deploying to root domain (`username.github.io`), use: `'/'`

### Step 2: Build the Project

```bash
npm run build
```

This will:
- Create a `dist/` folder with optimized production files
- Automatically copy the `data/` folder and `questions.json` to `dist/`

### Step 3: Push to GitHub

If you haven't initialized git yet:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

If you already have a repository:

```bash
git add .
git commit -m "Ready for deployment"
git push
```

### Step 4: Enable GitHub Pages

1. **Go to your GitHub repository** on GitHub.com
2. **Click "Settings"** (top menu of your repo)
3. **Click "Pages"** in the left sidebar
4. **Under "Source"**:
   - Select **"Deploy from a branch"**
   - Branch: **`main`** (or `master`)
   - Folder: **`/dist`** (important: select the dist folder, not root!)
5. **Click "Save"**

### Step 5: Access Your Site

- Your site will be available at: `https://<your-username>.github.io/<repo-name>/`
- Example: `https://johndoe.github.io/SpeechEQ-Arena/`
- It may take 1-2 minutes for the site to be live

### Step 6: Update Google Forms URL (If Needed)

After deployment, if you're using Google Forms:
1. Update the `GOOGLE_FORM_URL` in `src/App.jsx` with your webhook URL
2. Rebuild: `npm run build`
3. Commit and push the changes

### Automated Deployment (Recommended)

To automatically deploy on every push, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**To use automated deployment:**
1. Create the file `.github/workflows/deploy.yml` with the content above
2. Commit and push to GitHub
3. Go to Settings → Pages
4. Under "Source", select **"GitHub Actions"** instead of "Deploy from a branch"
5. The workflow will automatically build and deploy on every push to `main`

**Note**: With automated deployment, you don't need to manually select the `/dist` folder - GitHub Actions handles it automatically.

## Data Structure

The application expects data in the following structure:

```
data/
  └── decision_making_impulse_control/
      └── <question-id>/
          ├── audio/
          │   ├── 01.mp3
          │   ├── 02.mp3
          │   ├── 03.mp3
          │   ├── 04.mp3  (high EQ)
          │   ├── 05.mp3  (low EQ)
          │   ├── 06.mp3
          │   ├── 07.mp3  (high EQ)
          │   └── 08.mp3  (low EQ)
          └── metadata.json
```

### Metadata Format

Each question should have a `metadata.json` file with:
- `scenario`: Contains title, context, description, and speaker information
- `audio_files`: Array of audio file metadata with paths and EQ levels
- `eq_scale`: The EQ skill being tested

## How It Works

1. **Question Display**: Shows the scenario title, context, and description
2. **Part 1**: Plays audio files 01, 02, 03 (initial conversation)
3. **Choice 1**: User selects between 04 (high EQ) and 05 (low EQ) - order randomized
4. **Part 2**: Plays audio file 06 (continuation)
5. **Choice 2**: User selects between 07 (high EQ) and 08 (low EQ) - order randomized
6. **Submission**: Records user selections with ground truth

## Data Collection

All submissions are automatically:
1. **Stored in browser's localStorage** (as backup)
2. **Submitted to Google Forms** (if configured) when the user completes all questions

The submitted data includes:
- User information (email, native speaker status)
- Question metadata
- User selections
- Ground truth (correct answers and randomization order)
- Correctness calculations
- Timestamps

### Setting Up Google Forms Submission

To receive submissions in Google Forms:

1. **See `GOOGLE_FORMS_SETUP.md`** for detailed setup instructions
2. **Quick setup**:
   - Create a Google Apps Script web app (see setup guide)
   - Set the `VITE_GOOGLE_FORM_URL` environment variable
   - Or update the URL directly in `src/App.jsx`

3. **For local development**:
   - Create a `.env.local` file with:
     ```
     VITE_GOOGLE_FORM_URL=your_webhook_url_here
     ```

4. **For production**:
   - Update the URL in `src/App.jsx` before building, or
   - Use a build-time environment variable

## Adding More Questions

To add more questions:

1. Create a new folder in `data/` (can be in any subfolder like `decision_making_impulse_control/` or `interpersonal_interpersonal_relationships/`)
2. Add audio files (01-08) in the `audio/` subfolder
3. Add a `metadata.json` file following the same structure as the example
4. Add the question to `questions.json` manifest file:
   ```json
   {
     "id": "<question-id>",
     "path": "data/<category-folder>/<question-id>",
     "metadataPath": "data/<category-folder>/<question-id>/metadata.json"
   }
   ```

**Example for different categories:**
- Decision Making: `data/decision_making_impulse_control/<question-id>`
- Interpersonal: `data/interpersonal_interpersonal_relationships/<question-id>`

The app will automatically load all questions listed in `questions.json` and display them in order.

## Project Structure

```
SpeechEQ-Arena/
├── src/
│   ├── App.jsx          # Main React component
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── scripts/
│   └── copy-assets.js   # Script to copy data folder during build
├── data/                # Question data and audio files
├── dist/                # Production build output (generated)
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
└── questions.json       # Question manifest
```

**Note**: The old vanilla JavaScript files have been removed. The React version uses `src/App.jsx` and `src/index.css`.

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Audio playback support required

## Technology Stack

- **React 18**: UI library
- **Vite**: Build tool and dev server
- **JavaScript (ES6+)**: Modern JavaScript features

## License

This project is open source and available for use.

