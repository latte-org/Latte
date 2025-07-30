# Latte 📝✨

**Latte** is an open-source LaTeX editing environment that combines the power of a code editor (like Overleaf) with the ease of a Word-style interface. It’s designed for users of all levels — from LaTeX veterans to first-time users — to write beautiful documents faster and with more flexibility.

## 🌟 Project Highlights

- 🧠 **Live LaTeX Editor** – Real-time LaTeX editing with syntax highlighting and preview
- 🎨 **Visual (WYSIWYG) Editor** – Word-style UI for inserting sections, equations, images, and more
- 📤 **Export Options** – Download as `.tex`, `.pdf`, or zipped project
- 📁 **Built-in Templates** – Quickly start with pre-made document templates (e.g., academic papers, CVs)
- 🔌 **Extensible Architecture** – Open-source and modular, ready for plugins and custom templates

## 🧠 Why Latte?

LaTeX is powerful but can be intimidating. Latte bridges the gap:

- For experienced users: it’s a flexible Overleaf-like platform with full code control.
- For beginners: it provides Word-style controls that generate LaTeX behind the scenes.

Latte helps you **focus on content — not syntax**.

# 🛠️ Tech Stack (Planned)

## 🔹 Framework

- **Tauri** – Desktop application framework

## 🔹 Frontend

- **Vite**
- **Vue**
- **Monaco Editor** – Code editor (used in VS Code)
- **Tailwind CSS** – Styling system

## 🔹 Backend

- **Rust** – API layer
- **LaTeX compilation** using `tectonic`

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

## Installation

Please install pre-requisites before starting: 
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Yarn](https://classic.yarnpkg.com/lang/en/docs/install)

After installing pre-requisites, run the following commands:
- `yarn`
- `yarn tauri dev`

# 📄 License
This project is licensed under the Apache License 2.0.
You are free to use, modify, and distribute this software under the terms of the license.

See the [LICENSE](https://github.com/latte-org/Latte/blob/main/LICENSE) file for full license text.

# 🤝 Contributing
We welcome contributions of all kinds — bug fixes, feature suggestions, UI improvements, or documentation.

How to Contribute
1. Fork this repository
2. Create a new branch (```git checkout -b feature/my-feature```)
3. Commit your changes (```git commit -m 'Add new feature'```)
4. Push to the branch (```git push origin feature/my-feature```)
5. Open a Pull Request

Guidelines
- Use clear and descriptive commit messages
- Ensure code passes linting/formatting
- Write tests when adding new functionality (if applicable)
- Follow the coding style of the project

We use labels like good first issue and help wanted to help new contributors get started.
