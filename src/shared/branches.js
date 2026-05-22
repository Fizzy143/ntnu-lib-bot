const BRANCH_DEFINITIONS = [
  {
    canonical: '總館',
    aliases: ['總館', '總圖', '本館', '圖書館總館']
  },
  {
    canonical: '公館分館',
    aliases: ['公館分館', '公館', '公館校區', '公館圖書館']
  },
  {
    canonical: '林口分館',
    aliases: ['林口分館', '林口', '林口校區', '林口圖書館']
  }
];

export function getBranchDefinitions() {
  return BRANCH_DEFINITIONS;
}

export function getDefaultBranches() {
  return BRANCH_DEFINITIONS.map(branch => branch.canonical);
}

export function normalizeBranchName(value) {
  const source = String(value || '').trim();
  if (!source) {
    return '';
  }

  for (const branch of BRANCH_DEFINITIONS) {
    if (branch.aliases.includes(source)) {
      return branch.canonical;
    }
  }

  return source;
}
