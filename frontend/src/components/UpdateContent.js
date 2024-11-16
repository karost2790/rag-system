import React, { useState } from 'react';
import axios from 'axios';

const UpdateContent = () => {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');

  const uploadFile = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('/api/upload-markdown', formData);
      alert('File uploaded successfully.');
    } catch (error) {
      alert('Failed to upload file.');
    }
  };

  const scrapeUrl = async () => {
    if (!url) return;
    try {
      await axios.post('/api/scrape-url', { url });
      alert('URL content scraped successfully.');
    } catch (error) {
      alert('Failed to scrape URL.');
    }
  };

  return (
    <div className="update-content">
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={uploadFile}>Upload Markdown</button>
      <input type="text" placeholder="Enter URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button onClick={scrapeUrl}>Scrape URL</button>
    </div>
  );
};

export default UpdateContent;