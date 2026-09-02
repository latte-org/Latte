# Latte 📝✨

**Latte** is an open-source Typst editing environment that combines the power of a code editor (like Overleaf) with the ease of a Word-style interface. It's designed for users of all levels — from Typst veterans to first-time users — to write beautiful documents faster and with more flexibility.

## 🌟 Project Highlights

- 🧠 **Live Typst Editor** – Real-time Typst editing with syntax highlighting and preview
- 🎨 **Visual (WYSIWYG) Editor** – Word-style UI for inserting sections, equations, images, and more
- 📤 **Export Options** – Download as `.typ`, `.pdf`, `.html`, or zipped project
- 📁 **Built-in Templates** – Quickly start with pre-made document templates (e.g., academic papers, CVs)
- 🔌 **Extensible Architecture** – Open-source and modular, ready for plugins and custom templates

## 🧠 Why Latte?

Typst is powerful but can be intimidating. Latte bridges the gap:

- For experienced users: it's a flexible Overleaf-like platform with full code control.
- For beginners: it provides Word-style controls that generate Typst behind the scenes.

Latte helps you **focus on content — not syntax**.

# 🛠️ Tech Stack

## 🔹 Framework

- **Tauri** – Desktop application framework

## 🔹 Frontend

- **Vite**
- **Vue**
- **Monaco Editor** – Code editor (used in VS Code)

## 🔹 Backend

- **Rust** – API layer
- **Typst** – Modern typesetting system (v0.14.0)
- **Typst PDF/HTML** – Export functionality

# 📦 Getting Started

> ⚠️ This project is still in early development. Setup instructions will be updated as development progresses.

## Clone the repository

```bash
git clone https://github.com/latte-org/Latte.git
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Documentation

- [Tauri](https://v2.tauri.app/start/)
- [Typst](https://typst.app/docs/)

## Installation

Please install pre-requisites before starting: 
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Yarn](https://classic.yarnpkg.com/lang/en/docs/install)
- [Rust](https://www.rust-lang.org/tools/install)

After installing pre-requisites, run the following commands:
```bash
yarn
yarn tauri dev
```

### Building from Source

1. Install Rust:
   ```bash
   curl https://sh.rustup.rs -sSf | sh
   ```

2. Install dependencies:
   ```bash
   cd src-tauri
   cargo build
   ```

3. Run the development server:
   ```bash
   yarn tauri dev
   ```

The Typst backend is fully integrated and requires no additional setup. All fonts and libraries are bundled with the application.

# 🚀 Features

## Backend API

The following Tauri commands are available:

- `compile_typst_to_pdf(entry_path: String)` - Compile a Typst file to PDF
- `compile_typst_to_html(entry_path: String)` - Compile a Typst file to HTML
- `compile_typst_string_to_pdf(source: String, root_dir: Option<String>)` - Compile Typst source string to PDF
- `get_typst_diagnostics(entry_path: String)` - Get compilation errors and warnings
- `read_file(path: String)` - Read a file from the filesystem
- `write_file(path: String, contents: String)` - Write a file to the filesystem
- `create_project(name: String, template: Option<String>)` - Create a new Typst project
- `list_templates()` - List available templates

# 📄 License
This project is licensed under the Apache License 2.0.
You are free to use, modify, and distribute this software under the terms of the license.

See the [LICENSE](https://github.com/latte-org/Latte/blob/main/LICENSE) file for full license text.

# 🤝 Contributing
We welcome contributions of all kinds — bug fixes, feature suggestions, UI improvements, or documentation.

## How to Contribute
1. Fork this repository
2. Create a new branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## Guidelines
- Use clear and descriptive commit messages
- Ensure code passes linting/formatting
- Write tests when adding new functionality (if applicable)
- Follow the coding style of the project

We use labels like `good first issue` and `help wanted` to help new contributors get started.
