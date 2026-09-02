export interface RecentWorkspace {
  name: string
  root: string
}

const RECENT_KEY = 'recent-workspaces'
const CURRENT_KEY = 'current-workspace'
const MAX_RECENT = 30

export function loadRecentWorkspaces(): RecentWorkspace[] {
  const stored = localStorage.getItem(RECENT_KEY)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored) as RecentWorkspace[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveRecentWorkspaces(workspaces: RecentWorkspace[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(workspaces.slice(0, MAX_RECENT)))
}

export function upsertRecentWorkspace(name: string, root: string): RecentWorkspace[] {
  const workspaces = loadRecentWorkspaces().filter((w) => w.root !== root)
  workspaces.unshift({ name, root })
  saveRecentWorkspaces(workspaces)
  return workspaces
}

export function renameRecentWorkspace(root: string, name: string): RecentWorkspace[] {
  const workspaces = loadRecentWorkspaces().map((w) =>
    w.root === root ? { ...w, name } : w
  )
  saveRecentWorkspaces(workspaces)
  return workspaces
}

export function getCurrentWorkspacePath(): string | null {
  return localStorage.getItem(CURRENT_KEY)
}

export function setCurrentWorkspacePath(path: string | null) {
  if (path) localStorage.setItem(CURRENT_KEY, path)
  else localStorage.removeItem(CURRENT_KEY)
}
