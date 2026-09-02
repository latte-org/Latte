use std::fs;
use std::path::PathBuf;

/// Template definitions
const TEMPLATES: &[(&str, &str)] = &[
    (
        "article",
        r#"#set page(margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm))
#set text(font: "Libertinus Serif", size: 11pt)
#set heading(numbering: "1.")

= Introduction
#lorem(10)

== Background
#lorem(15)

== Methodology
#lorem(20)

= Results
#lorem(15)

= Conclusion
#lorem(10)
"#,
    ),
    (
        "letter",
        r#"#set page(margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm))
#set text(font: "Libertinus Serif", size: 11pt)

#align(right)[
  Your Name \
  Your Address \
  City, Country
]

#v(1.5cm)

#align(left)[
  Recipient Name \
  Recipient Address \
  City, Country
]

#v(1cm)

Dear Recipient Name,

#lorem(20)

#v(1cm)

Sincerely, \
Your Name
"#,
    ),
    (
        "cv",
        r#"#set page(margin: 2cm)
#set text(font: "Libertinus Serif", size: 10pt)

= Your Name
#set text(size: 9pt)
Email: your.email@example.com \
Phone: +1 234 567 8900 \
Location: City, Country

= Education
== University Name
*Degree* | *Year*
Major in Subject

= Experience
== Job Title
*Company Name* | *Date Range*
- Achievement or responsibility
- Another achievement

= Skills
- Skill 1
- Skill 2
- Skill 3
"#,
    ),
    (
        "report",
        r#"#set page(margin: 2.5cm)
#set text(font: "Libertinus Serif", size: 11pt)
#set heading(numbering: "1.")

= Executive Summary
#lorem(15)

= Introduction
#lorem(20)

== Objectives
#lorem(10)

= Methodology
#lorem(25)

= Findings
#lorem(30)

= Recommendations
#lorem(20)

= Conclusion
#lorem(15)

= Appendix
#lorem(10)
"#,
    ),
];

/// Create a new Typst project
#[tauri::command]
pub async fn create_project(
    name: String,
    template: Option<String>,
) -> Result<String, String> {
    let project_path = PathBuf::from(&name);

    // Create project directory
    fs::create_dir_all(&project_path)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;

    // Determine template content
    let template_name = template.as_deref().unwrap_or("article");
    let content = TEMPLATES
        .iter()
        .find(|(t, _)| *t == template_name)
        .map(|(_, content)| *content)
        .unwrap_or_else(|| {
            // Default template if not found
            TEMPLATES[0].1
        });

    // Create main.typ file
    let main_file = project_path.join("main.typ");
    fs::write(&main_file, content)
        .map_err(|e| format!("Failed to create main.typ: {}", e))?;

    Ok(main_file.to_string_lossy().to_string())
}

/// List available templates
#[tauri::command]
pub async fn list_templates() -> Result<Vec<String>, String> {
    Ok(TEMPLATES.iter().map(|(name, _)| name.to_string()).collect())
}

/// Get template content
#[tauri::command]
pub async fn get_template(name: String) -> Result<String, String> {
    TEMPLATES
        .iter()
        .find(|(t, _)| *t == name)
        .map(|(_, content)| content.to_string())
        .ok_or_else(|| format!("Template '{}' not found", name))
}
