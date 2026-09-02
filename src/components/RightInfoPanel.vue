<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  Save,
  AlertCircle,
  AlertTriangle,
  FileText,
  Info,
  History,
  Wrench,
  GitCompare,
  Plus,
  Clock3,
  Eye,
  BookOpen,
  LayoutTemplate,
} from '@lucide/vue'
import type {
  DiagnosticInfo,
  DocumentVersion,
  FileMetadata,
  VersionDiff,
} from '@/types'
import { invoke } from '@/lib/backend'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import VersionDiffDialog from '@/components/VersionDiffDialog.vue'
import LivePreviewPane, { type PreviewMode } from '@/components/LivePreviewPane.vue'
import { cn } from '@/lib/utils'

type PanelSection = 'info' | 'preview' | 'versions' | 'troubleshoot'

const props = defineProps<{
  fileName: string
  filePath: string | null
  fileContent: string
  workspacePath: string | null
  isDirty: boolean
  autoSave: boolean
  diagnostics: DiagnosticInfo[]
  wordCount: number
  lineCount: number
  saveDocument: () => Promise<void>
}>()

const emit = defineEmits<{
  'diagnostic-clicked': [diagnostic: DiagnosticInfo]
}>()

const activeSection = ref<PanelSection>('preview')
const previewMode = ref<PreviewMode>('pages')
const versions = ref<DocumentVersion[]>([])
const metadata = ref<FileMetadata | null>(null)
const versionsLoading = ref(false)
const creatingVersion = ref(false)
const versionError = ref<string | null>(null)
const diffOpen = ref(false)
const diffLoading = ref(false)
const diffError = ref<string | null>(null)
const diff = ref<VersionDiff | null>(null)

const PANEL_WIDTH_KEY = 'latte-right-panel-width'
const MIN_PANEL_WIDTH = 300
const DEFAULT_PANEL_WIDTH = 400

const clampPanelWidth = (width: number) => {
  const max = Math.max(
    MIN_PANEL_WIDTH,
    Math.min(900, Math.floor(window.innerWidth * 0.55))
  )
  return Math.min(max, Math.max(MIN_PANEL_WIDTH, Math.round(width)))
}

const loadPanelWidth = () => {
  const stored = Number(localStorage.getItem(PANEL_WIDTH_KEY))
  if (Number.isFinite(stored) && stored > 0) return clampPanelWidth(stored)
  return DEFAULT_PANEL_WIDTH
}

const panelWidth = ref(loadPanelWidth())
const resizing = ref(false)
let resizeFrame = 0

const persistPanelWidth = () => {
  localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth.value))
}

const stopResize = () => {
  if (!resizing.value) return
  resizing.value = false
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
  persistPanelWidth()
}

const onResizeMove = (event: PointerEvent) => {
  if (!resizing.value) return
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    panelWidth.value = clampPanelWidth(window.innerWidth - event.clientX)
  })
}

const startResize = (event: PointerEvent) => {
  event.preventDefault()
  resizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', stopResize)
}

onBeforeUnmount(stopResize)

const errorCount = computed(
  () => props.diagnostics.filter((d) => d.severity === 'error').length
)
const warningCount = computed(
  () => props.diagnostics.filter((d) => d.severity === 'warning').length
)

const saveStatusLabel = computed(() => {
  if (props.isDirty) return 'Unsaved'
  if (props.autoSave) return 'Auto save'
  return 'Saved'
})

const canVersion = computed(
  () => Boolean(props.workspacePath && props.filePath)
)

const sections = [
  { id: 'preview' as const, label: 'Preview', icon: Eye },
  { id: 'info' as const, label: 'Document', icon: Info },
  { id: 'versions' as const, label: 'Versions', icon: History },
  { id: 'troubleshoot' as const, label: 'Troubleshoot', icon: Wrench },
]

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatTimestamp = (value?: string | null) => {
  if (!value) return '—'
  const asNumber = Number(value)
  const date = Number.isFinite(asNumber) ? new Date(asNumber) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const refreshVersions = async () => {
  versionError.value = null
  if (!canVersion.value || !props.workspacePath || !props.filePath) {
    versions.value = []
    metadata.value = null
    return
  }

  versionsLoading.value = true
  try {
    const [nextVersions, nextMetadata] = await Promise.all([
      invoke<DocumentVersion[]>('list_document_versions', {
        workspacePath: props.workspacePath,
        documentPath: props.filePath,
      }),
      invoke<FileMetadata>('get_document_metadata', {
        workspacePath: props.workspacePath,
        documentPath: props.filePath,
      }),
    ])
    versions.value = nextVersions
    metadata.value = nextMetadata
  } catch (error) {
    console.error('Failed to load versions:', error)
    versionError.value =
      error instanceof Error ? error.message : 'Failed to load versions'
    versions.value = []
  } finally {
    versionsLoading.value = false
  }
}

const handleCreateVersion = async () => {
  if (!canVersion.value || !props.workspacePath || !props.filePath) return

  creatingVersion.value = true
  versionError.value = null
  try {
    if (props.isDirty) {
      await props.saveDocument()
    }
    await invoke<DocumentVersion>('create_document_version', {
      workspacePath: props.workspacePath,
      documentPath: props.filePath,
      contents: props.fileContent,
      label: null,
    })
    await refreshVersions()
  } catch (error) {
    console.error('Failed to create version:', error)
    versionError.value =
      error instanceof Error ? error.message : 'Failed to create version'
  } finally {
    creatingVersion.value = false
  }
}

const handleShowDiff = async (versionId?: string) => {
  if (!canVersion.value || !props.workspacePath || !props.filePath) return

  diffOpen.value = true
  diffLoading.value = true
  diffError.value = null
  diff.value = null

  try {
    diff.value = await invoke<VersionDiff>('diff_document_version', {
      workspacePath: props.workspacePath,
      documentPath: props.filePath,
      currentContents: props.fileContent,
      versionId: versionId ?? null,
    })
  } catch (error) {
    console.error('Failed to compute diff:', error)
    diffError.value =
      error instanceof Error ? error.message : 'Failed to compute diff'
  } finally {
    diffLoading.value = false
  }
}

watch(
  () => [props.filePath, props.workspacePath, activeSection.value] as const,
  ([, , section]) => {
    if (section === 'versions' || section === 'info') {
      void refreshVersions()
    }
  },
  { immediate: true }
)
</script>

<template>
  <div
    class="relative flex h-full min-h-0 shrink-0"
    :class="resizing && 'select-none'"
    :style="{ width: `${panelWidth}px` }"
  >
  <TooltipProvider :delay-duration="200">
    <aside
      class="relative flex h-full min-h-0 w-full border-l border-border/60 bg-card"
    >
      <button
        type="button"
        class="group absolute inset-y-0 -left-1 z-20 w-2 cursor-col-resize touch-none"
        aria-label="Resize panel"
        title="Drag to resize"
        @pointerdown="startResize"
        @dblclick="
          panelWidth = DEFAULT_PANEL_WIDTH;
          persistPanelWidth()
        "
      >
        <span
          :class="
            cn(
              'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors',
              resizing ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/70'
            )
          "
        />
      </button>
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <!-- Preview -->
        <template v-if="activeSection === 'preview'">
          <div class="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview
            </p>
            <div class="flex items-center rounded-xl bg-muted/70 p-0.5">
              <Button
                variant="ghost"
                size="sm"
                :class="
                  cn(
                    'h-7 rounded-lg px-2 text-xs',
                    previewMode === 'html' && 'bg-background shadow-sm'
                  )
                "
                @click="previewMode = 'html'"
              >
                <BookOpen class="mr-1 size-3.5" />
                HTML
              </Button>
              <Button
                variant="ghost"
                size="sm"
                :class="
                  cn(
                    'h-7 rounded-lg px-2 text-xs',
                    previewMode === 'pages' && 'bg-background shadow-sm'
                  )
                "
                @click="previewMode = 'pages'"
              >
                <LayoutTemplate class="mr-1 size-3.5" />
                Pages
              </Button>
            </div>
          </div>
          <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <LivePreviewPane
              class="h-full min-h-0 w-full flex-1"
              :source="fileContent"
              :root-dir="workspacePath"
              :mode="previewMode"
            />
          </div>
        </template>

        <!-- Document info -->
        <template v-else-if="activeSection === 'info'">
          <div class="space-y-4 p-4">
            <div class="flex items-start gap-2">
              <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <h2 class="truncate text-sm font-semibold">{{ fileName }}</h2>
                <p class="truncate text-xs text-muted-foreground">
                  {{ filePath || 'Unsaved document' }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <Badge
                :variant="isDirty ? 'secondary' : 'outline'"
                class="rounded-full"
              >
                {{ saveStatusLabel }}
              </Badge>
              <Badge
                variant="outline"
                class="rounded-full"
              >
                {{ lineCount }} lines
              </Badge>
              <Badge
                variant="outline"
                class="rounded-full"
              >
                {{ wordCount }} words
              </Badge>
            </div>

            <Button
              class="h-9 w-full rounded-xl"
              :disabled="!isDirty"
              @click="saveDocument()"
            >
              <Save class="size-4" />
              Save
            </Button>
          </div>

          <Separator />

          <div class="space-y-3 p-4">
            <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock3 class="size-3.5" />
              Metadata
            </div>

            <div class="space-y-2 text-sm">
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Type</span>
                <span class="truncate font-medium">
                  {{ metadata?.extension ? `.${metadata.extension}` : 'Typst' }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Size</span>
                <span class="font-medium">
                  {{ metadata ? formatBytes(metadata.byteSize) : formatBytes(fileContent.length) }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Modified</span>
                <span class="truncate text-right font-medium">
                  {{ formatTimestamp(metadata?.modifiedAt) }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Versions</span>
                <span class="font-medium">
                  {{ metadata?.versionCount ?? versions.length }}
                </span>
              </div>
            </div>
          </div>
        </template>

        <!-- Versioning -->
        <template v-else-if="activeSection === 'versions'">
          <div class="space-y-3 p-4">
            <div>
              <h2 class="text-sm font-semibold">Versioning</h2>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Snapshot milestones and compare against the current draft.
              </p>
            </div>

            <div class="grid gap-2">
              <Button
                class="h-9 w-full rounded-xl"
                :disabled="!canVersion || creatingVersion"
                @click="handleCreateVersion"
              >
                <Plus class="size-4" />
                {{ creatingVersion ? 'Creating…' : 'Create version' }}
              </Button>
              <Button
                variant="outline"
                class="h-9 w-full rounded-xl"
                :disabled="!canVersion || versions.length === 0 || diffLoading"
                @click="handleShowDiff()"
              >
                <GitCompare class="size-4" />
                Diff from previous
              </Button>
            </div>

            <p
              v-if="!canVersion"
              class="rounded-xl border border-dashed border-border/80 px-3 py-3 text-xs text-muted-foreground"
            >
              Save the document into a workspace to enable versioning.
            </p>
            <p
              v-else-if="versionError"
              class="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3 text-xs text-destructive"
            >
              {{ versionError }}
            </p>
          </div>

          <Separator />

          <div class="flex min-h-0 flex-1 flex-col">
            <div class="flex items-center justify-between px-4 py-3">
              <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                History
              </div>
              <Badge
                variant="outline"
                class="rounded-full"
              >
                {{ versions.length }}
              </Badge>
            </div>

            <ScrollArea class="flex-1 px-3 pb-4">
              <p
                v-if="versionsLoading"
                class="px-1 py-8 text-center text-sm text-muted-foreground"
              >
                Loading versions…
              </p>
              <div
                v-else-if="versions.length === 0"
                class="rounded-2xl border border-dashed border-border/80 px-4 py-8 text-center"
              >
                <p class="text-sm text-muted-foreground">No versions yet</p>
              </div>
              <div
                v-else
                class="flex flex-col gap-2"
              >
                <button
                  v-for="version in versions"
                  :key="version.id"
                  class="rounded-2xl border border-border/70 bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
                  @click="handleShowDiff(version.id)"
                >
                  <div class="mb-1 flex items-center gap-2">
                    <History class="size-3.5 text-primary" />
                    <span class="text-sm font-medium">{{ version.label }}</span>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    {{ formatTimestamp(version.createdAt) }}
                    ·
                    {{ formatBytes(version.byteSize) }}
                  </p>
                  <p class="mt-1 text-[11px] text-muted-foreground">
                    Click to diff against current
                  </p>
                </button>
              </div>
            </ScrollArea>
          </div>
        </template>

        <!-- Troubleshooting -->
        <template v-else-if="activeSection === 'troubleshoot'">
          <div class="flex min-h-0 flex-1 flex-col">
            <div class="flex items-center justify-between px-4 py-3">
              <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Wrench class="size-3.5" />
                Diagnostics
              </div>
              <div class="flex gap-1">
                <Badge
                  v-if="errorCount"
                  variant="destructive"
                  class="rounded-full px-1.5"
                >
                  {{ errorCount }}
                </Badge>
                <Badge
                  v-if="warningCount"
                  variant="secondary"
                  class="rounded-full px-1.5"
                >
                  {{ warningCount }}
                </Badge>
              </div>
            </div>

            <ScrollArea class="flex-1 px-3 pb-4">
              <div
                v-if="diagnostics.length === 0"
                class="rounded-2xl border border-dashed border-border/80 px-4 py-8 text-center"
              >
                <p class="text-sm text-muted-foreground">No issues found</p>
              </div>

              <div
                v-else
                class="flex flex-col gap-2"
              >
                <button
                  v-for="(diagnostic, index) in diagnostics"
                  :key="index"
                  :class="
                    cn(
                      'rounded-2xl border p-3 text-left transition-colors hover:bg-muted/40',
                      diagnostic.severity === 'error'
                        ? 'border-destructive/30 bg-destructive/5'
                        : 'border-border/70 bg-muted/20'
                    )
                  "
                  @click="emit('diagnostic-clicked', diagnostic)"
                >
                  <div class="mb-1.5 flex items-center gap-2">
                    <AlertCircle
                      v-if="diagnostic.severity === 'error'"
                      class="size-3.5 text-destructive"
                    />
                    <AlertTriangle
                      v-else
                      class="size-3.5 text-amber-500"
                    />
                    <span class="text-[11px] font-semibold uppercase tracking-wide">
                      {{ diagnostic.severity }}
                    </span>
                    <span
                      v-if="diagnostic.span"
                      class="ml-auto text-[11px] text-muted-foreground"
                    >
                      L{{ diagnostic.span.line }}:{{ diagnostic.span.column }}
                    </span>
                  </div>
                  <p class="text-sm leading-snug">{{ diagnostic.message }}</p>
                </button>
              </div>
            </ScrollArea>
          </div>
        </template>
      </div>

      <nav class="flex w-12 shrink-0 flex-col items-center gap-1 border-l border-border/60 py-3">
        <Tooltip
          v-for="section in sections"
          :key="section.id"
        >
          <TooltipTrigger as-child>
            <button
              type="button"
              :class="
                cn(
                  'relative flex size-9 items-center justify-center rounded-xl transition-colors',
                  activeSection === section.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                )
              "
              :aria-label="section.label"
              :aria-pressed="activeSection === section.id"
              @click="activeSection = section.id"
            >
              <component
                :is="section.icon"
                class="size-4"
              />
              <span
                v-if="section.id === 'troubleshoot' && errorCount > 0"
                class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive"
              />
              <span
                v-else-if="section.id === 'troubleshoot' && warningCount > 0"
                class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-amber-500"
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{{ section.label }}</TooltipContent>
        </Tooltip>
      </nav>
    </aside>

    <VersionDiffDialog
      v-model:open="diffOpen"
      :diff="diff"
      :loading="diffLoading"
      :error="diffError"
    />
  </TooltipProvider>
  </div>
</template>
