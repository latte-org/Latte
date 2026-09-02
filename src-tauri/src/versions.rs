use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocumentVersion {
    pub id: String,
    pub created_at: String,
    pub label: String,
    pub byte_size: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct VersionIndex {
    versions: Vec<DocumentVersion>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub kind: String,
    pub text: String,
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VersionDiff {
    pub from_version_id: Option<String>,
    pub from_label: Option<String>,
    pub to_label: String,
    pub lines: Vec<DiffLine>,
    pub additions: u32,
    pub deletions: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub path: String,
    pub name: String,
    pub extension: Option<String>,
    pub byte_size: u64,
    pub modified_at: Option<String>,
    pub created_at: Option<String>,
    pub version_count: u32,
}

fn versions_root(workspace_path: &str) -> PathBuf {
    PathBuf::from(workspace_path).join(".latte").join("versions")
}

fn document_key(workspace_path: &str, document_path: &str) -> Result<String, String> {
    let workspace = PathBuf::from(workspace_path)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace path: {}", e))?;
    let document = PathBuf::from(document_path)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(document_path));

    let relative = document
        .strip_prefix(&workspace)
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|_| {
            PathBuf::from(
                Path::new(document_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("document"),
            )
        });

    let encoded = relative
        .to_string_lossy()
        .replace('\\', "/")
        .replace('/', "__")
        .replace(':', "_")
        .replace('<', "_")
        .replace('>', "_")
        .replace('"', "_")
        .replace('|', "_")
        .replace('?', "_")
        .replace('*', "_");

    if encoded.is_empty() {
        Err("Could not derive document version key".to_string())
    } else {
        Ok(encoded)
    }
}

fn document_dir(workspace_path: &str, document_path: &str) -> Result<PathBuf, String> {
    Ok(versions_root(workspace_path).join(document_key(workspace_path, document_path)?))
}

fn index_path(dir: &Path) -> PathBuf {
    dir.join("index.json")
}

fn load_index(dir: &Path) -> Result<VersionIndex, String> {
    let path = index_path(dir);
    if !path.exists() {
        return Ok(VersionIndex::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read version index: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse version index: {}", e))
}

fn save_index(dir: &Path, index: &VersionIndex) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create versions directory: {}", e))?;
    let json = serde_json::to_string_pretty(index)
        .map_err(|e| format!("Failed to serialize version index: {}", e))?;
    fs::write(index_path(dir), json).map_err(|e| format!("Failed to write version index: {}", e))?;
    Ok(())
}

fn now_iso() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{}", millis)
}

fn system_time_to_iso(time: SystemTime) -> Option<String> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_millis().to_string())
}

fn snapshot_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{}.typ", id))
}

fn compute_line_diff(old: &str, new: &str) -> (Vec<DiffLine>, u32, u32) {
    let old_lines: Vec<&str> = if old.is_empty() {
        Vec::new()
    } else {
        old.lines().collect()
    };
    let new_lines: Vec<&str> = if new.is_empty() {
        Vec::new()
    } else {
        new.lines().collect()
    };

    let m = old_lines.len();
    let n = new_lines.len();
    let mut dp = vec![vec![0usize; n + 1]; m + 1];

    for i in (0..m).rev() {
        for j in (0..n).rev() {
            if old_lines[i] == new_lines[j] {
                dp[i][j] = dp[i + 1][j + 1] + 1;
            } else {
                dp[i][j] = dp[i + 1][j].max(dp[i][j + 1]);
            }
        }
    }

    let mut lines = Vec::new();
    let mut additions = 0u32;
    let mut deletions = 0u32;
    let mut i = 0usize;
    let mut j = 0usize;
    let mut old_no = 1u32;
    let mut new_no = 1u32;

    while i < m && j < n {
        if old_lines[i] == new_lines[j] {
            lines.push(DiffLine {
                kind: "equal".to_string(),
                text: old_lines[i].to_string(),
                old_line: Some(old_no),
                new_line: Some(new_no),
            });
            i += 1;
            j += 1;
            old_no += 1;
            new_no += 1;
        } else if dp[i + 1][j] >= dp[i][j + 1] {
            lines.push(DiffLine {
                kind: "remove".to_string(),
                text: old_lines[i].to_string(),
                old_line: Some(old_no),
                new_line: None,
            });
            i += 1;
            old_no += 1;
            deletions += 1;
        } else {
            lines.push(DiffLine {
                kind: "add".to_string(),
                text: new_lines[j].to_string(),
                old_line: None,
                new_line: Some(new_no),
            });
            j += 1;
            new_no += 1;
            additions += 1;
        }
    }

    while i < m {
        lines.push(DiffLine {
            kind: "remove".to_string(),
            text: old_lines[i].to_string(),
            old_line: Some(old_no),
            new_line: None,
        });
        i += 1;
        old_no += 1;
        deletions += 1;
    }

    while j < n {
        lines.push(DiffLine {
            kind: "add".to_string(),
            text: new_lines[j].to_string(),
            old_line: None,
            new_line: Some(new_no),
        });
        j += 1;
        new_no += 1;
        additions += 1;
    }

    (lines, additions, deletions)
}

/// List saved versions for a document.
#[tauri::command]
pub async fn list_document_versions(
    workspace_path: String,
    document_path: String,
) -> Result<Vec<DocumentVersion>, String> {
    let dir = document_dir(&workspace_path, &document_path)?;
    let mut index = load_index(&dir)?;
    index.versions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(index.versions)
}

/// Create a new version snapshot from the provided (or on-disk) contents.
#[tauri::command]
pub async fn create_document_version(
    workspace_path: String,
    document_path: String,
    contents: Option<String>,
    label: Option<String>,
) -> Result<DocumentVersion, String> {
    let path = PathBuf::from(&document_path);
    if !path.exists() && contents.is_none() {
        return Err("Document does not exist on disk".to_string());
    }

    let content = match contents {
        Some(value) => value,
        None => fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read document for versioning: {}", e))?,
    };

    let dir = document_dir(&workspace_path, &document_path)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create versions directory: {}", e))?;

    let mut index = load_index(&dir)?;
    let created_at = now_iso();
    let id = format!("v{}", created_at);
    let next_number = index.versions.len() + 1;
    let version_label = label
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("Version {}", next_number));

    let snapshot = snapshot_path(&dir, &id);
    fs::write(&snapshot, &content)
        .map_err(|e| format!("Failed to write version snapshot: {}", e))?;

    let version = DocumentVersion {
        id: id.clone(),
        created_at: created_at.clone(),
        label: version_label,
        byte_size: content.len() as u64,
    };

    index.versions.push(version.clone());
    save_index(&dir, &index)?;
    Ok(version)
}

/// Diff current contents against the previous (or a specific) version.
#[tauri::command]
pub async fn diff_document_version(
    workspace_path: String,
    document_path: String,
    current_contents: String,
    version_id: Option<String>,
) -> Result<VersionDiff, String> {
    let dir = document_dir(&workspace_path, &document_path)?;
    let mut index = load_index(&dir)?;
    index.versions.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    let previous = match version_id {
        Some(id) => index
            .versions
            .iter()
            .find(|v| v.id == id)
            .cloned()
            .ok_or_else(|| format!("Version not found: {}", id))?,
        None => index
            .versions
            .first()
            .cloned()
            .ok_or_else(|| "No previous version to compare".to_string())?,
    };

    let old = fs::read_to_string(snapshot_path(&dir, &previous.id))
        .map_err(|e| format!("Failed to read version snapshot: {}", e))?;

    let (lines, additions, deletions) = compute_line_diff(&old, &current_contents);

    Ok(VersionDiff {
        from_version_id: Some(previous.id),
        from_label: Some(previous.label),
        to_label: "Current".to_string(),
        lines,
        additions,
        deletions,
    })
}

/// Read metadata for the open document.
#[tauri::command]
pub async fn get_document_metadata(
    workspace_path: String,
    document_path: String,
) -> Result<FileMetadata, String> {
    let path = PathBuf::from(&document_path);
    let meta = fs::metadata(&path).map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document")
        .to_string();
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_string());

    let version_count = list_document_versions(workspace_path, document_path.clone())
        .await
        .map(|versions| versions.len() as u32)
        .unwrap_or(0);

    Ok(FileMetadata {
        path: document_path,
        name,
        extension,
        byte_size: meta.len(),
        modified_at: meta.modified().ok().and_then(system_time_to_iso),
        created_at: meta.created().ok().and_then(system_time_to_iso),
        version_count,
    })
}
