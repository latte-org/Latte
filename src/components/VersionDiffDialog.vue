<script setup lang="ts">
import { computed } from 'vue'
import type { VersionDiff } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const props = defineProps<{
  open: boolean
  diff: VersionDiff | null
  loading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const title = computed(() => {
  if (!props.diff) return 'Changes'
  const from = props.diff.fromLabel || 'Previous version'
  return `${from} → ${props.diff.toLabel}`
})
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="flex max-h-[85vh] w-[min(920px,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px]">
      <DialogHeader class="space-y-2 border-b border-border/60 px-6 py-4">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription class="flex flex-wrap items-center gap-2">
          <span>Line changes since the selected version.</span>
          <template v-if="diff">
            <Badge
              variant="outline"
              class="rounded-full border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
            >
              +{{ diff.additions }}
            </Badge>
            <Badge
              variant="outline"
              class="rounded-full border-rose-500/40 text-rose-700 dark:text-rose-400"
            >
              −{{ diff.deletions }}
            </Badge>
          </template>
        </DialogDescription>
      </DialogHeader>

      <ScrollArea class="min-h-0 flex-1">
        <div class="px-2 py-3 font-mono text-[12px] leading-5">
          <p
            v-if="loading"
            class="px-4 py-8 text-center text-sm text-muted-foreground"
          >
            Computing diff…
          </p>
          <p
            v-else-if="error"
            class="px-4 py-8 text-center text-sm text-destructive"
          >
            {{ error }}
          </p>
          <p
            v-else-if="diff && diff.lines.length === 0"
            class="px-4 py-8 text-center text-sm text-muted-foreground"
          >
            No differences from the previous version.
          </p>
          <div
            v-else-if="diff"
            class="flex flex-col"
          >
            <div
              v-for="(line, index) in diff.lines"
              :key="index"
              :class="
                cn(
                  'grid grid-cols-[3rem_3rem_1.25rem_1fr] gap-1 px-3',
                  line.kind === 'add' && 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
                  line.kind === 'remove' && 'bg-rose-500/10 text-rose-900 dark:text-rose-100',
                  line.kind === 'equal' && 'text-muted-foreground'
                )
              "
            >
              <span class="select-none text-right opacity-50">
                {{ line.oldLine ?? '' }}
              </span>
              <span class="select-none text-right opacity-50">
                {{ line.newLine ?? '' }}
              </span>
              <span class="select-none text-center font-semibold">
                {{ line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' ' }}
              </span>
              <span class="whitespace-pre-wrap break-all">{{ line.text || ' ' }}</span>
            </div>
          </div>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
