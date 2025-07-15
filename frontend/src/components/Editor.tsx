import React, { useState } from 'react';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import { EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface EditorProps {
  onLatexChange: (latex: string) => void;
  onVisualChange: (html: string) => void;
}

const LatexEditor: React.FC<EditorProps> = ({ onLatexChange }) => {
  const [latexCode, setLatexCode] = useState('');

  const handleLatexChange = (value: string | undefined) => {
    if (value) {
      setLatexCode(value);
      onLatexChange(value);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <MonacoEditor
        height="500"
        language="latex"
        theme="vs-dark"
        value={latexCode}
        onChange={handleLatexChange}
        options={{
          minimap: { enabled: true },
          wordWrap: 'on',
          fontSize: 14,
          automaticLayout: true,
        }}
      />
    </div>
  );
};

const VisualEditor: React.FC<EditorProps> = ({ onVisualChange }) => {
  const [editor] = useState(() => 
    new Editor({
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: 'Type your LaTeX content here...',
        }),
      ],
      content: '',
      onUpdate: ({ editor }) => {
        onVisualChange(editor.getHTML());
      },
    })
  );

  return (
    <div className="border rounded-lg p-4">
      <EditorContent editor={editor} />
    </div>
  );
};

export { LatexEditor, VisualEditor };
