import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(rootDir, 'dist')
const distGitDir = path.join(distDir, '.git')

function run(command, options = {}) {
  const cwd = options.cwd ?? rootDir
  execSync(command, { cwd, stdio: 'inherit', ...options })
}

function runCapture(command, options = {}) {
  const cwd = options.cwd ?? rootDir
  return execSync(command, { cwd, encoding: 'utf8' }).trim()
}

function getOriginUrl() {
  try {
    const url = runCapture('git remote get-url origin')
    if (url) return url
  } catch {
    // fall through
  }
  throw new Error(
    '未找到 git remote origin。请先在项目根目录执行：git remote add origin <你的仓库 URL>',
  )
}

function assertDistReady() {
  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ 不存在，请先执行 npm run build')
  }
  const indexHtml = path.join(distDir, 'index.html')
  if (!fs.existsSync(indexHtml)) {
    throw new Error('dist/index.html 不存在，构建产物不完整')
  }
}

function deployToGhPages() {
  const originUrl = getOriginUrl()
  const version = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version
  const commitMessage = `Deploy static site v${version} to GitHub Pages`

  assertDistReady()

  if (fs.existsSync(distGitDir)) {
    fs.rmSync(distGitDir, { recursive: true, force: true })
  }

  console.log('\n→ 发布 dist/ 到 origin/gh-pages …\n')

  run('git init', { cwd: distDir })
  run('git checkout -b gh-pages', { cwd: distDir })
  run('git add .', { cwd: distDir })
  run(`git commit -m ${JSON.stringify(commitMessage)}`, { cwd: distDir })
  try {
    run(`git remote add origin ${JSON.stringify(originUrl)}`, { cwd: distDir })
  } catch {
    run(`git remote set-url origin ${JSON.stringify(originUrl)}`, { cwd: distDir })
  }
  run('git push -f origin gh-pages', { cwd: distDir })

  fs.rmSync(distGitDir, { recursive: true, force: true })

  console.log('\n✓ 已推送到 gh-pages 分支')
  console.log('  若 Pages 源为 Deploy from branch → gh-pages，站点将在 1–3 分钟内更新。')
  const match = originUrl.match(/github\.com[:/](.+?)(?:\.git)?\/?$/i)
  if (match) {
    const repo = match[1].replace(/\.git$/, '')
    const [owner, name] = repo.split('/')
    if (owner && name) {
      console.log(`  https://${owner}.github.io/${name}/`)
    }
  }
}

deployToGhPages()
