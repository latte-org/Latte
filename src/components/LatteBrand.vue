<script setup lang="ts">
import { cn } from '@/lib/utils'

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    showWordmark?: boolean
    class?: string
  }>(),
  {
    size: 'sm',
    showWordmark: true,
  }
)
</script>

<template>
  <div
    :class="
      cn(
        'inline-flex items-center gap-2 select-none',
        size === 'sm' && 'gap-2',
        size === 'md' && 'gap-2.5',
        size === 'lg' && 'gap-3',
        $props.class
      )
    "
  >
    <div
      :class="
        cn(
          'relative flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm',
          size === 'sm' && 'size-7 rounded-lg',
          size === 'md' && 'size-9 rounded-xl',
          size === 'lg' && 'size-12 rounded-2xl'
        )
      "
      aria-hidden="true"
    >
      <!-- Stylized latte cup mark -->
      <svg
        :class="
          cn(
            size === 'sm' && 'size-3.5',
            size === 'md' && 'size-5',
            size === 'lg' && 'size-6'
          )
        "
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5 9.5C5 8.12 6.12 7 7.5 7h7c1.38 0 2.5 1.12 2.5 2.5V14a4.5 4.5 0 0 1-9 0V9.5Z"
          fill="currentColor"
          fill-opacity="0.95"
        />
        <path
          d="M17 10h1.25A2.75 2.75 0 0 1 21 12.75v0A2.75 2.75 0 0 1 18.25 15.5H17"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
        />
        <path
          d="M8 4.5c.5.8.5 1.5 0 2.3M11 4c.6 1 .6 1.8 0 2.8M14 4.5c.5.8.5 1.5 0 2.3"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          opacity="0.85"
        />
      </svg>
    </div>

    <span
      v-if="showWordmark"
      :class="
        cn(
          'font-semibold tracking-tight text-foreground',
          size === 'sm' && 'text-sm',
          size === 'md' && 'text-base',
          size === 'lg' && 'text-3xl'
        )
      "
    >
      Latte
    </span>
  </div>
</template>
