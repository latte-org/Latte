export interface DiagnosticInfo {
  severity: string
  message: string
  span?: {
    start: number
    end: number
    line: number
    column: number
    end_line: number
    end_column: number
  }
  hints: string[]
}

export interface OpenTab {
  id: string
  path: string | null
  label: string
  content: string
  isDirty: boolean
}

export interface DraftDocument {
  id: string
  label: string
  isDirty: boolean
}

export interface DocumentVersion {
  id: string
  createdAt: string
  label: string
  byteSize: number
}

export interface DiffLine {
  kind: 'equal' | 'add' | 'remove' | string
  text: string
  oldLine?: number | null
  newLine?: number | null
}

export interface VersionDiff {
  fromVersionId?: string | null
  fromLabel?: string | null
  toLabel: string
  lines: DiffLine[]
  additions: number
  deletions: number
}

export interface FileMetadata {
  path: string
  name: string
  extension?: string | null
  byteSize: number
  modifiedAt?: string | null
  createdAt?: string | null
  versionCount: number
}
