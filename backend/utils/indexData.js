// TODO: Implement data indexing functionality

const fs = require('fs');
const axios = require('axios');
const { OpenAI } = require('langchain');
require('dotenv').config();

const markdownContent = fs.readFileSync('langchain_documentation.md', 'utf-8');
const sections = markdownContent.split('\n\n');

async function indexData(content) {
    for (const section of sections) {
        const embedding = await getEmbedding(section);
        await axios.post('http://localhost:8080/vectors', {
            vector: embedding,
            content: section,
            metadata: { category: "Documentation" }
        });
    }
    console.log("Data indexed successfully!");
}

async function getEmbedding(text) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    return openai.embed({ input: text });
}

module.exports = { indexData };