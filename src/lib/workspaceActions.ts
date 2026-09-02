import { open as openDirectory } from '@tauri-apps/plugin-dialog'
import { invoke } from '@/lib/backend'
import { upsertRecentWorkspace } from '@/lib/workspaces'

export function getFolderName(path: string) {
  return path.split(/[/\\]/).filter(Boolean).pop() || 'Workspace'
}

export async function pickWorkspaceDirectory(): Promise<string | null> {
  // Wait briefly so any open dropdown can finish closing first.
  await new Promise((resolve) => setTimeout(resolve, 50))

  const selected = await openDirectory({
    directory: true,
    multiple: false,
    title: 'Select Workspace Folder',
  })

  if (!selected) return null
  if (typeof selected === 'string') return selected
  if (Array.isArray(selected) && typeof selected[0] === 'string') return selected[0]
  return null
}

export async function createOrOpenWorkspace(path: string, preferredName?: string) {
  const folderName = preferredName?.trim() || getFolderName(path)

  const config = await invoke<{ name: string; root: string }>('init_workspace', {
    workspacePath: path,
    name: folderName,
  })

  upsertRecentWorkspace(config.name, path)
  return config
}

export function formatInvokeError(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}
