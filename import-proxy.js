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

function normalizeJiraItems(issues) {
  return issues.map(it => ({
    key: it.key || '',
    title: (it.fields && it.fields.summary) || 'Untitled',
    url: ''
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

async function fetchJira(payload) {
  const mode = (payload.mode || 'list').trim();
  const baseUrlRaw = (payload.baseUrl || '').trim();
  const email = (payload.email || '').trim();
  const token = (payload.token || '').trim();
  const jql = (payload.jql || '').trim();
  const issueKey = (payload.issueKey || '').trim();
  const limit = Math.max(1, Math.min(100, Number(payload.limit) || 20));

  if (!baseUrlRaw || !email || !token) {
    throw new Error('baseUrl, email, and token are required for Jira import');
  }

  let base;
  try {
    base = new URL(baseUrlRaw);
  } catch {
    throw new Error('Invalid Jira base URL');
  }

  const jiraUrl = mode === 'single'
    ? new URL(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, base)
    : new URL('/rest/api/3/search', base);
  if (mode === 'single') {
    if (!issueKey) throw new Error('issueKey is required for Jira specific issue import');
    jiraUrl.searchParams.set('fields', 'summary');
  } else {
    if (!jql) throw new Error('jql is required for Jira list import');
    jiraUrl.searchParams.set('jql', jql);
    jiraUrl.searchParams.set('maxResults', String(limit));
    jiraUrl.searchParams.set('fields', 'summary');
  }

  const basic = Buffer.from(`${email}:${token}`).toString('base64');
  const response = await fetch(jiraUrl, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Basic ${basic}`
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data && data.errorMessages && data.errorMessages[0]
      ? data.errorMessages[0]
      : 'Jira API request failed';
    throw new Error(msg);
  }

  if (mode === 'single') {
    return normalizeJiraItems(data ? [data] : []);
  }
  return normalizeJiraItems(Array.isArray(data.issues) ? data.issues : []);
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

      let items = [];
      if (source === 'github') items = await fetchGitHub(payload);
      else if (source === 'jira') items = await fetchJira(payload);
      else throw new Error('source must be github or jira');

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
