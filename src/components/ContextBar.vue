<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { PanelLeft, Settings2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import WorkspaceMenu from '@/components/WorkspaceMenu.vue'
import LatteBrand from '@/components/LatteBrand.vue'

const props = defineProps<{
  sidebarOpen: boolean
  workspaceName: string
  workspacePath: string | null
  title: string
  isDirty?: boolean
  view: 'dashboard' | 'editor'
  titleEditable?: boolean
}>()

const emit = defineEmits<{
  'toggle-sidebar': []
  'workspace-selected': [path: string]
  'workspace-renamed': [name: string]
  'open-settings': []
  'rename-title': [name: string]
}>()

const renaming = ref(false)
const renameValue = ref('')
let renameInputEl: HTMLInputElement | null = null

const setRenameInputRef = (el: unknown) => {
  renameInputEl = el instanceof HTMLInputElement ? el : null
}

watch(
  () => props.title,
  () => {
    if (!renaming.value) renameValue.value = props.title
  }
)

const startRename = async () => {
  if (!props.titleEditable || props.view !== 'editor') return
  renaming.value = true
  renameValue.value = props.title
  await nextTick()
  renameInputEl?.focus()
  renameInputEl?.select()
}

const cancelRename = () => {
  renaming.value = false
  renameValue.value = props.title
}

const submitRename = () => {
  if (!renaming.value) return
  const next = renameValue.value.trim()
  renaming.value = false
  if (!next || next === props.title) {
    renameValue.value = props.title
    return
  }
  emit('rename-title', next)
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <header
      class="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-card/80 px-3 backdrop-blur-sm"
    >
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-9 rounded-xl"
            @click="$emit('toggle-sidebar')"
          >
            <PanelLeft class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ sidebarOpen ? 'Hide sidebar' : 'Show sidebar' }}
        </TooltipContent>
      </Tooltip>

      <LatteBrand size="sm" />

      <div class="mx-1 h-5 w-px bg-border/80" />

      <WorkspaceMenu
        :workspace-name="workspaceName"
        :workspace-path="workspacePath"
        @workspace-selected="$emit('workspace-selected', $event)"
        @workspace-renamed="$emit('workspace-renamed', $event)"
      />

      <div class="mx-2 h-5 w-px bg-border/80" />

      <div class="flex min-w-0 flex-1 items-center gap-2">
        <input
          v-if="renaming"
          :ref="setRenameInputRef"
          v-model="renameValue"
          class="h-8 max-w-md min-w-[10rem] flex-1 rounded-xl border border-input bg-background px-2.5 text-sm font-medium outline-none ring-ring focus:ring-2"
          @keydown.enter="submitRename"
          @keydown.escape="cancelRename"
          @blur="submitRename"
        />
        <button
          v-else
          type="button"
          class="truncate rounded-lg px-1.5 py-1 text-left text-sm font-medium text-foreground transition-colors"
          :class="
            titleEditable && view === 'editor'
              ? 'hover:bg-muted/80 cursor-text'
              : 'cursor-default'
          "
          :title="titleEditable && view === 'editor' ? 'Click to rename' : undefined"
          @click="startRename"
        >
          {{ title }}
        </button>
        <Badge
          v-if="view === 'editor' && isDirty"
          variant="secondary"
          class="rounded-full px-2 text-[10px] uppercase tracking-wide"
        >
          Unsaved
        </Badge>
      </div>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-9 shrink-0 rounded-xl"
            @click="$emit('open-settings')"
          >
            <Settings2 class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Latte options</TooltipContent>
      </Tooltip>
    </header>
  </TooltipProvider>
</template>
