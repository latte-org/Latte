use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

/// Read a file from the filesystem
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

/// Write a file to the filesystem
#[tauri::command]
pub async fn write_file(path: String, contents: String) -> Result<(), String> {
    // Create parent directories if they don't exist
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(&path, contents)
        .map_err(|e| format!("Failed to write file {}: {}", path, e))?;
    Ok(())
}

/// Check if a file exists
#[tauri::command]
pub async fn file_exists(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(&path).exists())
}

/// Create a directory
#[tauri::command]
pub async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory {}: {}", path, e))?;
    Ok(())
}

/// List files in a directory
#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory {}: {}", path, e))?;

    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        if let Some(name) = entry.path().to_str() {
            files.push(name.to_string());
        }
    }

    Ok(files)
}

/// Delete a file
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file {}: {}", path, e))?;
    Ok(())
}

/// Write binary data to a file
#[tauri::command]
pub async fn write_binary_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(&path, contents)
        .map_err(|e| format!("Failed to write file {}: {}", path, e))?;
    Ok(())
}

/// Rename or move a file
#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&new_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename {} to {}: {}", old_path, new_path, e))?;
    Ok(())
}

/// Copy a file to a new location, creating parent directories as needed.
#[tauri::command]
pub async fn copy_file(source: String, destination: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&destination).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::copy(&source, &destination).map_err(|e| {
        format!("Failed to copy {} to {}: {}", source, destination, e)
    })?;
    Ok(())
}

/// Zip a directory to an archive, skipping the `.latte` settings folder
#[tauri::command]
pub async fn zip_directory(source_dir: String, output_path: String) -> Result<(), String> {
    let source = PathBuf::from(&source_dir);
    if !source.is_dir() {
        return Err("Source path is not a directory".to_string());
    }

    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let file = fs::File::create(&output_path)
        .map_err(|e| format!("Failed to create zip file {}: {}", output_path, e))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for entry in WalkDir::new(&source).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if should_skip_zip_path(path) {
            continue;
        }

        let name = path
            .strip_prefix(&source)
            .map_err(|e| format!("Failed to resolve zip entry path: {}", e))?;
        let name_str = name.to_string_lossy().replace('\\', "/");
        if name_str.is_empty() {
            continue;
        }

        if path.is_file() {
            zip.start_file(name_str.clone(), options)
                .map_err(|e| format!("Failed to start zip entry: {}", e))?;
            let bytes = fs::read(path)
                .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
            zip.write_all(&bytes)
                .map_err(|e| format!("Failed to write zip entry: {}", e))?;
        } else if path.is_dir() {
            zip.add_directory(format!("{name_str}/"), options)
                .map_err(|e| format!("Failed to add zip directory: {}", e))?;
        }
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip file: {}", e))?;
    Ok(())
}

fn should_skip_zip_path(path: &Path) -> bool {
    path.components().any(|component| component.as_os_str() == ".latte")
}
