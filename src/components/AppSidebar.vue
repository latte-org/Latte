<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import {
  LayoutDashboard,
  FileText,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
} from '@lucide/vue'
import { invoke } from '@/lib/backend'
import type { DraftDocument } from '@/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const props = defineProps<{
  workspacePath: string | null
  currentFile: string | null
  activeDraftId: string | null
  drafts: DraftDocument[]
  activeView: 'dashboard' | 'editor'
}>()

const emit = defineEmits<{
  'file-selected': [path: string]
  'file-deleted': [path: string]
  'file-renamed': [oldPath: string, newPath: string]
  'draft-selected': [id: string]
  'draft-renamed': [id: string, name: string]
  'draft-closed': [id: string]
  'open-dashboard': []
  'new-document': []
}>()

const documents = ref<string[]>([])
const renamingKey = ref<string | null>(null)
const renameValue = ref('')
let renameInputEl: HTMLInputElement | null = null

const setRenameInputRef = (el: unknown) => {
  renameInputEl = el instanceof HTMLInputElement ? el : null
}

const getFileName = (path: string) => path.split(/[/\\]/).pop() || path

const getDirectory = (path: string) => {
  const parts = path.split(/[/\\]/)
  parts.pop()
  return parts.join(path.includes('\\') ? '\\' : '/')
}

const draftKey = (id: string) => 'draft:' + id
const fileKey = (path: string) => 'file:' + path

const isEmpty = computed(
  () => props.drafts.length === 0 && documents.value.length === 0
)

const loadDocuments = async () => {
  if (!props.workspacePath) {
    documents.value = []
    return
  }

  try {
    documents.value = await invoke<string[]>('list_workspace_documents', {
      workspacePath: props.workspacePath,
    })
  } catch (error) {
    console.error('Failed to load documents:', error)
    documents.value = []
  }
}

const refresh = async () => {
  await loadDocuments()
}

const handleDelete = async (filePath: string) => {
  if (!confirm('Delete ' + getFileName(filePath) + '?')) return

  try {
    await invoke('delete_file', { path: filePath })
    emit('file-deleted', filePath)
    await loadDocuments()
  } catch (error) {
    console.error('Failed to delete file:', error)
  }
}

const startRenameFile = async (filePath: string) => {
  renamingKey.value = fileKey(filePath)
  renameValue.value = getFileName(filePath)
  await nextTick()
  renameInputEl?.focus()
  renameInputEl?.select()
}

const startRenameDraft = async (draft: DraftDocument) => {
  renamingKey.value = draftKey(draft.id)
  renameValue.value = draft.label
  await nextTick()
  renameInputEl?.focus()
  renameInputEl?.select()
}

const cancelRename = () => {
  renamingKey.value = null
  renameValue.value = ''
}

const submitRenameFile = async (filePath: string) => {
  if (renamingKey.value !== fileKey(filePath)) return

  const newName = renameValue.value.trim()
  renamingKey.value = null

  if (!newName || newName === getFileName(filePath)) {
    renameValue.value = ''
    return
  }

  const separator = filePath.includes('\\') ? '\\' : '/'
  const newPath =
    getDirectory(filePath) +
    separator +
    (newName.endsWith('.typ') ? newName : newName + '.typ')

  try {
    await invoke('rename_file', { oldPath: filePath, newPath })
    emit('file-renamed', filePath, newPath)
    await loadDocuments()
  } catch (error) {
    console.error('Failed to rename file:', error)
  } finally {
    renameValue.value = ''
  }
}

const submitRenameDraft = (draft: DraftDocument) => {
  if (renamingKey.value !== draftKey(draft.id)) return

  const newName = renameValue.value.trim()
  renamingKey.value = null

  if (!newName || newName === draft.label) {
    renameValue.value = ''
    return
  }

  emit('draft-renamed', draft.id, newName)
  renameValue.value = ''
}

watch(() => props.workspacePath, loadDocuments, { immediate: true })
onMounted(loadDocuments)

defineExpose({ refresh })
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <aside class="flex h-full w-full min-w-[260px] flex-col bg-sidebar text-sidebar-foreground">
      <div class="p-3">
        <Button
          variant="ghost"
          :class="
            cn(
              'h-10 w-full justify-start gap-2.5 rounded-xl px-3 font-medium',
              activeView === 'dashboard' &&
                'bg-sidebar-accent text-sidebar-accent-foreground'
            )
          "
          @click="emit('open-dashboard')"
        >
          <LayoutDashboard class="size-4 shrink-0" />
          Workspace
        </Button>
      </div>

      <Separator class="opacity-60" />

      <div class="flex items-center justify-between px-4 pb-1 pt-3">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Documents
        </span>
        <div class="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 rounded-lg"
                @click="refresh"
              >
                <RefreshCw class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 rounded-lg"
                @click="emit('new-document')"
              >
                <Plus class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New document</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea class="min-h-0 flex-1 px-2 pb-3">
        <div class="flex flex-col gap-0.5 pr-2">
          <div
            v-for="draft in drafts"
            :key="draft.id"
            :class="
              cn(
                'group flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors',
                activeView === 'editor' && draft.id === activeDraftId
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/60'
              )
            "
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 text-left"
              @click="emit('draft-selected', draft.id)"
            >
              <FileText class="size-4 shrink-0 opacity-70" />
              <span
                v-if="renamingKey !== draftKey(draft.id)"
                class="truncate"
              >
                {{ draft.label }}
              </span>
              <input
                v-else
                :ref="setRenameInputRef"
                v-model="renameValue"
                class="h-7 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs outline-none ring-ring focus:ring-2"
                @keydown.enter="submitRenameDraft(draft)"
                @keydown.escape="cancelRename"
                @blur="submitRenameDraft(draft)"
                @click.stop
              />
            </button>

            <div
              v-if="renamingKey !== draftKey(draft.id)"
              class="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Button
                variant="ghost"
                size="icon"
                class="size-6 rounded-md"
                @click.stop="startRenameDraft(draft)"
              >
                <Pencil class="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="size-6 rounded-md text-destructive hover:text-destructive"
                @click.stop="emit('draft-closed', draft.id)"
              >
                <Trash2 class="size-3" />
              </Button>
            </div>
          </div>

          <div
            v-for="doc in documents"
            :key="doc"
            :class="
              cn(
                'group flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors',
                activeView === 'editor' && doc === currentFile
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/60'
              )
            "
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 text-left"
              @click="emit('file-selected', doc)"
            >
              <FileText class="size-4 shrink-0 opacity-70" />
              <span
                v-if="renamingKey !== fileKey(doc)"
                class="truncate"
              >
                {{ getFileName(doc) }}
              </span>
              <input
                v-else
                :ref="setRenameInputRef"
                v-model="renameValue"
                class="h-7 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs outline-none ring-ring focus:ring-2"
                @keydown.enter="submitRenameFile(doc)"
                @keydown.escape="cancelRename"
                @blur="submitRenameFile(doc)"
                @click.stop
              />
            </button>

            <div
              v-if="renamingKey !== fileKey(doc)"
              class="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Button
                variant="ghost"
                size="icon"
                class="size-6 rounded-md"
                @click.stop="startRenameFile(doc)"
              >
                <Pencil class="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="size-6 rounded-md text-destructive hover:text-destructive"
                @click.stop="handleDelete(doc)"
              >
                <Trash2 class="size-3" />
              </Button>
            </div>
          </div>

          <div
            v-if="isEmpty"
            class="px-3 py-8 text-center text-xs text-muted-foreground"
          >
            No documents yet
          </div>
        </div>
      </ScrollArea>
    </aside>
  </TooltipProvider>
</template>
