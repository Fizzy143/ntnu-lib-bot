import { getDefaultBranches, normalizeBranchName } from '../shared/branches.js';

const fallbackBranches = getDefaultBranches();

export function getBranchOptions() {
  const raw = process.env.BRANCH_OPTIONS || '';
  const parsed = raw
    .split(',')
    .map(item => normalizeBranchName(item.trim()))
    .filter(Boolean);

  return parsed.length ? parsed : fallbackBranches;
}

export function getPublicConfig() {
  return {
    branches: getBranchOptions(),
    defaultBranch: normalizeBranchName(process.env.DEFAULT_BRANCH) || getBranchOptions()[0] || '',
    autoSolveCaptcha: process.env.AUTO_SOLVE_CAPTCHA === 'true'
  };
}
