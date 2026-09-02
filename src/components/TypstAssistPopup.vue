<script setup lang="ts">
import { computed } from 'vue'
import type { AssistItem } from '@/lib/typst-catalog'
import { cn } from '@/lib/utils'

const props = defineProps<{
  items: AssistItem[]
  activeIndex: number
  help: AssistItem | null
  top: number
  left: number
  inCall: boolean
  needsHash?: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
  hover: [index: number]
}>()

const kindLabel = (item: AssistItem) => {
  if (item.kind === 'custom') return 'custom'
  if (item.kind === 'variable') return 'var'
  if (item.kind === 'keyword') return 'keyword'
  if (item.kind === 'markup') return 'markup'
  return 'function'
}

const itemLabel = (item: AssistItem) => {
  if ('hash' in item && item.hash === false) return item.name
  if (item.kind === 'variable' && props.needsHash === false) return item.name
  return `#${item.name}`
}

const activeHelp = computed(() => {
  if (props.help && (props.inCall || props.items.length === 0)) return props.help
  return props.items[props.activeIndex] ?? props.help
})
</script>

<template>
  <div
    class="typst-assist-popup absolute z-50 flex max-h-80 min-w-[18rem] max-w-[28rem] overflow-hidden rounded-xl border border-border/70 bg-popover text-popover-foreground shadow-xl"
    :style="{ top: `${top}px`, left: `${left}px` }"
  >
    <div
      v-if="items.length"
      class="min-w-[10.5rem] max-w-[13rem] overflow-auto border-r border-border/60 py-1"
    >
      <button
        v-for="(item, index) in items"
        :key="item.name + item.kind"
        type="button"
        :class="
          cn(
            'flex w-full items-baseline justify-between gap-2 px-2.5 py-1.5 text-left text-xs',
            index === activeIndex ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/70'
          )
        "
        @mousedown.prevent="emit('select', index)"
        @mouseenter="emit('hover', index)"
      >
        <span class="truncate font-mono">{{ itemLabel(item) }}</span>
        <span class="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
          {{ kindLabel(item) }}
        </span>
      </button>
    </div>

    <div
      v-if="activeHelp"
      class="min-w-0 flex-1 overflow-auto px-3 py-2.5"
    >
      <p class="font-mono text-xs font-semibold">
        {{ itemLabel(activeHelp) }}
        <span
          v-if="activeHelp.kind === 'custom' || activeHelp.kind === 'variable'"
          class="ml-1.5 align-middle text-[10px] font-sans font-semibold uppercase tracking-wide text-primary"
        >{{ activeHelp.kind === 'variable' ? 'variable' : 'custom' }}</span>
      </p>
      <p class="mt-1 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
        {{ activeHelp.signature }}
      </p>
      <p class="mt-2 text-xs leading-relaxed">
        {{ activeHelp.description }}
      </p>
      <p class="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        How to use
      </p>
      <pre class="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/60 px-2 py-1.5 font-mono text-[11px] leading-relaxed">{{ activeHelp.usage }}</pre>
    </div>
  </div>
</template>
