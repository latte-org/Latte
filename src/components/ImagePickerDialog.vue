<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { FolderPlus, Image as ImageIcon } from '@lucide/vue'
import { isTauri } from '@/lib/backend'
import {
  listWorkspaceImages,
  pickAndImportWorkspaceImage,
  type WorkspaceImage,
} from '@/lib/workspaceImages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps<{
  open: boolean
  workspacePath: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [relativePath: string]
}>()

const images = ref<WorkspaceImage[]>([])
const query = ref('')
const loading = ref(false)
const importing = ref(false)
const error = ref<string | null>(null)
const selectedPath = ref<string | null>(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return images.value
  return images.value.filter(
    (image) => image.name.toLowerCase().includes(q) || image.relativePath.toLowerCase().includes(q)
  )
})

const loadImages = async () => {
  if (!props.workspacePath) {
    images.value = []
    return
  }
  loading.value = true
  error.value = null
  try {
    images.value = await listWorkspaceImages(props.workspacePath)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    images.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.workspacePath] as const,
  ([open]) => {
    if (!open) return
    query.value = ''
    selectedPath.value = null
    error.value = null
    void loadImages()
  }
)

const previewSrc = (path: string) => {
  try {
    return convertFileSrc(path)
  } catch {
    return ''
  }
}

const choose = (image: WorkspaceImage) => {
  emit('select', image.relativePath.replace(/\\/g, '/'))
  emit('update:open', false)
}

const confirmSelected = () => {
  const image = images.value.find((item) => item.path === selectedPath.value)
  if (image) choose(image)
}

const importImage = async () => {
  if (!props.workspacePath || !isTauri()) return
  importing.value = true
  error.value = null
  try {
    const imported = await pickAndImportWorkspaceImage(props.workspacePath)
    if (!imported) return
    emit('select', imported.relativePath.replace(/\\/g, '/'))
    emit('update:open', false)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-xl">
      <DialogHeader class="space-y-1 border-b border-border/60 px-6 py-5">
        <DialogTitle>Insert picture</DialogTitle>
        <DialogDescription>
          Choose an image already in this workspace, or import one into the assets folder.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 p-5">
        <div class="flex gap-2">
          <Input
            v-model="query"
            placeholder="Search images…"
            class="h-9"
            :disabled="!workspacePath"
          />
          <Button
            type="button"
            class="shrink-0"
            :disabled="!workspacePath || importing"
            @click="importImage"
          >
            <FolderPlus class="size-4" />
            Import…
          </Button>
        </div>

        <p
          v-if="!workspacePath"
          class="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground"
        >
          Open a workspace first so the picture can be stored next to your document.
        </p>
        <p
          v-else-if="error"
          class="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {{ error }}
        </p>
        <p
          v-else-if="loading"
          class="text-sm text-muted-foreground"
        >
          Loading images…
        </p>
        <p
          v-else-if="filtered.length === 0"
          class="text-sm text-muted-foreground"
        >
          No images in this workspace yet. Import a file to add it to
          <span class="font-mono">assets/</span>.
        </p>

        <div
          v-else
          class="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2"
        >
          <button
            v-for="image in filtered"
            :key="image.path"
            type="button"
            class="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-2.5 text-left transition hover:border-primary/30 hover:bg-accent/40"
            :class="selectedPath === image.path && 'border-primary/50 bg-primary/5'"
            @click="selectedPath = image.path"
            @dblclick="choose(image)"
          >
            <img
              v-if="previewSrc(image.path)"
              :src="previewSrc(image.path)"
              :alt="image.name"
              class="size-12 shrink-0 rounded-lg object-cover bg-muted"
            />
            <div
              v-else
              class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted"
            >
              <ImageIcon class="size-5 text-muted-foreground" />
            </div>
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium">{{ image.name }}</span>
              <span class="block truncate font-mono text-[11px] text-muted-foreground">{{ image.relativePath }}</span>
            </span>
          </button>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
          <Button
            type="button"
            :disabled="!selectedPath"
            @click="confirmSelected"
          >
            Insert
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
