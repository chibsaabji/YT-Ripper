const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Determine paths for binaries
const isDev = !app.isPackaged;
const ytDlpPath = isDev
  ? path.join(__dirname, 'yt-dlp.exe')
  : path.join(process.resourcesPath, 'yt-dlp.exe');
const ffmpegPath = isDev
  ? path.join(__dirname, 'ffmpeg', 'bin', 'ffmpeg.exe')
  : path.join(process.resourcesPath, 'ffmpeg', 'bin', 'ffmpeg.exe');

// In-memory cache for fetch-info (URL -> { timestamp, data })
const infoCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Track active child processes for graceful cancellation and cleanup
let activeFetchChild = null;
let activeDownloadChild = null;

// Security Whitelists
const ALLOWED_BROWSERS = new Set(['chrome', 'edge', 'firefox', 'brave', 'opera', 'vivaldi', 'safari', 'chromium']);
const ALLOWED_FORMATS = new Set(['mp4', 'webm', 'mp3']);

function isValidHttpUrl(string) {
  if (typeof string !== 'string' || !string.trim()) return false;
  try {
    const parsed = new URL(string.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 790,
    height: 700,
    minWidth: 790,
    minHeight: 700,
    icon: path.join(__dirname, 'YT-RIPPER.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    frame: false, // Disables native Windows frame completely
  });

  // Security: Prevent window navigation to arbitrary URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (isValidHttpUrl(url)) {
      shell.openExternal(url);
    }
  });

  // Security: Deny window popups and open valid web links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isValidHttpUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function cleanupProcesses() {
  if (activeFetchChild) {
    try {
      activeFetchChild.kill('SIGKILL');
    } catch (e) {}
    activeFetchChild = null;
  }
  if (activeDownloadChild) {
    try {
      activeDownloadChild.kill('SIGKILL');
    } catch (e) {}
    activeDownloadChild = null;
  }
}

app.on('before-quit', () => {
  cleanupProcesses();
});

app.on('window-all-closed', function () {
  cleanupProcesses();
  if (process.platform !== 'darwin') app.quit();
});

// Helper: Semantic version comparison (returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal)
function compareVersions(v1, v2) {
  const clean1 = (v1 || '').replace(/^v/i, '').trim();
  const clean2 = (v2 || '').replace(/^v/i, '').trim();

  const parts1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = clean2.split('.').map(n => parseInt(n, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// GitHub Releases Auto-Update Checker
async function checkGitHubRelease() {
  const currentVersion = app.getVersion() || '1.0.0';
  const url = 'https://api.github.com/repos/chibsaabji/YT-Ripper/releases/latest';

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'YT-Ripper-App',
      'Accept': 'application/vnd.github.v3+json'
    },
    signal: AbortSignal.timeout(8000) // 8s timeout to prevent hang on network loss
  });

  if (response.status === 403 || response.status === 429) {
    throw new Error('GitHub API rate limit reached. Please try again later.');
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const latestTag = data.tag_name || '';
  const isNewer = compareVersions(latestTag, currentVersion) > 0;

  let downloadUrl = data.html_url;
  if (Array.isArray(data.assets) && data.assets.length > 0) {
    const exeAsset = data.assets.find(a => a.name && a.name.toLowerCase().endsWith('.exe')) || data.assets[0];
    if (exeAsset && exeAsset.browser_download_url) {
      downloadUrl = exeAsset.browser_download_url;
    }
  }

  return {
    updateAvailable: isNewer,
    currentVersion: currentVersion,
    latestVersion: latestTag.replace(/^v/i, '') || currentVersion,
    releaseName: data.name || latestTag,
    releaseNotes: data.body || '',
    downloadUrl: downloadUrl,
    htmlUrl: data.html_url || 'https://github.com/chibsaabji/YT-Ripper/releases',
    publishedAt: data.published_at
  };
}

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion() || '1.0.0';
});

ipcMain.handle('check-for-updates', async () => {
  try {
    return await checkGitHubRelease();
  } catch (error) {
    console.error('Update check failed:', error);
    return {
      updateAvailable: false,
      error: error.message || 'Failed to check for updates.',
      currentVersion: app.getVersion() || '1.0.0'
    };
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

// Window control IPCs
ipcMain.on('window-close', (event) => {
  BrowserWindow.fromWebContents(event.sender).close();
});
ipcMain.on('window-minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender).minimize();
});
ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

// External Links with Strict URL Protocol Validation
ipcMain.on('open-external', (event, rawUrl) => {
  if (isValidHttpUrl(rawUrl)) {
    shell.openExternal(rawUrl.trim());
  } else {
    console.warn('Blocked opening non-HTTP external URL:', rawUrl);
  }
});

// Fast & Resilient Fetch Video Info with Input Validation & Process Timeout
ipcMain.handle('fetch-info', async (event, payload) => {
  const url = typeof payload === 'string' ? payload : (payload && payload.url);
  const cookies = typeof payload === 'object' && payload ? payload.cookies : null;

  const cleanUrl = (url || '').trim();
  if (!cleanUrl || !isValidHttpUrl(cleanUrl)) {
    throw new Error('Please enter a valid YouTube or video URL.');
  }

  // Cache key includes cookies if used
  const cacheKey = `${cleanUrl}${cookies ? `:${cookies}` : ''}`;
  const cached = infoCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  // Abort any previously running fetch process to prevent race conditions
  if (activeFetchChild) {
    try {
      activeFetchChild.kill('SIGKILL');
    } catch (e) {}
    activeFetchChild = null;
  }

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--socket-timeout', '15',
      '--sponsorblock-mark', 'all',
      '--js-runtimes', 'node',
      '--extractor-args', 'youtube:player_client=all'
    ];

    if (cookies && ALLOWED_BROWSERS.has(cookies.toLowerCase())) {
      args.push('--cookies-from-browser', cookies.toLowerCase());
    }

    if (cleanUrl.includes('list=') && !cleanUrl.includes('v=')) {
      args.push('--flat-playlist');
    } else {
      args.push('--no-playlist');
    }

    args.push(cleanUrl);

    const child = spawn(ytDlpPath, args);
    activeFetchChild = child;

    let output = '';
    let errorOutput = '';

    // Safety timeout: kill process if it takes more than 40s
    const timeoutHandle = setTimeout(() => {
      if (activeFetchChild === child) {
        try {
          child.kill('SIGKILL');
        } catch (e) {}
        activeFetchChild = null;
        reject(new Error('Extraction timed out. Check your internet connection.'));
      }
    }, 40000);

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      if (activeFetchChild === child) {
        activeFetchChild = null;
      }

      if (code === 0) {
        try {
          const parsed = JSON.parse(output);
          // Store in cache (cap cache at 50 entries)
          if (infoCache.size >= 50) {
            const oldestKey = infoCache.keys().next().value;
            infoCache.delete(oldestKey);
          }
          infoCache.set(cacheKey, { timestamp: Date.now(), data: parsed });
          resolve(parsed);
        } catch (e) {
          reject(new Error('Failed to parse video information.'));
        }
      } else {
        // Detailed error classification
        const errLower = errorOutput.toLowerCase();
        if (errLower.includes('sign in') || errLower.includes('bot') || errLower.includes('cookies')) {
          reject(new Error('Bot check or login required. Select your browser in Cookies dropdown.'));
        } else if (errLower.includes('private video')) {
          reject(new Error('This video is private.'));
        } else if (errLower.includes('not available') || errLower.includes('video unavailable')) {
          reject(new Error('Video is unavailable or removed.'));
        } else if (errLower.includes('timed out') || errLower.includes('network')) {
          reject(new Error('Connection timed out. Check your internet connection.'));
        } else {
          reject(new Error('Failed to fetch video info.'));
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      if (activeFetchChild === child) {
        activeFetchChild = null;
      }
      reject(new Error(`Extraction engine error: ${err.message}`));
    });
  });
});

// Download Video with Multi-Threaded Fragments, Validation & Cancellation
ipcMain.on('download-video', (event, options) => {
  const { url, location, format, resolution, cookies, speedLimit, metadata, subtitles, playlist, sponsorblock, chapters } = options;

  // Validate URL
  if (!isValidHttpUrl(url)) {
    console.error('Invalid download URL provided:', url);
    return event.reply('download-complete', 1);
  }

  // Validate save location directory exists
  if (!location || typeof location !== 'string' || !fs.existsSync(location)) {
    console.error('Invalid save location path:', location);
    return event.reply('download-complete', 1);
  }

  // Sanitize format
  const safeFormat = ALLOWED_FORMATS.has(format) ? format : 'mp4';

  // Sanitize resolution (must be 3 or 4 digit integer)
  const safeResolution = /^\d{3,4}$/.test(String(resolution)) ? String(resolution) : '1080';

  // Kill any previous active download
  if (activeDownloadChild) {
    try {
      activeDownloadChild.kill('SIGKILL');
    } catch (e) {}
    activeDownloadChild = null;
  }

  const args = [
    '--ffmpeg-location', ffmpegPath,
    '--js-runtimes', 'node',
    '--extractor-args', 'youtube:player_client=all',
    '--concurrent-fragments', '4', // High-speed multi-threaded fragment downloads
    '--no-mtime',
    '--socket-timeout', '30',
    '-o', path.join(location, '%(title)s [%(id)s].%(ext)s'),
  ];

  if (safeFormat === 'mp3') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    let formatString = `bestvideo[height<=${safeResolution}]+bestaudio/best[height<=${safeResolution}]/best`;
    args.push('-f', formatString);
    args.push('--merge-output-format', safeFormat === 'webm' ? 'webm' : 'mp4');
  }

  if (metadata) {
    args.push('--embed-thumbnail', '--embed-chapters', '--embed-metadata');
  }
  if (subtitles && safeFormat !== 'mp3') {
    args.push('--embed-subs', '--sub-langs', 'all');
  }

  if (playlist) {
    args.push('--yes-playlist');
  } else {
    args.push('--no-playlist');
  }

  if (sponsorblock) args.push('--sponsorblock-remove', 'all');
  if (chapters) args.push('--split-chapters');

  // Sanitize and apply cookies
  if (cookies && ALLOWED_BROWSERS.has(cookies.toLowerCase())) {
    args.push('--cookies-from-browser', cookies.toLowerCase());
  }

  // Sanitize and apply speed limit (e.g. 5M, 500K, 1G)
  if (speedLimit && /^(\d+(\.\d+)?)[kKmMgGtT]?$/.test(speedLimit.trim())) {
    args.push('--limit-rate', speedLimit.trim());
  }

  args.push(url.trim());

  const child = spawn(ytDlpPath, args);
  activeDownloadChild = child;

  child.stdout.on('data', (data) => {
    event.reply('download-progress', data.toString());
  });

  child.stderr.on('data', (data) => {
    console.error(`yt-dlp stderr: ${data}`);
  });

  child.on('close', (code) => {
    if (activeDownloadChild === child) {
      activeDownloadChild = null;
    }
    event.reply('download-complete', code);
  });

  child.on('error', (err) => {
    if (activeDownloadChild === child) {
      activeDownloadChild = null;
    }
    console.error('Download spawn error:', err);
    event.reply('download-complete', 1);
  });
});

// Cancel active download
ipcMain.on('cancel-download', (event) => {
  if (activeDownloadChild) {
    try {
      activeDownloadChild.kill('SIGKILL');
    } catch (e) {}
    activeDownloadChild = null;
    event.reply('download-cancelled');
  }
});
