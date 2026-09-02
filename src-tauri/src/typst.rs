use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use typst::diag::{FileError, SourceDiagnostic};
use typst::foundations::{Bytes, Datetime};
use typst::syntax::{FileId, Source, VirtualPath};
use typst::text::{Font, FontBook};
use typst::World;
use typst_utils::LazyHash;
use typst_pdf::{pdf, PdfOptions};
use typst_library::layout::{Abs, PagedDocument};
use typst::LibraryExt;
use typst_library::{Feature, Features};
use typst_svg::{svg, svg_merged};
use typst_render::render;
use base64::Engine;

/// A filesystem-backed Typst world implementation
pub struct FileWorld {
    root: PathBuf,
    main: FileId,
    id_to_path: HashMap<FileId, PathBuf>,
    path_to_id: HashMap<PathBuf, FileId>,
    sources: HashMap<FileId, Source>,
    library: LazyHash<typst_library::Library>,
    book: LazyHash<FontBook>,
    fonts: Vec<Font>,
}

fn load_embedded_fonts() -> (FontBook, Vec<Font>) {
    let mut fonts = Vec::new();
    for data in typst_assets::fonts() {
        let bytes = Bytes::new(data);
        for face in 0..32 {
            match Font::new(bytes.clone(), face) {
                Some(font) => fonts.push(font),
                None => break,
            }
        }
    }
    (FontBook::from_fonts(&fonts), fonts)
}

impl FileWorld {
    /// Create a new FileWorld with the given root directory and main file
    pub fn new(root: PathBuf, entry: PathBuf) -> Result<Self, String> {
        Self::new_with_features(root, entry, Features::default())
    }

    /// Create a new FileWorld with custom compiler features enabled
    pub fn new_with_features(
        root: PathBuf,
        entry: PathBuf,
        features: Features,
    ) -> Result<Self, String> {
        let entry_abs = if entry.is_absolute() {
            entry.clone()
        } else {
            root.join(&entry)
        };

        let entry_abs = entry_abs
            .canonicalize()
            .map_err(|e| format!("failed to canonicalize {}: {}", entry_abs.display(), e))?;

        let root = entry_abs
            .parent()
            .ok_or_else(|| format!("entry file has no parent: {}", entry_abs.display()))?
            .to_path_buf();

        // Create virtual path for the main file
        let main_path = VirtualPath::new(entry_abs.strip_prefix(&root).unwrap_or(&entry_abs));
        let main = FileId::new(None, main_path.clone());

        let mut id_to_path = HashMap::new();
        let mut path_to_id = HashMap::new();
        let mut sources = HashMap::new();

        let text = std::fs::read_to_string(&entry_abs)
            .map_err(|e| format!("failed to read {}: {}", entry_abs.display(), e))?;
        sources.insert(main, Source::new(main, text));
        id_to_path.insert(main, entry_abs.clone());
        path_to_id.insert(entry_abs, main);

        let (book, fonts) = load_embedded_fonts();
        let library = typst_library::Library::builder()
            .with_features(features)
            .build();

        Ok(Self {
            root,
            main,
            id_to_path,
            path_to_id,
            sources,
            library: LazyHash::new(library),
            book: LazyHash::new(book),
            fonts,
        })
    }

    /// Resolve a virtual path to a file ID, loading it if necessary
    fn resolve_file(&mut self, path: &VirtualPath) -> Result<FileId, FileError> {
        // Try to resolve relative to root
        let resolved = self.root.join(path.as_rooted_path());
        let canonical = resolved
            .canonicalize()
            .map_err(|_| FileError::NotFound(path.as_rooted_path().to_path_buf()))?;

        // Check if we already have this file
        if let Some(&id) = self.path_to_id.get(&canonical) {
            return Ok(id);
        }

        // Load the file
        let text = std::fs::read_to_string(&canonical)
            .map_err(|e| FileError::from_io(e, &canonical))?;

        let virtual_path = VirtualPath::new(
            canonical
                .strip_prefix(&self.root)
                .unwrap_or(&canonical)
                .to_path_buf(),
        );
        let id = FileId::new(None, virtual_path);

        self.sources.insert(id, Source::new(id, text));
        self.id_to_path.insert(id, canonical.clone());
        self.path_to_id.insert(canonical, id);

        Ok(id)
    }

    fn try_path_of(&self, id: FileId) -> Option<&Path> {
        self.id_to_path.get(&id).map(|p| p.as_path())
    }
}

impl World for FileWorld {
    fn library(&self) -> &LazyHash<typst_library::Library> {
        &self.library
    }

    fn main(&self) -> FileId {
        self.main
    }

    fn source(&self, id: FileId) -> Result<Source, FileError> {
        self.sources
            .get(&id)
            .cloned()
            .ok_or_else(|| FileError::NotFound(PathBuf::new()))
    }

    fn file(&self, id: FileId) -> Result<Bytes, FileError> {
        let path = self
            .try_path_of(id)
            .ok_or_else(|| FileError::NotFound(PathBuf::new()))?;
        let bytes = std::fs::read(path).map_err(|e| FileError::from_io(e, path))?;
        Ok(Bytes::new(bytes))
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.get(index).cloned()
    }

    fn book(&self) -> &LazyHash<FontBook> {
        &self.book
    }

    fn today(&self, _offset: Option<i64>) -> Option<Datetime> {
        None
    }
}

/// Helper struct that wraps FileWorld and handles dynamic file resolution
struct ResolvingWorld {
    world: RwLock<FileWorld>,
    library: Arc<LazyHash<typst_library::Library>>,
    book: Arc<LazyHash<FontBook>>,
}

impl ResolvingWorld {
    fn new(root: PathBuf, entry: PathBuf, features: Features) -> Result<Self, String> {
        let file_world = FileWorld::new_with_features(root, entry, features)?;
        let library = Arc::new(file_world.library.clone());
        let book = Arc::new(file_world.book.clone());

        Ok(Self {
            world: RwLock::new(file_world),
            library,
            book,
        })
    }

    fn span_info(&self, span: typst::syntax::Span) -> Option<SpanInfo> {
        let world = self.world.read().unwrap();
        let source = world.source(world.main()).ok()?;
        let range = source.range(span)?;
        let lines = source.lines();
        let (line, column) = lines.byte_to_line_column(range.start)?;
        let (end_line, end_column) = lines.byte_to_line_column(range.end)?;
        Some(SpanInfo {
            start: range.start,
            end: range.end,
            line: line + 1,
            column: column + 1,
            end_line: end_line + 1,
            end_column: end_column + 1,
        })
    }
}

impl World for ResolvingWorld {
    fn library(&self) -> &LazyHash<typst_library::Library> {
        &self.library
    }

    fn main(&self) -> FileId {
        self.world.read().unwrap().main()
    }

    fn source(&self, id: FileId) -> Result<Source, FileError> {
        // Try to get source from existing sources
        {
            let world = self.world.read().unwrap();
            if let Ok(source) = world.source(id) {
                return Ok(source);
            }
        }

        // If not found, try to resolve and load the file
        let path = {
            let world = self.world.read().unwrap();
            world
                .try_path_of(id)
                .and_then(|p| p.strip_prefix(&world.root).ok())
                .map(|p| VirtualPath::new(p.to_path_buf()))
        };

        if let Some(virtual_path) = path {
            let mut world = self.world.write().unwrap();
            if let Ok(new_id) = world.resolve_file(&virtual_path) {
                return world.source(new_id);
            }
        }

        Err(FileError::NotFound(PathBuf::new()))
    }

    fn file(&self, id: FileId) -> Result<Bytes, FileError> {
        self.world.read().unwrap().file(id)
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.world.read().unwrap().font(index)
    }

    fn book(&self) -> &LazyHash<FontBook> {
        &self.book
    }

    fn today(&self, offset: Option<i64>) -> Option<Datetime> {
        self.world.read().unwrap().today(offset)
    }
}

/// Compile Typst source to PDF
#[tauri::command]
pub async fn compile_typst_to_pdf(entry_path: String) -> Result<Vec<u8>, String> {
    let entry = PathBuf::from(&entry_path);
    let root = entry
        .parent()
        .ok_or_else(|| format!("entry file has no parent: {}", entry_path))?
        .to_path_buf();

    let world = ResolvingWorld::new(root, entry, Features::default())?;

    // Compile to PagedDocument
    let result = typst::compile::<PagedDocument>(&world);

    match result.output {
        Ok(document) => {
            // Generate PDF
            let pdf_bytes = pdf(&document, &PdfOptions::default())
                .map_err(|e| format!("PDF generation error: {:?}", e))?;
            Ok(pdf_bytes)
        }
        Err(errors) => {
            let error_msg = format!(
                "Compilation errors: {}",
                errors
                    .iter()
                    .map(|e| e.message.to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            );
            Err(error_msg)
        }
    }
}

fn compile_html_entry(root: PathBuf, entry: PathBuf) -> Result<String, String> {
    let world = ResolvingWorld::new(
        root,
        entry,
        Features::from_iter([Feature::Html]),
    )?;
    let result = typst::compile::<typst_html::HtmlDocument>(&world);

    match result.output {
        Ok(document) => typst_html::html(&document).map_err(|errors| {
            format!(
                "HTML generation error: {}",
                errors
                    .iter()
                    .map(|e| e.message.to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        }),
        Err(errors) => Err(format!(
            "Compilation errors: {}",
            errors
                .iter()
                .map(|e| e.message.to_string())
                .collect::<Vec<_>>()
                .join(", ")
        )),
    }
}

/// Typst HTML export forbids page configuration. Drop `#set page(...)`
/// rules for HTML compile only; paged preview/PDF still uses the original source.
fn adapt_source_for_html(source: &str) -> String {
    let bytes = source.as_bytes();
    let mut out = String::with_capacity(source.len());
    let mut i = 0;

    while i < bytes.len() {
        if let Some(end) = match_set_page_statement(source, i) {
            for ch in source[i..end].chars() {
                if ch == '\n' {
                    out.push('\n');
                }
            }
            i = end;
            continue;
        }
        let ch = source[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }

    out
}

fn match_set_page_statement(source: &str, start: usize) -> Option<usize> {
    let end_args = match_set_page_call(source, start)?;
    Some(skip_optional_set_if(source, end_args))
}

fn skip_optional_set_if(source: &str, start: usize) -> usize {
    let i = skip_ws_horizontal(source, start);
    if !ident_at(source, i, "if") {
        return start;
    }
    let mut i = i + 2;
    let bytes = source.as_bytes();
    while i < bytes.len() {
        if bytes[i] == b'\n' {
            break;
        }
        if matches!(bytes[i], b'(' | b'[' | b'{') {
            i = skip_delimited(source, i).unwrap_or(i + 1);
            continue;
        }
        i += 1;
    }
    i
}

fn skip_ws_horizontal(source: &str, mut i: usize) -> usize {
    let bytes = source.as_bytes();
    while i < bytes.len() && matches!(bytes[i], b' ' | b'\t' | b'\r') {
        i += 1;
    }
    i
}

fn match_set_page_call(source: &str, start: usize) -> Option<usize> {
    if !source[start..].starts_with("#set") {
        return None;
    }

    let mut i = start + 4;
    i = skip_ws(source, i);
    if !ident_at(source, i, "page") {
        return None;
    }
    i += 4;

    loop {
        let after_ws = skip_ws(source, i);
        if source[after_ws..].starts_with('.') {
            i = skip_ws(source, after_ws + 1);
            let ident_end = scan_ident(source, i)?;
            i = ident_end;
            continue;
        }
        i = after_ws;
        break;
    }

    if !source[i..].starts_with('(') {
        return None;
    }
    skip_delimited(source, i)
}

fn ident_at(source: &str, i: usize, ident: &str) -> bool {
    source[i..].starts_with(ident)
        && scan_ident(source, i).is_some_and(|end| end - i == ident.len())
}

fn scan_ident(source: &str, i: usize) -> Option<usize> {
    let bytes = source.as_bytes();
    if i >= bytes.len() {
        return None;
    }
    let first = bytes[i];
    if !(first.is_ascii_alphabetic() || first == b'_') {
        return None;
    }
    let mut end = i + 1;
    while end < bytes.len() {
        let c = bytes[end];
        if c.is_ascii_alphanumeric() || c == b'_' || c == b'-' {
            end += 1;
        } else {
            break;
        }
    }
    Some(end)
}

fn skip_ws(source: &str, mut i: usize) -> usize {
    let bytes = source.as_bytes();
    while i < bytes.len() && bytes[i].is_ascii_whitespace() {
        i += 1;
    }
    i
}

fn skip_delimited(source: &str, start: usize) -> Option<usize> {
    let bytes = source.as_bytes();
    let (open, close) = match bytes.get(start)? {
        b'(' => (b'(', b')'),
        b'[' => (b'[', b']'),
        b'{' => (b'{', b'}'),
        _ => return None,
    };
    let mut depth = 0usize;
    let mut i = start;
    while i < bytes.len() {
        match bytes[i] {
            b'/' if bytes.get(i + 1) == Some(&b'/') => {
                i += 2;
                while i < bytes.len() && bytes[i] != b'\n' {
                    i += 1;
                }
            }
            b'/' if bytes.get(i + 1) == Some(&b'*') => {
                i += 2;
                while i + 1 < bytes.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                    i += 1;
                }
                i = (i + 2).min(bytes.len());
            }
            b'"' => {
                i += 1;
                while i < bytes.len() {
                    if bytes[i] == b'\\' {
                        i = (i + 2).min(bytes.len());
                        continue;
                    }
                    if bytes[i] == b'"' {
                        i += 1;
                        break;
                    }
                    i += 1;
                }
            }
            c if c == open => {
                depth += 1;
                i += 1;
            }
            c if c == close => {
                depth = depth.saturating_sub(1);
                i += 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            b'(' | b'[' | b'{' if bytes[i] != open => {
                i = skip_delimited(source, i)?;
            }
            _ => i += 1,
        }
    }
    None
}

fn write_temp_typ(root: &Path, source: &str) -> Result<tempfile::NamedTempFile, String> {
    use std::io::Write;
    let mut temp_file = tempfile::Builder::new()
        .prefix("latte-preview-")
        .suffix(".typ")
        .tempfile_in(root)
        .map_err(|e| format!("failed to create temp file: {}", e))?;
    temp_file
        .write_all(source.as_bytes())
        .map_err(|e| format!("failed to write temp file: {}", e))?;
    temp_file
        .flush()
        .map_err(|e| format!("failed to flush temp file: {}", e))?;
    Ok(temp_file)
}

/// Compile Typst source to HTML
#[tauri::command]
pub async fn compile_typst_to_html(entry_path: String) -> Result<String, String> {
    let entry = PathBuf::from(&entry_path);
    let root = entry
        .parent()
        .ok_or_else(|| format!("entry file has no parent: {}", entry_path))?
        .to_path_buf();
    let source = std::fs::read_to_string(&entry)
        .map_err(|e| format!("Failed to read {}: {}", entry_path, e))?;
    let adapted = adapt_source_for_html(&source);
    let temp_file = write_temp_typ(&root, &adapted)?;
    compile_html_entry(root, temp_file.path().to_path_buf())
}

/// Get compilation diagnostics (errors and warnings)
#[tauri::command]
pub async fn get_typst_diagnostics(
    entry_path: String,
) -> Result<Vec<DiagnosticInfo>, String> {
    let entry = PathBuf::from(&entry_path);
    let root = entry
        .parent()
        .ok_or_else(|| format!("entry file has no parent: {}", entry_path))?
        .to_path_buf();

    let world = ResolvingWorld::new(root, entry, Features::default())?;

    // Compile with diagnostics
    let result = typst::compile::<PagedDocument>(&world);

    let mut diagnostics: Vec<DiagnosticInfo> = result
        .warnings
        .iter()
        .map(|w| DiagnosticInfo::from_diagnostic(w, &world))
        .collect();

    // If there are errors, add them too
    if let Err(errors) = &result.output {
        let error_diagnostics: Vec<DiagnosticInfo> = errors
            .iter()
            .map(|e| DiagnosticInfo::from_diagnostic(e, &world))
            .collect();
        diagnostics.extend(error_diagnostics);
    }

    Ok(diagnostics)
}

/// Compile Typst from source string (in-memory compilation)
#[tauri::command]
pub async fn compile_typst_string_to_pdf(
    source: String,
    root_dir: Option<String>,
) -> Result<Vec<u8>, String> {
    use std::io::Write;
    use tempfile::NamedTempFile;

    // Create a temporary file for the source
    let root = root_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    let mut temp_file = NamedTempFile::new_in(&root)
        .map_err(|e| format!("failed to create temp file: {}", e))?;
    temp_file
        .write_all(source.as_bytes())
        .map_err(|e| format!("failed to write temp file: {}", e))?;
    temp_file
        .flush()
        .map_err(|e| format!("failed to flush temp file: {}", e))?;

    let entry_path = temp_file.path().to_path_buf();
    compile_typst_to_pdf(entry_path.to_string_lossy().to_string()).await
    // temp_file is dropped here, after compilation completes
}

fn write_preview_pdf(bytes: &[u8]) -> Result<String, String> {
    let dir = std::env::temp_dir().join("latte-preview");
    std::fs::create_dir_all(&dir).map_err(|e| format!("failed to create preview dir: {e}"))?;
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) == Some("pdf") {
                let _ = std::fs::remove_file(path);
            }
        }
    }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = dir.join(format!("preview-{stamp}.pdf"));
    std::fs::write(&path, bytes).map_err(|e| format!("failed to write preview pdf: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Compile Typst source to a temporary PDF file for the live preview pane.
#[tauri::command]
pub async fn compile_typst_string_to_pdf_preview(
    source: String,
    root_dir: Option<String>,
) -> Result<String, String> {
    let pdf = compile_typst_string_to_pdf(source, root_dir).await?;
    write_preview_pdf(&pdf)
}

/// Compile Typst source string to HTML (in-memory)
#[tauri::command]
pub async fn compile_typst_string_to_html(
    source: String,
    root_dir: Option<String>,
) -> Result<String, String> {
    let root = root_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let adapted = adapt_source_for_html(&source);
    let temp_file = write_temp_typ(&root, &adapted)?;
    compile_html_entry(root, temp_file.path().to_path_buf())
}

/// Compile Typst file to per-page SVG strings (paged fidelity preview)
#[tauri::command]
pub async fn compile_typst_to_svg_pages(entry_path: String) -> Result<Vec<String>, String> {
    let entry = PathBuf::from(&entry_path);
    let root = entry
        .parent()
        .ok_or_else(|| format!("entry file has no parent: {}", entry_path))?
        .to_path_buf();

    let world = ResolvingWorld::new(root, entry, Features::default())?;
    let result = typst::compile::<PagedDocument>(&world);

    match result.output {
        Ok(document) => {
            let pages = document.pages.iter().map(svg).collect();
            Ok(pages)
        }
        Err(errors) => Err(format!(
            "Compilation errors: {}",
            errors
                .iter()
                .map(|e| e.message.to_string())
                .collect::<Vec<_>>()
                .join(", ")
        )),
    }
}

/// Compile Typst source string to per-page SVG strings
#[tauri::command]
pub async fn compile_typst_string_to_svg_pages(
    source: String,
    root_dir: Option<String>,
) -> Result<Vec<String>, String> {
    use std::io::Write;
    use tempfile::NamedTempFile;

    let root = root_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    let mut temp_file = NamedTempFile::new_in(&root)
        .map_err(|e| format!("failed to create temp file: {}", e))?;
    temp_file
        .write_all(source.as_bytes())
        .map_err(|e| format!("failed to write temp file: {}", e))?;
    temp_file
        .flush()
        .map_err(|e| format!("failed to flush temp file: {}", e))?;

    let entry_path = temp_file.path().to_path_buf();
    compile_typst_to_svg_pages(entry_path.to_string_lossy().to_string()).await
}

fn encode_png_pages(document: &PagedDocument, pixel_per_pt: f32) -> Result<Vec<String>, String> {
    let scale = pixel_per_pt.max(0.5).min(3.0);
    document
        .pages
        .iter()
        .map(|page| {
            let pixmap = render(page, scale);
            let png = pixmap
                .encode_png()
                .map_err(|e| format!("failed to encode PNG: {}", e))?;
            Ok(base64::engine::general_purpose::STANDARD.encode(png))
        })
        .collect()
}

/// Compile Typst source string to per-page PNG images (base64).
#[tauri::command]
pub async fn compile_typst_string_to_png_pages(
    source: String,
    root_dir: Option<String>,
    pixel_per_pt: Option<f32>,
) -> Result<Vec<String>, String> {
    let root = root_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let temp_file = write_temp_typ(&root, &source)?;
    let world = ResolvingWorld::new(root, temp_file.path().to_path_buf(), Features::default())?;
    let result = typst::compile::<PagedDocument>(&world);

    match result.output {
        Ok(document) => {
            if document.pages.is_empty() {
                return Err("compiled document has no pages".into());
            }
            encode_png_pages(&document, pixel_per_pt.unwrap_or(1.25))
        }
        Err(errors) => Err(format!(
            "Compilation errors: {}",
            errors
                .iter()
                .map(|e| e.message.to_string())
                .collect::<Vec<_>>()
                .join(", ")
        )),
    }
}

/// Compile Typst source string to a single vertically merged SVG
#[tauri::command]
pub async fn compile_typst_string_to_svg(
    source: String,
    root_dir: Option<String>,
) -> Result<String, String> {
    use std::io::Write;
    use tempfile::NamedTempFile;

    let root = root_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    let mut temp_file = NamedTempFile::new_in(&root)
        .map_err(|e| format!("failed to create temp file: {}", e))?;
    temp_file
        .write_all(source.as_bytes())
        .map_err(|e| format!("failed to write temp file: {}", e))?;
    temp_file
        .flush()
        .map_err(|e| format!("failed to flush temp file: {}", e))?;

    let entry = temp_file.path().to_path_buf();
    let world = ResolvingWorld::new(root, entry, Features::default())?;
    let result = typst::compile::<PagedDocument>(&world);

    match result.output {
        Ok(document) => Ok(svg_merged(&document, Abs::pt(24.0))),
        Err(errors) => Err(format!(
            "Compilation errors: {}",
            errors
                .iter()
                .map(|e| e.message.to_string())
                .collect::<Vec<_>>()
                .join(", ")
        )),
    }
}

/// Diagnostic information for frontend display
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct DiagnosticInfo {
    pub severity: String,
    pub message: String,
    pub span: Option<SpanInfo>,
    pub hints: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct SpanInfo {
    pub start: usize,
    pub end: usize,
    pub line: usize,
    pub column: usize,
    pub end_line: usize,
    pub end_column: usize,
}

impl DiagnosticInfo {
    fn from_diagnostic(diag: &SourceDiagnostic, world: &ResolvingWorld) -> Self {
        let severity = match diag.severity {
            typst::diag::Severity::Error => "error",
            typst::diag::Severity::Warning => "warning",
        }
        .to_string();

        let message = diag.message.to_string();
        let hints = diag.hints.iter().map(|h| h.to_string()).collect();
        let span = world.span_info(diag.span);

        Self {
            severity,
            message,
            span,
            hints,
        }
    }
}
