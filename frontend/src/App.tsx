import { useState } from 'react';
import { LatexEditor, VisualEditor } from './components/Editor';
import './styles/main.css';

function App() {
  const [latexContent, setLatexContent] = useState('');
  const [visualContent, setVisualContent] = useState('');

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Latte - LaTeX Editor</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LaTeX Editor */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold">LaTeX Editor</h2>
            </div>
            <div className="p-4">
              <LatexEditor 
                onLatexChange={setLatexContent}
                onVisualChange={setVisualContent}
              />
            </div>
          </div>

          {/* Visual Editor */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold">Visual Editor</h2>
            </div>
            <div className="p-4">
              <VisualEditor 
                onLatexChange={setLatexContent}
                onVisualChange={setVisualContent}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
