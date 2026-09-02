<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Monitor,
  Moon,
  Sun,
  Type,
  Save,
  Hash,
} from '@lucide/vue'
import {
  loadSettings,
  updateSettings,
  type AppSettings,
  type ThemePreference,
} from '@/lib/settings'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import LatteBrand from '@/components/LatteBrand.vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  change: [settings: AppSettings]
}>()

const settings = ref<AppSettings>(loadSettings())

watch(
  () => props.open,
  (open) => {
    if (open) settings.value = loadSettings()
  }
)

const themeOptions: Array<{
  value: ThemePreference
  label: string
  icon: typeof Sun
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const fontSizeLabel = computed(() => `${settings.value.editorFontSize}px`)

const patch = (partial: Partial<AppSettings>) => {
  settings.value = updateSettings(partial)
  emit('change', settings.value)
}

const setTheme = (theme: ThemePreference) => patch({ theme })

const bumpFontSize = (delta: number) => {
  const next = Math.min(22, Math.max(12, settings.value.editorFontSize + delta))
  patch({ editorFontSize: next })
}
</script>

<template>
  <Sheet
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 border-l border-border/60 p-0 sm:max-w-md"
    >
      <SheetHeader class="space-y-1 border-b border-border/60 px-6 py-5 text-left">
        <div class="flex items-center gap-3">
          <LatteBrand
            size="md"
            :show-wordmark="false"
          />
          <div>
            <SheetTitle>Latte options</SheetTitle>
            <SheetDescription>
              Themes, editor defaults, and more.
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <ScrollArea class="flex-1">
        <div class="space-y-8 px-6 py-6">
          <section class="space-y-3">
            <div class="space-y-1">
              <h3 class="text-sm font-semibold">Appearance</h3>
              <p class="text-xs text-muted-foreground">
                Choose how Latte looks across the app.
              </p>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="option in themeOptions"
                :key="option.value"
                type="button"
                :class="
                  cn(
                    'flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-sm transition',
                    settings.theme === option.value
                      ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                      : 'border-border/70 bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent/40'
                  )
                "
                @click="setTheme(option.value)"
              >
                <component
                  :is="option.icon"
                  class="size-4"
                />
                <span class="font-medium">{{ option.label }}</span>
              </button>
            </div>
          </section>

          <Separator />

          <section class="space-y-4">
            <div class="space-y-1">
              <h3 class="text-sm font-semibold">Editor</h3>
              <p class="text-xs text-muted-foreground">
                Defaults applied when you open documents.
              </p>
            </div>

            <div class="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="flex size-9 items-center justify-center rounded-xl bg-muted">
                  <Save class="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p class="text-sm font-medium">Auto save</p>
                  <p class="text-xs text-muted-foreground">Save a few seconds after edits</p>
                </div>
              </div>
              <Switch
                :model-value="settings.autoSave"
                @update:model-value="(v) => patch({ autoSave: Boolean(v) })"
              />
            </div>

            <div class="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="flex size-9 items-center justify-center rounded-xl bg-muted">
                  <Hash class="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p class="text-sm font-medium">Line numbers</p>
                  <p class="text-xs text-muted-foreground">Show gutter numbers in Typst mode</p>
                </div>
              </div>
              <Switch
                :model-value="settings.showLineNumbers"
                @update:model-value="(v) => patch({ showLineNumbers: Boolean(v) })"
              />
            </div>

            <div class="rounded-2xl border border-border/70 bg-card px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="flex size-9 items-center justify-center rounded-xl bg-muted">
                    <Type class="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p class="text-sm font-medium">Font size</p>
                    <p class="text-xs text-muted-foreground">{{ fontSizeLabel }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    class="size-8 rounded-lg"
                    @click="bumpFontSize(-1)"
                  >
                    −
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    class="size-8 rounded-lg"
                    @click="bumpFontSize(1)"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section class="space-y-3 rounded-2xl border border-border/70 bg-card px-4 py-4">
            <LatteBrand size="md" />
            <p class="text-xs leading-relaxed text-muted-foreground">
              Latte is an open-source Typst editor with a clean workspace, Typst and
              plain-text modes, and a simple document workflow.
            </p>
            <p class="text-[11px] text-muted-foreground/80">Latte · Version 0.1.0</p>
          </section>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>
