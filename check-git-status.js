import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = __dirname;

try {
  console.log('=== Git Status ===');
  const status = execSync('git status --short', { cwd: projectDir, encoding: 'utf-8' });
  console.log(status || '(clean working tree)');

  console.log('\n=== Staged Changes ===');
  const diff = execSync('git diff --cached --stat', { cwd: projectDir, encoding: 'utf-8' });
  console.log(diff || '(no staged changes)');

  console.log('\n=== Recent Commits ===');
  const log = execSync('git log --oneline -5', { cwd: projectDir, encoding: 'utf-8' });
  console.log(log);

} catch (error) {
  console.error('Error:', error.message);
}
