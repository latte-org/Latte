import { open as openFile } from '@tauri-apps/plugin-dialog'
import { invoke } from '@/lib/backend'

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tif', 'tiff']

export type WorkspaceImage = {
  path: string
  relativePath: string
  name: string
}

export function joinWorkspacePath(root: string, ...parts: string[]) {
  const separator = root.includes('\\') ? '\\' : '/'
  return [root.replace(/[\\/]+$/, ''), ...parts].join(separator)
}

export function toWorkspaceRelative(workspacePath: string, filePath: string) {
  const root = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '')
  const file = filePath.replace(/\\/g, '/')
  if (file.toLowerCase() === root.toLowerCase()) return file.split('/').pop() || file
  if (file.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
    return file.slice(root.length + 1)
  }
  return file.split('/').pop() || file
}

export function fileNameOf(path: string) {
  return path.split(/[/\\]/).pop() || path
}

export async function listWorkspaceImages(workspacePath: string): Promise<WorkspaceImage[]> {
  const paths = await invoke<string[]>('list_workspace_images', { workspacePath })
  return paths
    .map((path) => ({
      path,
      relativePath: toWorkspaceRelative(workspacePath, path),
      name: fileNameOf(path),
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

async function uniqueDestination(workspacePath: string, fileName: string) {
  const assetsDir = joinWorkspacePath(workspacePath, 'assets')
  const dot = fileName.lastIndexOf('.')
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName
  const ext = dot > 0 ? fileName.slice(dot) : ''
  let candidate = joinWorkspacePath(assetsDir, fileName)
  let index = 2
  while (await invoke<boolean>('file_exists', { path: candidate })) {
    candidate = joinWorkspacePath(assetsDir, `${stem}-${index}${ext}`)
    index += 1
  }
  return candidate
}

export async function pickAndImportWorkspaceImage(workspacePath: string): Promise<WorkspaceImage | null> {
  await new Promise((resolve) => setTimeout(resolve, 50))
  const selected = await openFile({
    multiple: false,
    title: 'Import image into workspace',
    filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
  })
  if (!selected || typeof selected !== 'string') return null

  const selectedNorm = selected.replace(/\\/g, '/')
  const workspaceNorm = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '')
  if (selectedNorm.toLowerCase().startsWith(`${workspaceNorm.toLowerCase()}/`)) {
    return {
      path: selected,
      relativePath: toWorkspaceRelative(workspacePath, selected),
      name: fileNameOf(selected),
    }
  }

  const destination = await uniqueDestination(workspacePath, fileNameOf(selected))
  await invoke('copy_file', { source: selected, destination })
  return {
    path: destination,
    relativePath: toWorkspaceRelative(workspacePath, destination),
    name: fileNameOf(destination),
  }
}
