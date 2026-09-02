<script setup lang="ts">
import { computed } from 'vue'
import {
  FileText,
  Plus,
  FolderPlus,
  LayoutTemplate,
  PanelLeft,
  Type,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import LatteBrand from '@/components/LatteBrand.vue'

const props = defineProps<{
  workspaceName: string
  workspacePath: string | null
  documents: string[]
  runningInTauri: boolean
}>()

const emit = defineEmits<{
  'add-workspace': []
  'new-document': []
  'open-template': []
  'file-selected': [path: string]
}>()

const getFileName = (path: string) => path.split(/[/\\]/).pop() || path

const recentDocuments = computed(() => props.documents.slice(0, 8))
</script>

<template>
  <ScrollArea class="h-full">
    <div class="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-10">
      <!-- Welcome state when no workspace -->
      <template v-if="!workspacePath">
        <section class="space-y-5">
          <LatteBrand size="lg" />
          <div class="space-y-3">
            <h1 class="text-3xl font-semibold tracking-tight text-foreground">
              Write Typst documents, simply
            </h1>
            <p class="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Latte is your focused Typst workspace. Open a folder, manage documents,
              and edit in Typst or plain text — without the clutter.
            </p>
          </div>
        </section>

        <section class="grid gap-3 sm:grid-cols-2">
          <button
            class="flex flex-col items-start gap-3 rounded-3xl border border-border/70 bg-card p-5 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
            @click="emit('add-workspace')"
          >
            <div class="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FolderPlus class="size-5" />
            </div>
            <div>
              <p class="font-medium">Add a workspace</p>
              <p class="mt-1 text-xs text-muted-foreground">
                Choose a folder — its name becomes the workspace name
              </p>
            </div>
          </button>

          <div class="flex flex-col items-start gap-3 rounded-3xl border border-dashed border-border/70 bg-muted/20 p-5">
            <div class="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <PanelLeft class="size-5" />
            </div>
            <div>
              <p class="font-medium">Use the top menu</p>
              <p class="mt-1 text-xs text-muted-foreground">
                Search recent workspaces, add a new one, or rename the current space
              </p>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
          <h2 class="text-sm font-semibold">Quick tips</h2>
          <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
            <li class="flex gap-2">
              <Type class="mt-0.5 size-4 shrink-0 text-primary" />
              Switch between Typst and Text mode from the right panel while editing.
            </li>
            <li class="flex gap-2">
              <FileText class="mt-0.5 size-4 shrink-0 text-primary" />
              Documents in your workspace appear in the sidebar for quick access.
            </li>
            <li class="flex gap-2">
              <LayoutTemplate class="mt-0.5 size-4 shrink-0 text-primary" />
              Start from a template once a workspace is open.
            </li>
          </ul>
        </section>
      </template>

      <!-- Active workspace dashboard -->
      <template v-else>
        <section class="space-y-3">
          <LatteBrand size="md" />
          <div class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Workspace dashboard
          </div>
          <h1 class="text-3xl font-semibold tracking-tight text-foreground">
            {{ workspaceName }}
          </h1>
          <p class="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Manage documents, start from a template, or continue where you left off in Latte.
          </p>
          <p class="truncate text-xs text-muted-foreground/80">
            {{ workspacePath }}
          </p>
        </section>

        <section class="grid gap-3 sm:grid-cols-3">
          <button
            class="flex flex-col items-start gap-3 rounded-3xl border border-border/70 bg-card p-5 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
            @click="emit('new-document')"
          >
            <div class="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Plus class="size-5" />
            </div>
            <div>
              <p class="font-medium">New document</p>
              <p class="mt-1 text-xs text-muted-foreground">Create a blank Typst file</p>
            </div>
          </button>

          <button
            class="flex flex-col items-start gap-3 rounded-3xl border border-border/70 bg-card p-5 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
            @click="emit('open-template')"
          >
            <div class="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LayoutTemplate class="size-5" />
            </div>
            <div>
              <p class="font-medium">From template</p>
              <p class="mt-1 text-xs text-muted-foreground">Start with a ready layout</p>
            </div>
          </button>

          <button
            class="flex flex-col items-start gap-3 rounded-3xl border border-border/70 bg-card p-5 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
            @click="emit('add-workspace')"
          >
            <div class="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FolderPlus class="size-5" />
            </div>
            <div>
              <p class="font-medium">Add workspace</p>
              <p class="mt-1 text-xs text-muted-foreground">Open another folder</p>
            </div>
          </button>
        </section>

        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold">Documents</h2>
            <Badge
              variant="secondary"
              class="rounded-full"
            >
              {{ documents.length }}
            </Badge>
          </div>

          <div
            v-if="documents.length === 0"
            class="rounded-3xl border border-dashed border-border px-6 py-12 text-center"
          >
            <p class="text-sm text-muted-foreground">No documents in this workspace yet.</p>
            <Button
              class="mt-4 rounded-xl"
              @click="emit('new-document')"
            >
              <Plus class="size-4" />
              Create document
            </Button>
          </div>

          <div
            v-else
            class="grid gap-2"
          >
            <button
              v-for="doc in recentDocuments"
              :key="doc"
              class="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-left transition hover:border-primary/25 hover:bg-accent/40"
              @click="emit('file-selected', doc)"
            >
              <div class="flex size-9 items-center justify-center rounded-xl bg-muted">
                <FileText class="size-4 text-muted-foreground" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ getFileName(doc) }}</p>
                <p class="truncate text-xs text-muted-foreground">{{ doc }}</p>
              </div>
            </button>
          </div>
        </section>
      </template>

      <p
        v-if="!runningInTauri"
        class="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
      >
        Running in browser mode. Open Latte through Tauri for full filesystem access.
      </p>
    </div>
  </ScrollArea>
</template>
