import { execSync } from 'node:child_process';
import fs from 'node:fs';

function readPackageJson() {
  const raw = fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  return JSON.parse(raw);
}

function inferRepoName() {
  if (process.env.GH_PAGES_REPO && String(process.env.GH_PAGES_REPO).trim()) {
    return String(process.env.GH_PAGES_REPO).trim();
  }

  const ghRepo = process.env.GITHUB_REPOSITORY; // owner/repo
  if (ghRepo && String(ghRepo).includes('/')) {
    return String(ghRepo).split('/')[1];
  }

  const pkg = readPackageJson();
  return pkg?.name || 'app';
}

const repo = inferRepoName();
process.env.VITE_BASE = `/${repo}/`;

console.log(`[build-gh] Using VITE_BASE=${process.env.VITE_BASE}`);

execSync('npm run build', {
  stdio: 'inherit',
  env: process.env,
});
