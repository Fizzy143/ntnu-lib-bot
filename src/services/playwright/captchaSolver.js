// src/services/captchaSolver.js
import { spawn } from 'child_process';

export function solveCaptcha(imagePath, { timeout = 10000, pythonCmd = 'python3', args = [] } = {}) {
  return new Promise((resolve, reject) => {
    if (!imagePath) return reject(new Error('imagePath required'));

    const cmdArgs = [...args, 'ca.py', imagePath]; // assume ca.py is in working dir or provide full path
    const py = spawn(pythonCmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const to = setTimeout(() => {
      if (!finished) {
        py.kill();
        finished = true;
        reject(new Error('captcha-solver-timeout'));
      }
    }, timeout);

    py.stdout.on('data', chunk => { stdout += String(chunk); });
    py.stderr.on('data', chunk => { stderr += String(chunk); });

    py.on('error', err => {
      if (finished) return;
      finished = true;
      clearTimeout(to);
      reject(err);
    });

    py.on('close', code => {
      if (finished) return;
      finished = true;
      clearTimeout(to);

      if (code !== 0) {
        const errMsg = stderr.trim() || `python exited ${code}`;
        return reject(new Error(`captcha-solver-exit: ${errMsg}`));
      }

      const out = stdout.trim();
      if (!out) {
        return reject(new Error('captcha-solver-no-output'));
      }

      // try parse JSON first
      try {
        const parsed = JSON.parse(out);
        if (parsed && (parsed.code || parsed.result || parsed.text)) {
          return resolve(String(parsed.code || parsed.result || parsed.text).trim());
        }
      } catch (e) {
        // ignore
      }

      // fallback: first token in plain text
      const token = out.split(/\s+/)[0].trim();
      if (token) return resolve(token);
      return reject(new Error('captcha-solver-parse-failed'));
    });
  });
}
