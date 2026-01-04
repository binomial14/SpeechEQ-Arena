# GitHub Pages Deployment Guide

Quick guide to deploy Speech EQ Arena to GitHub Pages.

## Quick Start

### 1. Update Repository Name in Config

Edit `vite.config.js` and change the base path:

```javascript
base: mode === 'production' ? '/YOUR_REPO_NAME/' : '/',
```

**Examples:**
- Repo: `https://github.com/john/SpeechEQ-Arena` → Use `'/SpeechEQ-Arena/'`
- Repo: `https://github.com/john/my-arena` → Use `'/my-arena/'`
- Root domain: `https://john.github.io` → Use `'/'`

### 2. Build the Project

```bash
npm run build
```

This creates the `dist/` folder with all production files.

### 3. Push to GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push
```

### 4. Enable GitHub Pages

1. Go to your repo on GitHub
2. Settings → Pages
3. Source: **Deploy from a branch**
4. Branch: **main** (or master)
5. Folder: **/dist** ⚠️ Important: select `/dist`, not root!
6. Click Save

### 5. Your Site is Live!

Visit: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

---

## Automated Deployment (Recommended)

For automatic deployment on every push:

1. Create `.github/workflows/deploy.yml` (see README.md for full code)
2. Commit and push
3. Settings → Pages → Source: **GitHub Actions**

This way, every time you push code, it automatically builds and deploys!

---

## Troubleshooting

**Site shows 404:**
- Check that base path in `vite.config.js` matches your repo name
- Make sure you selected `/dist` folder in GitHub Pages settings
- Wait 1-2 minutes for changes to propagate

**Assets not loading:**
- Make sure `data/` folder and `questions.json` are in `dist/` after build
- Check browser console for 404 errors
- Verify base path is correct

**Questions not loading:**
- Check that `questions.json` is in the `dist/` folder
- Verify the paths in `questions.json` are correct
- Check browser console for fetch errors

