<script setup lang="ts">
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Plus,
  Redo2,
  Search,
  Sigma,
  Table2,
  Undo2,
  Variable,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import EditorModeToggle from '@/components/EditorModeToggle.vue'
import {
  TYPST_TOOLBAR_HINTS,
  type EditorToolbarCommand,
} from '@/lib/typst-source-format'
import type { TypstVariableRef } from '@/lib/typst-catalog'
import { cn } from '@/lib/utils'

const props = defineProps<{
  editorMode: 'code' | 'text'
  canUndo: boolean
  canRedo: boolean
  isActive: (command: EditorToolbarCommand) => boolean
  diagnosticCount?: number
  variables?: TypstVariableRef[]
}>()

const emit = defineEmits<{
  'update:editorMode': [mode: 'code' | 'text']
  undo: []
  redo: []
  command: [command: EditorToolbarCommand]
  'insert-variable': [name: string]
  'jump-diagnostic': []
}>()

const hint = (command: EditorToolbarCommand, fallback: string) =>
  props.editorMode === 'code' ? TYPST_TOOLBAR_HINTS[command] : fallback
</script>

<template>
  <div class="flex flex-wrap items-center gap-1 border-b border-border/60 bg-card px-3 py-2">
    <EditorModeToggle
      :model-value="editorMode"
      @update:model-value="emit('update:editorMode', $event)"
    />

    <Separator
      orientation="vertical"
      class="mx-1 h-5"
    />

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="size-8 rounded-lg"
          :disabled="!canUndo"
          @click="emit('undo')"
        >
          <Undo2 class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Undo</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="size-8 rounded-lg"
          :disabled="!canRedo"
          @click="emit('redo')"
        >
          <Redo2 class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Redo</TooltipContent>
    </Tooltip>

    <Separator
      orientation="vertical"
      class="mx-1 h-5"
    />

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('heading1') && 'bg-muted')"
          @click="emit('command', 'heading1')"
        >
          <Heading1 class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('heading1', 'Heading 1') }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('heading2') && 'bg-muted')"
          @click="emit('command', 'heading2')"
        >
          <Heading2 class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('heading2', 'Heading 2') }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('bold') && 'bg-muted')"
          @click="emit('command', 'bold')"
        >
          <Bold class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('bold', 'Bold') }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('italic') && 'bg-muted')"
          @click="emit('command', 'italic')"
        >
          <Italic class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('italic', 'Italic') }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('link') && 'bg-muted')"
          @click="emit('command', 'link')"
        >
          <Link2 class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('link', 'Link') }}</TooltipContent>
    </Tooltip>

    <Separator
      orientation="vertical"
      class="mx-1 h-5"
    />

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('bulletList') && 'bg-muted')"
          @click="emit('command', 'bulletList')"
        >
          <List class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('bulletList', 'Bullet list') }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('orderedList') && 'bg-muted')"
          @click="emit('command', 'orderedList')"
        >
          <ListOrdered class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('orderedList', 'Numbered list') }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('horizontalRule') && 'bg-muted')"
          @click="emit('command', 'horizontalRule')"
        >
          <Minus class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('horizontalRule', 'Divider') }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('codeBlock') && 'bg-muted')"
          @click="emit('command', 'codeBlock')"
        >
          <Code2 class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('codeBlock', 'Raw Typst block') }}</TooltipContent>
    </Tooltip>

    <Separator
      orientation="vertical"
      class="mx-1 h-5"
    />

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('figure') && 'bg-muted')"
          @click="emit('command', 'figure')"
        >
          <ImageIcon class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('figure', 'Figure') }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('table') && 'bg-muted')"
          @click="emit('command', 'table')"
        >
          <Table2 class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('table', 'Table') }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          :class="cn('size-8 rounded-lg', isActive('math') && 'bg-muted')"
          @click="emit('command', 'math')"
        >
          <Sigma class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ hint('math', 'Math') }}</TooltipContent>
    </Tooltip>

    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              :class="cn('size-8 rounded-lg', isActive('variable') && 'bg-muted')"
            >
              <Variable class="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{{ hint('variable', 'Variables') }}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        class="min-w-[16rem]"
      >
        <DropdownMenuItem @click="emit('command', 'variable')">
          <Plus class="size-3.5" />
          <span>New variable</span>
          <span class="ml-auto font-mono text-[10px] text-muted-foreground">#let</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="variables?.length" />
        <DropdownMenuLabel
          v-if="variables?.length"
          class="text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          Insert
        </DropdownMenuLabel>
        <DropdownMenuItem
          v-for="item in variables"
          :key="item.name"
          class="font-mono text-xs"
          @click="emit('insert-variable', item.name)"
        >
          <span>#{{ item.name }}</span>
          <span
            v-if="item.value"
            class="ml-auto max-w-[8rem] truncate text-[10px] text-muted-foreground"
          >{{ item.value }}</span>
        </DropdownMenuItem>
        <p
          v-if="!variables?.length"
          class="px-2 py-1.5 text-xs text-muted-foreground"
        >
          No variables yet. Declare one with #let name = value.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>

    <Tooltip v-if="diagnosticCount">
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="ml-auto h-7 rounded-lg px-2 text-xs text-muted-foreground"
          @click="emit('jump-diagnostic')"
        >
          <Search class="mr-1 size-3.5" />
          {{ diagnosticCount }} issue{{ diagnosticCount === 1 ? '' : 's' }}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Jump to first diagnostic</TooltipContent>
    </Tooltip>
  </div>
</template>
