const express = require('express');
const { marked } = require('marked');
const { nanoid } = require('nanoid');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));

(async () => {
  try {
    await redisClient.connect();
    console.log(' Connected to Redis');
  } catch (err) {
    console.error(' Could not connect to Redis:', err);
  }
})();

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

const layout = (title, bodyContent, isMarkdown = false) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown.min.css">
  <style>
    * { box-sizing: border-box; }
    body {
      background-color: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px 16px;
      display: flex;
      justify-content: center;
    }
    .wrapper {
      width: 100%;
      max-width: 860px;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 32px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 1.5rem;
      color: #58a6ff;
    }
    textarea {
      width: 100%;
      height: 400px;
      background: #0d1117;
      color: #e6edf3;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 14px;
      font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
      font-size: 14px;
      resize: vertical;
    }
    textarea:focus {
      outline: none;
      border-color: #58a6ff;
    }
    .btn {
      background-color: #238636;
      color: #ffffff;
      border: 1px solid rgba(240, 246, 255, 0.1);
      border-radius: 6px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 16px;
    }
    .btn:hover {
      background-color: #2ea043;
    }
    .url-display {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      word-break: break-all;
      margin: 20px 0;
    }
    .url-display a {
      color: #58a6ff;
      text-decoration: none;
    }
    .btn-secondary {
      background-color: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-secondary:hover {
      background-color: #30363d;
    }
    .markdown-body {
      background-color: transparent !important;
      color: #c9d1d9 !important;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card \${isMarkdown ? 'markdown-body' : ''}">
      \${bodyContent}
    </div>
  </div>
</body>
</html>
\`;

app.get('/', (req, res) => {
  const content = `
    <div class="header">
      <h1>🐸 Odd Frog Markdown Viewer</h1>
    </div>
    <form action="/publish" method="POST">
      <textarea name="markdown" placeholder="# Paste your markdown here..." required></textarea>
      <br>
      <button class="btn" type="submit">Publish & Generate Link</button>
    </form>
  `;
  res.send(layout('Odd Frog Markdown Viewer', content));
});

app.post('/publish', async (req, res) => {
  try {
    const rawMarkdown = req.body.markdown;
    const docId = nanoid(8);
    await redisClient.set(docId, rawMarkdown);

    const fullUrl = \`\${req.protocol}://\${req.get('host')}/v/\${docId}\`;
    const content = `
      <div class="header">
        <h1>🐸 Document Published!</h1>
      </div>
      <p>Your document is stored and ready to share:</p>
      <div class="url-display">
        <a id="share-link" href="\${fullUrl}" target="_blank">\${fullUrl}</a>
        <button class="btn-secondary" onclick="navigator.clipboard.writeText('\${fullUrl}'); this.innerText = 'Copied!';">Copy Link</button>
      </div>
      <a href="/" style="color: #58a6ff; text-decoration: none;">← Create another document</a>
    `;
    res.send(layout('Document Published', content));
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to save the document to Redis.");
  }
});

app.get('/v/:id', async (req, res) => {
  try {
    const docId = req.params.id;
    const rawMarkdown = await redisClient.get(docId);

    if (!rawMarkdown) {
      return res.status(404).send(layout('404 Not Found', '<h2>🐸 Ribbit! Document Not Found</h2><p>This link may have expired or does not exist.</p><a href="/" style="color: #58a6ff;">← Back to Home</a>'));
    }

    const htmlBody = marked.parse(rawMarkdown);
    res.send(layout('Odd Frog Viewer', htmlBody, true));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error rendering document.");
  }
});

app.listen(PORT, () => {
  console.log(\`🐸 Odd Frog running on port \${PORT}\`);
});