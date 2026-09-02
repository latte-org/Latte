<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke, isTauri, browserModeMessage } from '@/lib/backend'
import {
  getCurrentWorkspacePath,
  setCurrentWorkspacePath,
  upsertRecentWorkspace,
} from '@/lib/workspaces'
import {
  createOrOpenWorkspace,
  formatInvokeError,
  pickWorkspaceDirectory,
} from '@/lib/workspaceActions'
import {
  applyTheme,
  loadSettings,
  resolvedTheme,
  startThemeListener,
  stopThemeListener,
  type AppSettings,
} from '@/lib/settings'
import ContextBar from '@/components/ContextBar.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import RightInfoPanel from '@/components/RightInfoPanel.vue'
import DashboardView from '@/components/DashboardView.vue'
import TypstSourceEditor from '@/components/TypstSourceEditor.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import TemplateModal from '@/components/TemplateModal.vue'
import AppSettingsPanel from '@/components/AppSettings.vue'
import type { DiagnosticInfo, DraftDocument, OpenTab } from '@/types'
import { cn } from '@/lib/utils'

const DEFAULT_CONTENT = '#set page(margin: 2cm)\n\n= Untitled document\n\n'
const DEFAULT_LABEL = 'Untitled document'

const openTabs = ref<OpenTab[]>([])
const activeTabIndex = ref(-1)
const mainView = ref<'dashboard' | 'editor'>('dashboard')
const editorMode = ref<'code' | 'text'>('code')
const appSettings = ref<AppSettings>(loadSettings())
const autoSave = ref(appSettings.value.autoSave)
const diagnostics = ref<DiagnosticInfo[]>([])
const showTemplateModal = ref(false)
const showSettings = ref(false)
const sidebarOpen = ref(true)
const workspacePath = ref<string | null>(null)
const workspaceName = ref('')
const documents = ref<string[]>([])
const runningInTauri = isTauri()
const typstEditorRef = ref<InstanceType<typeof TypstSourceEditor> | null>(null)
const sidebarRef = ref<InstanceType<typeof AppSidebar> | null>(null)

const editorColorMode = computed(() => resolvedTheme.value)

const handleSettingsChange = (settings: AppSettings) => {
  appSettings.value = settings
  autoSave.value = settings.autoSave
}

const activeTab = computed(() => openTabs.value[activeTabIndex.value] ?? null)
const currentFile = computed(() => activeTab.value?.path ?? null)

const drafts = computed<DraftDocument[]>(() =>
  openTabs.value
    .filter((tab) => !tab.path)
    .map((tab) => ({
      id: tab.id,
      label: tab.label,
      isDirty: tab.isDirty,
    }))
)

const createTabId = () =>
  `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const nextUntitledLabel = () => {
  const labels = new Set(openTabs.value.map((tab) => tab.label.toLowerCase()))
  if (!labels.has(DEFAULT_LABEL.toLowerCase())) return DEFAULT_LABEL

  let index = 2
  while (labels.has(`${DEFAULT_LABEL} ${index}`.toLowerCase())) index += 1
  return `${DEFAULT_LABEL} ${index}`
}

const contextTitle = computed(() => {
  if (mainView.value === 'dashboard') {
    return workspacePath.value ? 'Dashboard' : 'Welcome'
  }
  return activeTab.value?.label ?? DEFAULT_LABEL
})

const windowTitle = computed(() => {
  if (mainView.value === 'editor' && activeTab.value?.label) {
    const dirty = activeTab.value.isDirty ? ' •' : ''
    return `${activeTab.value.label}${dirty} — Latte`
  }
  if (workspaceName.value) return `${workspaceName.value} — Latte`
  return 'Latte'
})

watch(
  windowTitle,
  async (title) => {
    if (!runningInTauri) {
      document.title = title
      return
    }
    try {
      await getCurrentWindow().setTitle(title)
    } catch {
      document.title = title
    }
  },
  { immediate: true }
)

const wordCount = computed(() => {
  const content = activeTab.value?.content ?? ''
  const words = content.trim().match(/\S+/g)
  return words?.length ?? 0
})

const lineCount = computed(() => {
  const content = activeTab.value?.content ?? ''
  if (!content) return 0
  return content.split('\n').length
})

let saveTimeout: ReturnType<typeof setTimeout> | null = null
let diagnosticsTimeout: ReturnType<typeof setTimeout> | null = null

const getFileName = (path: string) => path.split(/[/\\]/).pop() || path

const sanitizeFileName = (label: string) => {
  const cleaned = label
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
  const base = cleaned || DEFAULT_LABEL
  return base.toLowerCase().endsWith('.typ') ? base : `${base}.typ`
}

const refreshDocuments = async () => {
  if (!workspacePath.value) {
    documents.value = []
    return
  }
  try {
    documents.value = await invoke<string[]>('list_workspace_documents', {
      workspacePath: workspacePath.value,
    })
  } catch (error) {
    console.error('Failed to list documents:', error)
  }
}

const openTabForFile = (path: string | null, content: string, label?: string) => {
  if (path) {
    const existing = openTabs.value.findIndex((tab) => tab.path === path)
    if (existing >= 0) {
      activeTabIndex.value = existing
      mainView.value = 'editor'
      return
    }
  }

  openTabs.value.push({
    id: createTabId(),
    path,
    label: label ?? (path ? getFileName(path) : nextUntitledLabel()),
    content,
    isDirty: !path,
  })
  activeTabIndex.value = openTabs.value.length - 1
  mainView.value = 'editor'
}

const handleContentChanged = (content: string) => {
  const tab = activeTab.value
  if (!tab) return

  tab.content = content
  tab.isDirty = true

  if (autoSave.value && tab.path) {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      autoSaveTab(tab)
    }, 2000)
  }

  scheduleDiagnostics()
}

const autoSaveTab = async (tab: OpenTab) => {
  if (!tab.path || !tab.isDirty) return
  try {
    await invoke('write_file', { path: tab.path, contents: tab.content })
    tab.isDirty = false
  } catch (error) {
    console.error('Auto-save failed:', error)
  }
}

const fetchDiagnostics = async () => {
  if (!currentFile.value || !runningInTauri) {
    diagnostics.value = []
    return
  }

  try {
    if (activeTab.value?.isDirty && activeTab.value.path) {
      await invoke('write_file', {
        path: activeTab.value.path,
        contents: activeTab.value.content,
      })
      activeTab.value.isDirty = false
    }

    diagnostics.value = await invoke<DiagnosticInfo[]>('get_typst_diagnostics', {
      entryPath: currentFile.value,
    })
  } catch {
    diagnostics.value = []
  }
}

const scheduleDiagnostics = () => {
  if (diagnosticsTimeout) clearTimeout(diagnosticsTimeout)
  diagnosticsTimeout = setTimeout(() => {
    fetchDiagnostics()
  }, 800)
}

const persistUntitledTab = async (tab: OpenTab) => {
  if (!workspacePath.value) {
    // Never open a folder picker while creating/saving a draft.
    alert('Open a workspace first to save this document to disk.')
    return false
  }

  const separator = workspacePath.value.includes('\\') ? '\\' : '/'
  let fileName = sanitizeFileName(tab.label)
  let targetPath = `${workspacePath.value}${separator}${fileName}`

  let suffix = 2
  while (documents.value.includes(targetPath)) {
    const stem = fileName.replace(/\.typ$/i, '')
    fileName = `${stem} ${suffix}.typ`
    targetPath = `${workspacePath.value}${separator}${fileName}`
    suffix += 1
  }

  await invoke('write_file', { path: targetPath, contents: tab.content })
  tab.path = targetPath
  tab.label = getFileName(targetPath)
  tab.isDirty = false
  sidebarRef.value?.refresh()
  await refreshDocuments()
  return true
}

const handleNewFile = () => {
  // Always open an in-memory editor tab — never show a file/folder dialog.
  openTabForFile(null, DEFAULT_CONTENT, nextUntitledLabel())
  diagnostics.value = []
  sidebarOpen.value = true
}

const handleBuiltinTemplateSelected = async (templateName: string) => {
  showTemplateModal.value = false
  try {
    const templateContent = await invoke<string>('get_template', { name: templateName })
    const label =
      templateName.charAt(0).toUpperCase() + templateName.slice(1).replace(/-/g, ' ')
    openTabForFile(null, templateContent, label)
    diagnostics.value = []
    sidebarOpen.value = true
  } catch (error) {
    console.error('Failed to create from template:', error)
  }
}

const handleSaveFile = async () => {
  const tab = activeTab.value
  if (!tab) return

  try {
    if (!tab.path) {
      await persistUntitledTab(tab)
      scheduleDiagnostics()
      return
    }

    await invoke('write_file', { path: tab.path, contents: tab.content })
    tab.isDirty = false
    scheduleDiagnostics()
  } catch (error) {
    console.error('Failed to save file:', error)
  }
}

const handleRenameTitle = async (name: string) => {
  const tab = activeTab.value
  if (!tab) return

  const nextLabel = name.trim()
  if (!nextLabel) return

  if (!tab.path) {
    tab.label = nextLabel
    tab.isDirty = true
    return
  }

  const separator = tab.path.includes('\\') ? '\\' : '/'
  const directory = tab.path.split(/[/\\]/).slice(0, -1).join(separator)
  const newPath = `${directory}${separator}${sanitizeFileName(nextLabel)}`

  if (newPath === tab.path) {
    tab.label = getFileName(tab.path)
    return
  }

  try {
    await invoke('rename_file', { oldPath: tab.path, newPath })
    tab.path = newPath
    tab.label = getFileName(newPath)
    sidebarRef.value?.refresh()
    await refreshDocuments()
  } catch (error) {
    console.error('Failed to rename document:', error)
  }
}

const handleWorkspaceSelected = async (path: string) => {
  workspacePath.value = path
  setCurrentWorkspacePath(path)
  mainView.value = 'dashboard'
  openTabs.value = []
  activeTabIndex.value = -1
  diagnostics.value = []

  try {
    const config = await invoke<{ name: string }>('open_workspace', {
      workspacePath: path,
    })
    workspaceName.value = config.name
    upsertRecentWorkspace(config.name, path)
    await refreshDocuments()
  } catch (error) {
    console.error('Failed to load workspace:', error)
    workspacePath.value = null
    workspaceName.value = ''
    setCurrentWorkspacePath(null)
  }
}

const handleWorkspaceRenamed = (name: string) => {
  workspaceName.value = name
  if (workspacePath.value) {
    upsertRecentWorkspace(name, workspacePath.value)
  }
}

const handleAddWorkspace = async () => {
  try {
    const selected = await pickWorkspaceDirectory()
    if (!selected) return

    const config = await createOrOpenWorkspace(selected)
    await handleWorkspaceSelected(config.root || selected)
  } catch (error) {
    console.error('Failed to add workspace:', error)
    alert(`Failed to open workspace folder.\n\n${formatInvokeError(error)}`)
  }
}

const handleFileSelected = async (filePath: string) => {
  try {
    const content = await invoke<string>('read_file', { path: filePath })
    openTabForFile(filePath, content)
    scheduleDiagnostics()
  } catch (error) {
    console.error('Failed to open file:', error)
  }
}

const handleDraftSelected = (id: string) => {
  const index = openTabs.value.findIndex((tab) => tab.id === id)
  if (index < 0) return
  activeTabIndex.value = index
  mainView.value = 'editor'
  diagnostics.value = []
}

const handleDraftRenamed = (id: string, name: string) => {
  const tab = openTabs.value.find((item) => item.id === id)
  if (!tab || tab.path) return
  tab.label = name.trim() || DEFAULT_LABEL
  tab.isDirty = true
}

const handleDraftClosed = (id: string) => {
  const index = openTabs.value.findIndex((tab) => tab.id === id)
  if (index < 0) return

  openTabs.value.splice(index, 1)
  if (openTabs.value.length === 0) {
    activeTabIndex.value = -1
    mainView.value = 'dashboard'
    diagnostics.value = []
    return
  }

  if (activeTabIndex.value >= openTabs.value.length) {
    activeTabIndex.value = openTabs.value.length - 1
  } else if (index < activeTabIndex.value) {
    activeTabIndex.value -= 1
  }
}

const handleFileDeleted = async (filePath: string) => {
  const tabIndex = openTabs.value.findIndex((tab) => tab.path === filePath)
  if (tabIndex >= 0) {
    openTabs.value.splice(tabIndex, 1)
    if (openTabs.value.length === 0) {
      activeTabIndex.value = -1
      mainView.value = 'dashboard'
      diagnostics.value = []
    } else {
      activeTabIndex.value = Math.min(tabIndex, openTabs.value.length - 1)
    }
  }
  await refreshDocuments()
}

const handleFileRenamed = (oldPath: string, newPath: string) => {
  const tab = openTabs.value.find((item) => item.path === oldPath)
  if (tab) {
    tab.path = newPath
    tab.label = getFileName(newPath)
  }
  refreshDocuments()
}

const handleOpenDashboard = () => {
  mainView.value = 'dashboard'
}

const handleDiagnosticClicked = async (diagnostic: DiagnosticInfo) => {
  if (editorMode.value !== 'code') {
    editorMode.value = 'code'
    await nextTick()
  }

  if (diagnostic.span?.line) {
    typstEditorRef.value?.goToLine(diagnostic.span.line, diagnostic.span.column)
  }
}

const handleEditorModeChange = (mode: 'code' | 'text') => {
  editorMode.value = mode
}

const handleKeyDown = (event: KeyboardEvent) => {
  const ctrl = event.ctrlKey || event.metaKey
  if (!ctrl) return

  const target = event.target as HTMLElement | null
  const inEditor = Boolean(
    target?.closest('.ProseMirror, textarea, input, [contenteditable="true"]')
  )

  if (event.key === 's') {
    event.preventDefault()
    if (mainView.value === 'editor') void handleSaveFile()
    return
  }

  if (inEditor) return

  if (event.key === 'n') {
    event.preventDefault()
    handleNewFile()
  } else if (event.key === 'b') {
    event.preventDefault()
    sidebarOpen.value = !sidebarOpen.value
  }
}

watch(mainView, (view) => {
  if (view === 'editor') scheduleDiagnostics()
})

onMounted(async () => {
  applyTheme(appSettings.value.theme)
  startThemeListener()
  window.addEventListener('keydown', handleKeyDown)

  if (!runningInTauri) {
    console.warn(browserModeMessage)
    return
  }

  const savedWorkspace = getCurrentWorkspacePath()
  if (savedWorkspace) {
    await handleWorkspaceSelected(savedWorkspace)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  stopThemeListener()
  if (saveTimeout) clearTimeout(saveTimeout)
  if (diagnosticsTimeout) clearTimeout(diagnosticsTimeout)
})
</script>

<template>
  <div class="flex h-full w-full flex-col bg-background">
    <TemplateModal
      v-model:open="showTemplateModal"
      @template-selected="handleBuiltinTemplateSelected"
    />

    <AppSettingsPanel
      v-model:open="showSettings"
      @change="handleSettingsChange"
    />

    <ContextBar
      :sidebar-open="sidebarOpen"
      :workspace-name="workspaceName"
      :workspace-path="workspacePath"
      :title="contextTitle"
      :is-dirty="activeTab?.isDirty"
      :view="mainView"
      :title-editable="mainView === 'editor' && !!activeTab"
      @toggle-sidebar="sidebarOpen = !sidebarOpen"
      @workspace-selected="handleWorkspaceSelected"
      @workspace-renamed="handleWorkspaceRenamed"
      @open-settings="showSettings = true"
      @rename-title="handleRenameTitle"
    />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <aside
        :class="
          cn(
            'flex h-full shrink-0 flex-col border-r border-border/60 bg-sidebar transition-[width,opacity] duration-200 ease-out',
            sidebarOpen ? 'w-[260px] opacity-100' : 'w-0 overflow-hidden border-r-0 opacity-0'
          )
        "
      >
        <AppSidebar
          v-show="sidebarOpen"
          ref="sidebarRef"
          class="h-full w-[260px]"
          :workspace-path="workspacePath"
          :current-file="currentFile"
          :active-draft-id="activeTab && !activeTab.path ? activeTab.id : null"
          :drafts="drafts"
          :active-view="mainView"
          @file-selected="handleFileSelected"
          @file-deleted="handleFileDeleted"
          @file-renamed="handleFileRenamed"
          @draft-selected="handleDraftSelected"
          @draft-renamed="handleDraftRenamed"
          @draft-closed="handleDraftClosed"
          @open-dashboard="handleOpenDashboard"
          @new-document="handleNewFile"
        />
      </aside>

      <main
        :class="
          cn(
            'flex min-w-0 flex-1 flex-col overflow-hidden',
            mainView === 'editor' ? 'bg-muted/30 p-3' : 'bg-background'
          )
        "
      >
        <DashboardView
          v-if="mainView === 'dashboard'"
          :workspace-name="workspaceName"
          :workspace-path="workspacePath"
          :documents="documents"
          :running-in-tauri="runningInTauri"
          @add-workspace="handleAddWorkspace"
          @new-document="handleNewFile"
          @open-template="showTemplateModal = true"
          @file-selected="handleFileSelected"
        />

        <div
          v-else-if="activeTab"
          class="h-full min-h-0 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm"
        >
          <TypstSourceEditor
            v-if="editorMode === 'code'"
            ref="typstEditorRef"
            :content="activeTab.content"
            :diagnostics="diagnostics"
            :color-mode="editorColorMode"
            :font-size="appSettings.editorFontSize"
            :workspace-path="workspacePath"
            @content-changed="handleContentChanged"
            @update:editor-mode="handleEditorModeChange"
          />
          <RichTextEditor
            v-else
            :content="activeTab.content"
            :workspace-path="workspacePath"
            @content-changed="handleContentChanged"
            @update:editor-mode="handleEditorModeChange"
          />
        </div>

        <div
          v-else
          class="flex h-full items-center justify-center text-sm text-muted-foreground"
        >
          Select a document to start editing.
        </div>
      </main>

      <RightInfoPanel
        v-if="mainView === 'editor' && activeTab"
        class="h-full min-h-0"
        :file-name="activeTab.label"
        :file-path="activeTab.path"
        :file-content="activeTab.content"
        :workspace-path="workspacePath"
        :is-dirty="activeTab.isDirty"
        :auto-save="autoSave"
        :diagnostics="diagnostics"
        :word-count="wordCount"
        :line-count="lineCount"
        :save-document="handleSaveFile"
        @diagnostic-clicked="handleDiagnosticClicked"
      />
    </div>
  </div>
</template>
