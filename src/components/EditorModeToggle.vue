<script setup lang="ts">
import { Code2, Type } from '@lucide/vue'
import { cn } from '@/lib/utils'

defineProps<{
  modelValue: 'code' | 'text'
}>()

const emit = defineEmits<{
  'update:modelValue': [mode: 'code' | 'text']
}>()
</script>

<template>
  <div class="flex items-center rounded-xl bg-muted/70 p-0.5">
    <button
      type="button"
      :class="
        cn(
          'inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors',
          modelValue === 'code'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )
      "
      @click="emit('update:modelValue', 'code')"
    >
      <Code2 class="size-3.5" />
      Typst
    </button>
    <button
      type="button"
      :class="
        cn(
          'inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors',
          modelValue === 'text'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )
      "
      @click="emit('update:modelValue', 'text')"
    >
      <Type class="size-3.5" />
      Text
    </button>
  </div>
</template>
