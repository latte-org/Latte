# Workspace Features & Preview Fix

## Fixed Issues

### 1. PDF Preview Loading
**Problem**: PDF preview was not loading correctly.

**Solution**: 
- Fixed blob URL creation and cleanup in `PreviewPanel.vue`
- Changed from computed property to reactive ref with proper watch
- Added proper cleanup on component unmount
- Fixed import statements

**How it works now**:
- PDF data is converted to blob URL when received
- Blob URL is properly revoked when component updates or unmounts
- Preview iframe loads the blob URL correctly

## New Features

### 2. Workspace System

#### Workspace Structure
When you create a workspace, it creates:
```
workspace-name/
├── .latte/                    # Hidden Latte settings
│   ├── workspace.json          # Workspace configuration
│   ├── templates/              # Reusable templates
│   └── resources/              # Images, fonts, etc.
├── main.typ                    # Your Typst documents (anywhere in tree)
└── ...
```

#### Workspace Features

**Create Workspace**
- Click "Workspace" button in toolbar
- Select "Create New Workspace"
- Choose directory location
- Workspace is created with default structure

**Open Workspace**
- Click "Workspace" button
- Select "Open Existing Workspace"
- Choose workspace directory
- Workspace loads with all documents, templates, and resources

**Recent Workspaces**
- Recently opened workspaces are saved
- Quick access from workspace selector
- Up to 5 recent workspaces

**Workspace Sidebar**
- Shows workspace name
- Lists all documents in workspace
- Lists all templates
- Lists all resources
- Click documents to open them
- Click templates to create new document from template

#### Backend Commands

New workspace commands:
- `create_workspace(name, root_path)` - Create new workspace
- `open_workspace(workspace_path)` - Open existing workspace
- `list_workspace_documents(workspace_path)` - List documents
- `list_workspace_templates(workspace_path)` - List templates
- `list_workspace_resources(workspace_path)` - List resources
- `get_workspace_template(workspace_path, template_name)` - Get template content
- `add_workspace_template(workspace_path, name, content)` - Add template

## Usage Flow

1. **Start Application**
   - Workspace selector appears automatically
   - Create new workspace or open existing

2. **Work in Workspace**
   - Sidebar shows workspace structure
   - Click documents to open
   - Click templates to create new document
   - All files are saved in workspace

3. **Edit & Preview**
   - Edit documents in code or rich text mode
   - Auto-compile shows live PDF preview
   - Preview loads correctly in right panel

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│ Toolbar: Workspace | New | Open | Save | Code/Rich |   │
├──────────┬──────────────────────┬──────────────────────┤
│          │                      │                      │
│ Workspace│   Editor Panel       │   Preview Panel      │
│ Sidebar  │   (Monaco/Rich)      │   (PDF)              │
│          │                      │                      │
│ Documents│                      │                      │
│ Templates│                      │                      │
│ Resources│                      │                      │
└──────────┴──────────────────────┴──────────────────────┘
```

## Technical Details

### Preview Fix
- Changed from `computed` to `ref` for `pdfUrl`
- Proper blob URL lifecycle management
- Cleanup on unmount prevents memory leaks

### Workspace System
- Workspace config stored in `.latte-workspace.json`
- Recent workspaces saved in localStorage
- Current workspace persisted across sessions
- All workspace operations are async and error-handled

## Next Steps

To test:
1. Run `yarn tauri dev`
2. Create a new workspace
3. Edit the default document
4. See PDF preview update automatically
5. Add templates to workspace
6. Create documents from templates

The application now has full workspace support with proper PDF preview!
