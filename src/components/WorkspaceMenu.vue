<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  Check,
  ChevronDown,
  FolderOpen,
  FolderPlus,
  Pencil,
  Search,
} from '@lucide/vue'
import { invoke } from '@/lib/backend'
import {
  loadRecentWorkspaces,
  renameRecentWorkspace,
  type RecentWorkspace,
} from '@/lib/workspaces'
import {
  createOrOpenWorkspace,
  formatInvokeError,
  pickWorkspaceDirectory,
} from '@/lib/workspaceActions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const props = defineProps<{
  workspaceName: string
  workspacePath: string | null
}>()

const emit = defineEmits<{
  'workspace-selected': [path: string]
  'workspace-renamed': [name: string]
}>()

const menuOpen = ref(false)
const searchQuery = ref('')
const recentWorkspaces = ref<RecentWorkspace[]>(loadRecentWorkspaces())
const renameOpen = ref(false)
const renameValue = ref('')
let renameInputEl: HTMLInputElement | null = null

const setRenameInputRef = (el: unknown) => {
  renameInputEl = el instanceof HTMLInputElement ? el : null
}

const filteredWorkspaces = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return recentWorkspaces.value
  return recentWorkspaces.value.filter(
    (workspace) =>
      workspace.name.toLowerCase().includes(query) ||
      workspace.root.toLowerCase().includes(query)
  )
})

const refreshRecent = () => {
  recentWorkspaces.value = loadRecentWorkspaces()
}

watch(menuOpen, (open) => {
  if (open) {
    refreshRecent()
    searchQuery.value = ''
  }
})

watch(renameOpen, async (open) => {
  if (!open) return
  renameValue.value = props.workspaceName
  await nextTick()
  renameInputEl?.focus()
  renameInputEl?.select()
})

const selectWorkspace = (path: string) => {
  menuOpen.value = false
  emit('workspace-selected', path)
}

const handleAddWorkspace = async () => {
  menuOpen.value = false
  try {
    const workspacePath = await pickWorkspaceDirectory()
    if (!workspacePath) return

    const config = await createOrOpenWorkspace(workspacePath)
    refreshRecent()
    emit('workspace-selected', config.root || workspacePath)
  } catch (error) {
    console.error('Failed to add workspace:', error)
    alert(`Failed to open workspace folder.\n\n${formatInvokeError(error)}`)
  }
}

const openRenameDialog = () => {
  if (!props.workspacePath) return
  menuOpen.value = false
  renameOpen.value = true
}

const submitRename = async () => {
  if (!props.workspacePath) return

  const nextName = renameValue.value.trim()
  if (!nextName || nextName === props.workspaceName) {
    renameOpen.value = false
    return
  }

  try {
    const config = await invoke<{ name: string }>('update_workspace_settings', {
      workspacePath: props.workspacePath,
      name: nextName,
    })
    renameRecentWorkspace(props.workspacePath, config.name || nextName)
    refreshRecent()
    emit('workspace-renamed', config.name || nextName)
    renameOpen.value = false
  } catch (error) {
    console.error('Failed to rename workspace:', error)
    alert(`Failed to rename workspace.\n\n${formatInvokeError(error)}`)
  }
}

defineExpose({
  openAddWorkspace: handleAddWorkspace,
  refreshRecent,
})
</script>

<template>
  <DropdownMenu v-model:open="menuOpen">
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        class="h-9 max-w-[260px] gap-2 rounded-xl border-border/70 bg-background px-3 font-medium shadow-none"
      >
        <FolderOpen class="size-4 shrink-0 text-muted-foreground" />
        <span class="truncate">{{ workspaceName || 'No workspace' }}</span>
        <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      align="start"
      class="w-80 rounded-2xl p-0"
      :collision-padding="12"
    >
      <div
        class="border-b border-border/60 p-2"
        @pointerdown.stop
        @keydown.stop
      >
        <div class="relative">
          <Search class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Search workspaces…"
            class="h-8 rounded-xl border-0 bg-muted/50 pl-8 shadow-none focus-visible:ring-1"
          />
        </div>
      </div>

      <div class="max-h-56 overflow-y-auto p-1">
        <DropdownMenuItem
          v-for="workspace in filteredWorkspaces"
          :key="workspace.root"
          class="cursor-pointer gap-2 rounded-xl px-2.5 py-2"
          @select="selectWorkspace(workspace.root)"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ workspace.name }}</p>
            <p class="truncate text-[11px] text-muted-foreground">{{ workspace.root }}</p>
          </div>
          <Check
            v-if="workspace.root === workspacePath"
            class="size-4 shrink-0 text-primary"
          />
        </DropdownMenuItem>

        <p
          v-if="filteredWorkspaces.length === 0"
          class="px-3 py-6 text-center text-xs text-muted-foreground"
        >
          {{
            searchQuery.trim()
              ? 'No matching workspaces'
              : 'No recent workspaces yet'
          }}
        </p>
      </div>

      <DropdownMenuSeparator class="my-0" />

      <div class="p-1">
        <DropdownMenuItem
          class="cursor-pointer gap-2 rounded-xl px-2.5 py-2"
          @select="handleAddWorkspace"
        >
          <FolderPlus class="size-4" />
          Add new workspace
        </DropdownMenuItem>

        <DropdownMenuItem
          class="cursor-pointer gap-2 rounded-xl px-2.5 py-2"
          :disabled="!workspacePath"
          @select="openRenameDialog"
        >
          <Pencil class="size-4" />
          Rename space
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>

  <Dialog v-model:open="renameOpen">
    <DialogContent class="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
      <DialogHeader class="space-y-1 border-b border-border/60 px-6 py-5">
        <DialogTitle>Rename workspace</DialogTitle>
        <DialogDescription>
          Choose a display name for this workspace. The folder on disk stays the same.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 p-6">
        <input
          :ref="setRenameInputRef"
          v-model="renameValue"
          class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-3"
          placeholder="Workspace name"
          @keydown.enter="submitRename"
        />
        <p
          v-if="workspacePath"
          :class="cn('truncate text-xs text-muted-foreground')"
        >
          {{ workspacePath }}
        </p>
      </div>

      <DialogFooter class="border-t border-border/60 px-6 py-4">
        <Button
          variant="outline"
          class="rounded-xl"
          @click="renameOpen = false"
        >
          Cancel
        </Button>
        <Button
          class="rounded-xl"
          :disabled="!renameValue.trim()"
          @click="submitRename"
        >
          Save name
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
