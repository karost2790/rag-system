import React from 'react';
import Chat from './components/Chat';
import UpdateContent from './components/UpdateContent';

function App() {
  return (
    <div className="App">
      <h1>RAG System</h1>
      <UpdateContent />
      <Chat />
    </div>
  );
}

export default App;
