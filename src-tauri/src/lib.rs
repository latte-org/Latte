pub mod typst;
pub mod filesystem;
pub mod projects;
pub mod versions;
pub mod workspace;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            // Typst compilation commands
            typst::compile_typst_to_pdf,
            typst::compile_typst_to_html,
            typst::get_typst_diagnostics,
            typst::compile_typst_string_to_pdf,
            typst::compile_typst_string_to_pdf_preview,
            typst::compile_typst_string_to_html,
            typst::compile_typst_to_svg_pages,
            typst::compile_typst_string_to_svg_pages,
            typst::compile_typst_string_to_svg,
            typst::compile_typst_string_to_png_pages,
            // Filesystem commands
            filesystem::read_file,
            filesystem::write_file,
            filesystem::file_exists,
            filesystem::create_directory,
            filesystem::list_directory,
            filesystem::delete_file,
            filesystem::write_binary_file,
            filesystem::rename_file,
            filesystem::copy_file,
            filesystem::zip_directory,
            // Project management commands
            projects::create_project,
            projects::list_templates,
            projects::get_template,
            // Workspace commands
            workspace::init_workspace,
            workspace::open_workspace,
            workspace::list_workspace_templates,
            workspace::list_workspace_resources,
            workspace::list_workspace_documents,
            workspace::list_workspace_images,
            workspace::add_workspace_template,
            workspace::get_workspace_template,
            workspace::update_workspace_settings,
            // Document versioning
            versions::list_document_versions,
            versions::create_document_version,
            versions::diff_document_version,
            versions::get_document_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
