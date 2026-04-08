const GROUP_LABELS = {
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Performance',
  docs: 'Documentation',
  refactor: 'Refactors',
}

function classifyCommit(subject) {
  const match = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?: (?<summary>.+)$/.exec(
    subject
  )

  if (!match?.groups) {
    return null
  }

  return {
    type: match.groups.type,
    scope: match.groups.scope ?? null,
    summary: match.groups.summary,
    breaking: Boolean(match.groups.breaking),
  }
}

function formatCommitLine(commit, classified) {
  const scopePrefix = classified.scope ? `**${classified.scope}:** ` : ''
  const breakingLabel = classified.breaking ? ' [breaking]' : ''
  return `- ${scopePrefix}${classified.summary}${breakingLabel} (\`${commit.hash.slice(0, 7)}\`)`
}

export function buildReleaseNotes({ version, commits = [] }) {
  const groupedCommits = new Map(
    Object.values(GROUP_LABELS).map(label => [label, []])
  )

  for (const commit of commits) {
    const classified = classifyCommit(commit.subject)

    if (!classified) {
      continue
    }

    if (classified.type === 'chore' && classified.scope === 'release') {
      continue
    }

    const label = GROUP_LABELS[classified.type]

    if (!label) {
      continue
    }

    groupedCommits.get(label).push(formatCommitLine(commit, classified))
  }

  const sections = [...groupedCommits.entries()]
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => `## ${label}\n${items.join('\n')}`)

  if (sections.length === 0) {
    sections.push('## Notes\n- No user-facing changes were detected in this release range.')
  }

  return [`# Release v${version}`, ...sections].join('\n\n')
}
