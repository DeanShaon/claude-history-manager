const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');

const configPath = path.join(os.homedir(), '.claude.json');
const projectsBase = path.resolve(os.homedir(), '.claude', 'projects');

function readConfigSync() {
  if (!fs.existsSync(configPath)) return null;
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

async function readConfig() {
  try {
    const content = await fsp.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function listProjectDirsSync() {
  if (!fs.existsSync(projectsBase)) return [];
  return fs.readdirSync(projectsBase, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

async function listProjectDirs() {
  try {
    const entries = await fsp.readdir(projectsBase, { withFileTypes: true });
    return entries.filter(d => d.isDirectory()).map(d => d.name);
  } catch {
    return [];
  }
}

function matchProjectDir(projectPath, projectDirs, projectInfo) {
  if (!projectPath) return null;
  // Method 1: use lastSessionId
  if (projectInfo?.lastSessionId) {
    const sid = projectInfo.lastSessionId;
    for (const dir of projectDirs) {
      const sessionDir = path.join(projectsBase, dir);
      if (fs.existsSync(sessionDir)) {
        const files = fs.readdirSync(sessionDir);
        if (files.includes(sid + '.jsonl')) return dir;
      }
    }
  }
  // Method 2: match by path fragment
  const parts = projectPath.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  if (!lastPart) return null;
  return projectDirs.find(d => d.endsWith(lastPart)) ||
         projectDirs.find(d => d.includes(lastPart)) ||
         null;
}

async function matchProjectDirAsync(projectPath, projectDirs, projectInfo) {
  if (!projectPath) return null;
  // Method 1: use lastSessionId
  if (projectInfo?.lastSessionId) {
    const sid = projectInfo.lastSessionId;
    for (const dir of projectDirs) {
      const sessionDir = path.join(projectsBase, dir);
      try {
        await fsp.access(sessionDir);
        const files = await fsp.readdir(sessionDir);
        if (files.includes(sid + '.jsonl')) return dir;
      } catch { /* skip */ }
    }
  }
  // Method 2: match by path fragment
  const parts = projectPath.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  if (!lastPart) return null;
  return projectDirs.find(d => d.endsWith(lastPart)) ||
         projectDirs.find(d => d.includes(lastPart)) ||
         null;
}

function countLinesSync(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8').trim().split('\n').length;
  } catch { return 0; }
}

async function countLines(filePath) {
  try {
    const content = await fsp.readFile(filePath, 'utf-8');
    return content.trim().split('\n').length;
  } catch { return 0; }
}

function listSessionFilesSync(sessionDir) {
  return fs.readdirSync(sessionDir)
    .filter(f => f.endsWith('.jsonl') && !f.toLowerCase().includes('settings'))
    .map(f => {
      const fp = path.join(sessionDir, f);
      const st = fs.statSync(fp);
      return { id: f.replace('.jsonl', ''), filename: f, path: fp, modifiedAt: st.mtime, messageCount: countLinesSync(fp) };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

async function listSessionFiles(sessionDir) {
  const files = await fsp.readdir(sessionDir);
  const result = [];
  for (const f of files) {
    if (!f.endsWith('.jsonl') || f.toLowerCase().includes('settings')) continue;
    const fp = path.join(sessionDir, f);
    const st = await fsp.stat(fp);
    result.push({ id: f.replace('.jsonl', ''), filename: f, path: fp, modifiedAt: st.mtime, messageCount: await countLines(fp) });
  }
  return result.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

function extractMessageContent(msg) {
  if (!msg.content && typeof msg.content !== 'string') return { text: '', toolCalls: [] };

  if (Array.isArray(msg.content)) {
    const text = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    const toolCalls = msg.content.filter(c => c.type === 'tool_use').map(c => ({
      id: c.id,
      type: 'function',
      function: { name: c.name, arguments: typeof c.input === 'string' ? c.input : JSON.stringify(c.input) }
    }));
    return { text, toolCalls };
  }

  if (typeof msg.content === 'string') return { text: msg.content, toolCalls: [] };

  return { text: '', toolCalls: [] };
}

function extractToolCalls(msg) {
  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    return msg.tool_calls.map(tc => ({
      id: tc.id || '',
      type: tc.type || 'function',
      function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' }
    }));
  }
  return [];
}

function getTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter(c => c.type === 'text').map(c => c.text).join('\n');
  }
  return '';
}

function parseJSONLLines(content) {
  const lines = content.trim().split('\n');
  const messages = [];
  let sessionId = '';

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      if (data.sessionId && !sessionId) sessionId = data.sessionId;

      if (data.type === 'user' || data.type === 'assistant') {
        messages.push(data);
      } else if (data.message && (data.type === 'user' || data.type === 'assistant')) {
        messages.push({ type: data.type, message: data.message });
      }
    } catch { /* skip malformed lines */ }
  }
  return { sessionId, messages };
}

function normalizeMessage(msg) {
  const m = msg.message || msg;
  const role = m.role === 'user' ? 'user' : (msg.type === 'user' ? 'user' : 'assistant');
  const { text, toolCalls: contentTools } = extractMessageContent(m);
  const toolCalls = contentTools.length > 0 ? contentTools : extractToolCalls(m);
  return { role, content: text || '', toolCalls };
}

function getSummary(messages) {
  const userMsg = messages.find(m => {
    const type = m.message?.type || m.type;
    return type === 'user';
  });
  if (userMsg) {
    const content = userMsg.message?.content || userMsg.content || '';
    const text = getTextContent(content);
    return text.substring(0, 100);
  }
  return '';
}

function countMessages(messages) {
  return messages.filter(m => {
    const type = m.message?.type || m.type;
    return type === 'user' || type === 'assistant';
  }).length;
}

module.exports = {
  configPath, projectsBase,
  readConfigSync, readConfig,
  listProjectDirsSync, listProjectDirs,
  matchProjectDir, matchProjectDirAsync,
  listSessionFilesSync, listSessionFiles,
  extractMessageContent, extractToolCalls, getTextContent,
  parseJSONLLines, normalizeMessage,
  getSummary, countMessages, countLinesSync, countLines
};
