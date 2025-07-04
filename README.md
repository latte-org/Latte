# Latte 📝✨

**Latte** is an open-source LaTeX editing environment that combines the power of a code editor (like Overleaf) with the ease of a Word-style interface. It’s designed for users of all levels — from LaTeX veterans to first-time users — to write beautiful documents faster and with more flexibility.


## 🌟 Project Highlights

- 🧠 **Live LaTeX Editor** – Real-time LaTeX editing with syntax highlighting and preview
- 🎨 **Visual (WYSIWYG) Editor** – Word-style UI for inserting sections, equations, images, and more
- 📤 **Export Options** – Download as `.tex`, `.pdf`, or zipped project
- 📁 **Built-in Templates** – Quickly start with pre-made document templates (e.g., academic papers, CVs)
- 🔌 **Extensible Architecture** – Open-source and modular, ready for plugins and custom templates


## 🧠 Why TexFlow?

LaTeX is powerful but can be intimidating. TexFlow bridges the gap:

- For experienced users: it’s a flexible Overleaf-like platform with full code control.
- For beginners: it provides Word-style controls that generate LaTeX behind the scenes.

TexFlow helps you **focus on content — not syntax**.


## 🛠️ Tech Stack (Planned)

### 🔹 Frontend

- **React** – UI framework
- **Monaco Editor** – Code editor (used in VS Code)
- **Tiptap** – For rich-text (WYSIWYG) visual editing
- **Tailwind CSS** – Styling system

### 🔹 Backend

- **Node.js** or **Rust** – API layer
- **LaTeX compilation** using `pdflatex`, `tectonic`, or `lualatex`
- **Docker sandboxing** – To isolate LaTeX compilation for security

### 🔹 Other Tools

- **GitHub Actions** – For CI/CD
- **Express / FastAPI** – API routing
- **Optional**: WebSockets for real-time collaboration


## 📦 Getting Started

> ⚠️ This project is still in early development. Setup instructions will be updated as development progresses.

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/texflow.git
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the development servers
Frontend:
```bash
npm run dev
```

### 4. Access the app
Visit [http://localhost:3000](http://localhost:3000) in your browser to start using TexFlow.

## 📄 License
This project is licensed under the Apache License 2.0.
You are free to use, modify, and distribute this software under the terms of the license.

See the [LICENSE](https://github.com/sarahvilete/TexFlow?tab=Apache-2.0-1-ov-file) file for full license text.

## 🤝 Contributing
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
