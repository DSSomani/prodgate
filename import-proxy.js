const http = require('http');
const { URL } = require('url');

const PORT = process.env.PRODGATE_IMPORT_PORT || 8787;

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Request too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function normalizeGitHubItems(items) {
  return items
    .filter(it => !it.pull_request)
    .map(it => ({
      key: `#${it.number}`,
      title: it.title || 'Untitled',
      url: it.html_url || ''
    }));
}

async function fetchGitHub(payload) {
  const owner = (payload.owner || '').trim();
  const repo = (payload.repo || '').trim();
  const mode = (payload.mode || 'list').trim();
  const state = (payload.state || 'open').trim();
  const token = (payload.token || '').trim();
  const issueNumber = String(payload.issueNumber || '').trim();
  const limit = Math.max(1, Math.min(100, Number(payload.limit) || 20));

  if (!owner || !repo) throw new Error('owner and repo are required for GitHub import');

  const ghUrl = mode === 'single'
    ? new URL(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`)
    : new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
  if (mode !== 'single') {
    ghUrl.searchParams.set('state', state);
    ghUrl.searchParams.set('per_page', String(limit));
  }
  if (mode === 'single' && !issueNumber) {
    throw new Error('issueNumber is required for GitHub specific issue import');
  }

  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'prodgate-import-proxy'
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(ghUrl, { headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data && data.message ? data.message : 'GitHub API request failed';
    throw new Error(msg);
  }

  if (mode === 'single') {
    if (data && data.pull_request) {
      throw new Error('The provided GitHub number belongs to a pull request, not an issue');
    }
    return normalizeGitHubItems(data ? [data] : []);
  }
  return normalizeGitHubItems(Array.isArray(data) ? data : []);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/import/issues') {
    try {
      const payload = await readJsonBody(req);
      const source = (payload.source || '').trim();

      if (source !== 'github') throw new Error('source must be github');
      const items = await fetchGitHub(payload);

      return sendJson(res, 200, { items });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Import failed' });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`ProdGate import proxy listening on http://localhost:${PORT}`);
});
