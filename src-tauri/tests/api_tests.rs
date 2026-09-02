use latte_lib::filesystem::{read_file, write_file, file_exists, create_directory, list_directory, delete_file, rename_file, copy_file, zip_directory};
use latte_lib::projects::{create_project, get_template, list_templates};
use latte_lib::typst::{
    compile_typst_string_to_pdf, compile_typst_string_to_html, compile_typst_string_to_png_pages,
    compile_typst_string_to_svg_pages, compile_typst_to_pdf, get_typst_diagnostics,
    compile_typst_to_html,
};
use latte_lib::workspace::{
    add_workspace_template, get_workspace_template, init_workspace, list_workspace_documents,
    list_workspace_resources, list_workspace_templates, open_workspace,
};
use std::fs;
use tempfile::TempDir;

const VALID_TYPST: &str = r#"#set page(margin: 2cm)

= Hello, Typst!

This is a test document.
"#;

const INVALID_TYPST: &str = r#"#set page(margin: 2cm)

= Unclosed heading
*broken syntax
"#;

#[tokio::test]
async fn filesystem_read_write_and_delete() {
    let dir = TempDir::new().unwrap();
    let file_path = dir.path().join("test.typ");
    let path = file_path.to_string_lossy().to_string();

    write_file(path.clone(), VALID_TYPST.to_string())
        .await
        .expect("write should succeed");

    assert!(file_exists(path.clone()).await.unwrap());
    let content = read_file(path.clone()).await.unwrap();
    assert_eq!(content, VALID_TYPST);

    delete_file(path.clone()).await.expect("delete should succeed");
    assert!(!file_exists(path).await.unwrap());
}

#[tokio::test]
async fn filesystem_copy_file() {
    let dir = TempDir::new().unwrap();
    let source = dir.path().join("source.png");
    let dest = dir.path().join("assets").join("source.png");
    fs::write(&source, b"fake-image").unwrap();

    copy_file(
        source.to_string_lossy().to_string(),
        dest.to_string_lossy().to_string(),
    )
    .await
    .expect("copy should succeed");

    assert_eq!(fs::read(&dest).unwrap(), b"fake-image");
}

#[tokio::test]
async fn filesystem_directory_operations() {
    let dir = TempDir::new().unwrap();
    let nested = dir.path().join("nested").join("child");
    let nested_str = nested.to_string_lossy().to_string();

    create_directory(nested_str.clone()).await.unwrap();
    assert!(nested.exists());

    let parent = dir.path().join("nested");
    let entries = list_directory(parent.to_string_lossy().to_string())
        .await
        .unwrap();
    assert!(!entries.is_empty());
}

#[tokio::test]
async fn compile_valid_typst_string_to_pdf() {
    let pdf = compile_typst_string_to_pdf(VALID_TYPST.to_string(), None)
        .await
        .expect("valid typst should compile");

    assert!(pdf.len() > 100);
    assert_eq!(&pdf[0..4], b"%PDF");
}

#[tokio::test]
async fn compile_valid_typst_file_to_pdf() {
    let dir = TempDir::new().unwrap();
    let file_path = dir.path().join("main.typ");
    fs::write(&file_path, VALID_TYPST).unwrap();

    let pdf = compile_typst_to_pdf(file_path.to_string_lossy().to_string())
        .await
        .expect("valid file should compile");

    assert_eq!(&pdf[0..4], b"%PDF");
}

#[tokio::test]
async fn compile_invalid_typst_returns_error() {
    let result = compile_typst_string_to_pdf(INVALID_TYPST.to_string(), None).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn diagnostics_report_invalid_typst() {
    let dir = TempDir::new().unwrap();
    let file_path = dir.path().join("broken.typ");
    fs::write(&file_path, INVALID_TYPST).unwrap();

    let diagnostics = get_typst_diagnostics(file_path.to_string_lossy().to_string())
        .await
        .unwrap();

    assert!(!diagnostics.is_empty());
    assert!(diagnostics.iter().any(|d| d.severity == "error"));
}

#[tokio::test]
async fn html_export_returns_valid_html() {
    let dir = TempDir::new().unwrap();
    let file_path = dir.path().join("main.typ");
    fs::write(&file_path, "= Hello, Typst!\n\nThis is a test document.\n").unwrap();

    let html = compile_typst_to_html(file_path.to_string_lossy().to_string())
        .await
        .expect("valid file should compile to html");

    assert!(html.contains("<!DOCTYPE html>"));
    assert!(html.contains("Hello, Typst"));
}

#[tokio::test]
async fn html_string_export_returns_valid_html() {
    let html = compile_typst_string_to_html(
        "= Hello from string\n\nPreview body.\n".to_string(),
        None,
    )
    .await
    .expect("string source should compile to html");

    assert!(html.contains("<!DOCTYPE html>"));
    assert!(html.contains("Hello from string"));
}

#[tokio::test]
async fn html_export_allows_set_page_rules() {
    let html = compile_typst_string_to_html(VALID_TYPST.to_string(), None)
        .await
        .expect("html preview should ignore page set rules");

    assert!(html.contains("<!DOCTYPE html>"));
    assert!(html.contains("Hello, Typst"));
}

#[tokio::test]
async fn svg_pages_export_returns_svg() {
    let pages = compile_typst_string_to_svg_pages(
        "= Page one\n\nHello SVG.\n".to_string(),
        None,
    )
    .await
    .expect("string source should compile to svg pages");

    assert!(!pages.is_empty());
    assert!(pages[0].contains("<svg"));
}

#[tokio::test]
async fn png_pages_export_returns_png() {
    let pages = compile_typst_string_to_png_pages(
        VALID_TYPST.to_string(),
        None,
        Some(1.0),
    )
    .await
    .expect("string source should compile to png pages");

    assert!(!pages.is_empty());
    assert!(
        pages[0].starts_with("iVBORw0KGgo"),
        "page should be a base64 PNG, got prefix {:?}",
        pages[0].get(..16)
    );
}

#[tokio::test]
async fn rename_file_moves_document() {
    let dir = TempDir::new().unwrap();
    let old_path = dir.path().join("old.typ");
    let new_path = dir.path().join("new.typ");
    fs::write(&old_path, VALID_TYPST).unwrap();

    rename_file(
        old_path.to_string_lossy().to_string(),
        new_path.to_string_lossy().to_string(),
    )
    .await
    .unwrap();

    assert!(!old_path.exists());
    assert!(new_path.exists());
}

#[tokio::test]
async fn zip_directory_creates_archive() {
    let dir = TempDir::new().unwrap();
    let workspace = dir.path().join("workspace");
    fs::create_dir_all(&workspace).unwrap();
    fs::write(workspace.join("main.typ"), VALID_TYPST).unwrap();
    fs::create_dir_all(workspace.join(".latte")).unwrap();
    fs::write(workspace.join(".latte").join("secret.json"), "{}").unwrap();

    let zip_path = dir.path().join("workspace.zip");
    zip_directory(
        workspace.to_string_lossy().to_string(),
        zip_path.to_string_lossy().to_string(),
    )
    .await
    .unwrap();

    assert!(zip_path.exists());
    assert!(zip_path.metadata().unwrap().len() > 0);
}

#[tokio::test]
async fn project_templates_are_available() {
    let templates = list_templates().await.unwrap();
    assert!(templates.contains(&"article".to_string()));
    assert!(templates.contains(&"cv".to_string()));

    let article = get_template("article".to_string()).await.unwrap();
    assert!(article.contains("= Introduction"));
}

#[tokio::test]
async fn create_project_writes_main_typ() {
    let dir = TempDir::new().unwrap();
    let project_path = dir.path().join("my-project");
    let path_str = project_path.to_string_lossy().to_string();

    let main_file = create_project(path_str, Some("article".to_string()))
        .await
        .unwrap();

    assert!(main_file.ends_with("main.typ"));
    assert!(std::path::Path::new(&main_file).exists());
}

#[tokio::test]
async fn article_template_compiles_to_pdf() {
    let dir = TempDir::new().unwrap();
    let project_path = dir.path().join("article-project");
    let main_file = create_project(
        project_path.to_string_lossy().to_string(),
        Some("article".to_string()),
    )
    .await
    .unwrap();

    let result = compile_typst_to_pdf(main_file).await;
    assert!(
        result.is_ok(),
        "article template should compile, got: {:?}",
        result.err()
    );
}

#[tokio::test]
async fn workspace_init_open_and_template_flow() {
    let dir = TempDir::new().unwrap();
    let workspace_path = dir.path().join("workspace");
    fs::create_dir_all(&workspace_path).unwrap();

    let doc_path = workspace_path.join("main.typ");
    fs::write(&doc_path, VALID_TYPST).unwrap();

    let config = init_workspace(workspace_path.to_string_lossy().to_string(), None)
        .await
        .unwrap();
    assert_eq!(config.name, "workspace");
    assert!(workspace_path.join(".latte").join("workspace.json").exists());

    let reopened = open_workspace(workspace_path.to_string_lossy().to_string())
        .await
        .unwrap();
    assert_eq!(reopened.name, "workspace");

    let documents = list_workspace_documents(workspace_path.to_string_lossy().to_string())
        .await
        .unwrap();
    assert!(documents.iter().any(|d| d.ends_with("main.typ")));

    add_workspace_template(
        workspace_path.to_string_lossy().to_string(),
        "letter".to_string(),
        "#set page(margin: 2cm)\n\n= Template Doc\n".to_string(),
    )
    .await
    .unwrap();

    let templates = list_workspace_templates(workspace_path.to_string_lossy().to_string())
        .await
        .unwrap();
    assert!(templates.contains(&"letter".to_string()));

    let template_content = get_workspace_template(
        workspace_path.to_string_lossy().to_string(),
        "letter".to_string(),
    )
    .await
    .unwrap();
    assert!(template_content.contains("Template Doc"));

    let resources = list_workspace_resources(workspace_path.to_string_lossy().to_string())
        .await
        .unwrap();
    assert!(resources.is_empty());
}

#[tokio::test]
async fn workspace_init_empty_folder() {
    let dir = TempDir::new().unwrap();
    let workspace_path = dir.path().join("empty-space");
    fs::create_dir_all(&workspace_path).unwrap();

    let config = init_workspace(
        workspace_path.to_string_lossy().to_string(),
        Some("empty-space".to_string()),
    )
    .await
    .unwrap();

    assert_eq!(config.name, "empty-space");
    assert!(workspace_path.join(".latte").join("workspace.json").exists());
    assert!(workspace_path.join(".latte").join("templates").exists());
    assert!(workspace_path.join(".latte").join("resources").exists());

    let documents = list_workspace_documents(workspace_path.to_string_lossy().to_string())
        .await
        .unwrap();
    assert!(documents.is_empty());

    let reopened = open_workspace(workspace_path.to_string_lossy().to_string())
        .await
        .unwrap();
    assert_eq!(reopened.name, "empty-space");
}
