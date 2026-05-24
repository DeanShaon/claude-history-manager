const express = require('express');
const cors = require('cors');
const fsp = require('fs').promises;
const fs = require('fs');
const path = require('path');
const os = require('os');
const utils = require('./utils');
const cache = require('./cache');

const app = express();
const PORT = 3333;
const CACHE_TTL = 15_000; // 15s

app.use(cors());
app.use(express.json());

// ── GET /api/projects ────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  try {
    const data = await cache.getOrSetAsync('projects', CACHE_TTL, async () => {
      const config = await utils.readConfig();
      if (!config) return { success: true, projects: [] };

      const projects = config.projects || {};
      const projectList = Object.entries(projects).map(([projectPath, info]) => ({
        path: projectPath,
        name: path.basename(projectPath) || projectPath,
        lastSessionId: info.lastSessionId || null
      }));

      return { success: true, projects: projectList };
    });

    if (!data.success && data.error) {
      return res.status(404).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/sessions ────────────────────────────────────────────────
app.get('/api/sessions', async (req, res) => {
  try {
    const { path: projectPath } = req.query;
    if (!projectPath) return res.status(400).json({ error: '缺少 path 参数' });

    const [config, projectDirs] = await Promise.all([
      utils.readConfig(),
      utils.listProjectDirs()
    ]);

    const projectInfo = config?.projects?.[projectPath];
    if (!projectDirs.length) return res.json({ success: true, sessions: [] });

    const matchedDir = await utils.matchProjectDirAsync(projectPath, projectDirs, projectInfo);
    if (!matchedDir) return res.json({ success: true, sessions: [] });

    const sessionDir = path.join(utils.projectsBase, matchedDir);
    const sessions = await utils.listSessionFiles(sessionDir);

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Path validation helper ──────────────────────────────────────────
function validateFilePath(filePath) {
  const allowedBase = path.resolve(os.homedir(), '.claude', 'projects');
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(allowedBase + path.sep) && resolvedPath !== allowedBase) {
    return null;
  }
  return resolvedPath;
}

// ── GET /api/session-detail ─────────────────────────────────────────
app.get('/api/session-detail', async (req, res) => {
  try {
    const { filePath, format } = req.query;
    if (!filePath) return res.status(400).json({ error: '缺少 filePath 参数' });

    const resolvedPath = validateFilePath(filePath);
    if (!resolvedPath) return res.status(403).json({ error: '禁止访问该路径' });

    const fileContent = await fsp.readFile(resolvedPath, 'utf-8');
    const { sessionId, messages: rawMessages } = utils.parseJSONLLines(fileContent);

    const parsedMessages = rawMessages
      .map(msg => utils.normalizeMessage(msg))
      .filter(msg => msg.content || msg.toolCalls.length > 0);

    const sid = sessionId || path.basename(filePath, '.jsonl');

    // Markdown export
    if (format === 'md') {
      const lines = [];
      lines.push(`# Session: ${sid}`);
      lines.push(`> Exported at ${new Date().toISOString()}\n`);
      for (const msg of parsedMessages) {
        const roleLabel = msg.role === 'user' ? '### User' : '### Claude';
        lines.push(roleLabel);
        if (msg.content) lines.push(msg.content);
        if (msg.toolCalls.length > 0) {
          lines.push('\n**Tool calls:**');
          for (const tc of msg.toolCalls) {
            lines.push(`- \`${tc.function.name}\``);
            const args = tc.function.arguments;
            if (args) lines.push(`  \`\`\`json\n  ${args}\n  \`\`\``);
          }
        }
        lines.push('');
      }
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="session-${sid.slice(0, 8)}.md"`);
      return res.send(lines.join('\n'));
    }

    res.json({
      success: true,
      sessionId: sid,
      messages: parsedMessages
    });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: '文件不存在' });
    console.error('获取会话详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DELETE /api/sessions ────────────────────────────────────────────
app.delete('/api/sessions', async (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: '缺少 filePath 参数' });

    const resolvedPath = validateFilePath(filePath);
    if (!resolvedPath) return res.status(403).json({ error: '禁止访问该路径' });

    await fsp.unlink(resolvedPath);
    cache.clear();
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: '文件不存在' });
    console.error('删除会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/search ──────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    if (!query) return res.status(400).json({ error: '缺少搜索关键词' });

    const config = await utils.readConfig();
    if (!config) return res.json({ success: true, results: [] });

    const projects = config.projects || {};
    const projectDirs = await utils.listProjectDirs();
    if (!projectDirs.length) return res.json({ success: true, results: [] });

    const results = [];
    const searchLower = query.toLowerCase();
    const entries = Object.entries(projects);

    for (const [projectPath, projectInfo] of entries) {
      const projectName = path.basename(projectPath) || projectPath;
      const matchedDir = await utils.matchProjectDirAsync(projectPath, projectDirs, projectInfo);
      if (!matchedDir) continue;

      const sessionDir = path.join(utils.projectsBase, matchedDir);
      let files;
      try {
        const all = await fsp.readdir(sessionDir);
        files = all.filter(f => f.endsWith('.jsonl') && !f.toLowerCase().includes('settings'));
      } catch { continue; }

      for (const file of files) {
        if (results.length >= 50) break;

        let content;
        try {
          content = await fsp.readFile(path.join(sessionDir, file), 'utf-8');
        } catch { continue; }

        const { messages } = utils.parseJSONLLines(content);
        let found = false;

        for (const msg of messages) {
          if (found) break;
          const text = utils.getTextContent(msg.message?.content || msg.content || '');
          const idx = text.toLowerCase().indexOf(searchLower);
          if (idx === -1) continue;

          const start = Math.max(0, idx - 50);
          const end = Math.min(text.length, idx + query.length + 50);
          const preview = '...' + text.substring(start, end) + '...';

          results.push({
            sessionId: msg.sessionId || msg.message?.sessionId || file.replace('.jsonl', ''),
            filePath: path.join(sessionDir, file),
            projectName, projectPath,
            role: msg.message?.role || msg.role,
            preview,
            matchIndex: idx
          });
          found = true;
        }
      }
    }

    res.json({ success: true, results: results.slice(0, 50) });
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/stats ───────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const data = await cache.getOrSetAsync('stats', CACHE_TTL, async () => {
      const config = await utils.readConfig();
      if (!config) return {
        success: true,
        stats: { totalProjects: 0, totalSessions: 0, projectStats: [], contributionGraph: [], recentSessions: [], monthlyTrends: [], hourlyDistribution: [], dayOfWeekDistribution: [], avgMessageCount: 0 }
      };

      const projects = config.projects || {};
      const projectDirs = await utils.listProjectDirs();
      const entries = Object.entries(projects);
      const projectStats = [];
      const contributionMap = new Map();
      const recentSessions = [];
      let totalSessions = 0;

      const monthlyMap = new Map();
      const hourlyMap = new Map();
      const dowMap = new Map();
      let totalMessagesForAvg = 0;
      let sessionWithMessages = 0;

      for (const [projectPath, projectInfo] of entries) {
        const projectName = path.basename(projectPath) || projectPath;
        const matchedDir = await utils.matchProjectDirAsync(projectPath, projectDirs, projectInfo);
        if (!matchedDir) continue;

        const sessionDir = path.join(utils.projectsBase, matchedDir);
        let files;
        try {
          files = await utils.listSessionFiles(sessionDir);
        } catch { continue; }

        const sessionCount = files.length;
        totalSessions += sessionCount;
        projectStats.push({ name: projectName, count: sessionCount, projectPath });

        for (const f of files) {
          const d = f.modifiedAt;
          const dateKey = d.toISOString().split('T')[0];
          contributionMap.set(dateKey, (contributionMap.get(dateKey) || 0) + 1);

          const monthKey = dateKey.slice(0, 7);
          monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);

          const hour = d.getHours();
          hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);

          const dow = d.getDay();
          dowMap.set(dow, (dowMap.get(dow) || 0) + 1);
        }

        // Recent sessions: read first 10 files for summary
        for (const f of files.slice(0, 10)) {
          if (recentSessions.length >= 10) break;
          try {
            const content = await fsp.readFile(f.path, 'utf-8');
            const { messages } = utils.parseJSONLLines(content);
            const mc = utils.countMessages(messages);
            if (mc > 0) {
              totalMessagesForAvg += mc;
              sessionWithMessages++;
            }
            recentSessions.push({
              sessionId: f.id,
              filePath: f.path,
              projectPath, projectName,
              modifiedAt: f.modifiedAt,
              messageCount: mc,
              summary: utils.getSummary(messages)
            });
          } catch { /* skip unreadable files */ }
        }
      }

      projectStats.sort((a, b) => b.count - a.count);
      recentSessions.sort((a, b) => b.modifiedAt - a.modifiedAt);

      const contributionGraph = Array.from(contributionMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const filteredGraph = contributionGraph.filter(item => new Date(item.date) >= oneYearAgo);

      const monthlyTrends = Array.from(monthlyMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));

      const hourlyDistribution = Array.from(hourlyMap.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour - b.hour);

      const dayOfWeekDistribution = Array.from(dowMap.entries())
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day - b.day);

      const avgMessageCount = sessionWithMessages > 0
        ? Math.round(totalMessagesForAvg / sessionWithMessages)
        : 0;

      return {
        success: true,
        stats: {
          totalProjects: entries.length,
          totalSessions,
          projectStats: projectStats.slice(0, 10),
          contributionGraph: filteredGraph,
          recentSessions: recentSessions.slice(0, 10),
          monthlyTrends,
          hourlyDistribution,
          dayOfWeekDistribution,
          avgMessageCount
        }
      };
    });

    res.json(data);
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/security/scan ──────────────────────────────────────────
app.get('/api/security/scan', async (req, res) => {
  try {
    const config = await utils.readConfig();
    if (!config) return res.json({ success: true, results: [] });

    const projects = config.projects || {};
    const projectDirs = await utils.listProjectDirs();

    const sensitivePatterns = [
      { name: 'API Key', pattern: /(?:sk-|api[_-]?key|apikey)[\w-]{20,}/gi, severity: 'high' },
      { name: 'Token', pattern: /(?:token|access[_-]?token|auth[_-]?token)[\s:=]+[a-zA-Z0-9._-]{20,}/gi, severity: 'high' },
      { name: 'Password', pattern: /(?:password|passwd|pwd)[\s:=]+[^\s]{4,}/gi, severity: 'medium' },
      { name: 'Email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, severity: 'low' },
      { name: 'IP Address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, severity: 'low' },
      { name: 'JWT', pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, severity: 'high' }
    ];

    const results = [];

    for (const [projectPath, projectInfo] of Object.entries(projects)) {
      const projectName = path.basename(projectPath) || projectPath;
      const matchedDir = await utils.matchProjectDirAsync(projectPath, projectDirs, projectInfo);
      if (!matchedDir) continue;

      const sessionDir = path.join(utils.projectsBase, matchedDir);
      let files;
      try {
        const all = await fsp.readdir(sessionDir);
        files = all.filter(f => f.endsWith('.jsonl') && !f.toLowerCase().includes('settings'));
      } catch { continue; }

      for (const file of files) {
        let content;
        try {
          content = await fsp.readFile(path.join(sessionDir, file), 'utf-8');
        } catch { continue; }

        for (const pattern of sensitivePatterns) {
          const matches = content.match(pattern.pattern);
          if (!matches) continue;
          const unique = [...new Set(matches.map(m => m.substring(0, 50)))];
          for (const match of unique) {
            results.push({ type: pattern.name, severity: pattern.severity, content: match, fileName: file, projectName, projectPath });
          }
        }
      }
    }

    const severityOrder = { high: 0, medium: 1, low: 2 };
    results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json({ success: true, results: results.slice(0, 100), total: results.length });
  } catch (error) {
    console.error('扫描敏感信息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 端点: /api/projects  /api/sessions  /api/session-detail  /api/search  /api/stats  /api/security/scan`);
});
