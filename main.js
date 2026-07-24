const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Determine paths for binaries
const isDev = !app.isPackaged;
const ytDlpPath = isDev
  ? path.join(__dirname, 'yt-dlp.exe')
  : path.join(process.resourcesPath, 'yt-dlp.exe');
const ffmpegPath = isDev
  ? path.join(__dirname, 'ffmpeg', 'bin', 'ffmpeg.exe')
  : path.join(process.resourcesPath, 'ffmpeg', 'bin', 'ffmpeg.exe');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 790,
    minHeight: 700,
    icon: path.join(__dirname, 'YT-RIPPER.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false, // Disables native Windows frame completely
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
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

// External Links
ipcMain.on('open-external', (event, url) => {
  // Add some basic validation to ensure it's an http/https link for security
  if (url.startsWith('http://') || url.startsWith('https://')) {
    shell.openExternal(url);
  }
});

ipcMain.handle('fetch-info', async (event, url) => {
  return new Promise((resolve, reject) => {
    let args = [
      '--dump-single-json',
      '--sponsorblock-mark', 'all',
      '--js-runtimes', 'node'
    ];
    if (url.includes('list=') && !url.includes('v=')) {
      args.push('--flat-playlist');
    } else {
      args.push('--no-playlist');
    }
    args.push(url);
    const child = spawn(ytDlpPath, args);
    let output = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          reject(new Error('Failed to parse yt-dlp JSON'));
        }
      } else {
        reject(new Error('Failed to fetch video info'));
      }
    });
  });
});

ipcMain.on('download-video', (event, options) => {
  const { url, location, format, resolution, cookies, speedLimit, metadata, subtitles, playlist, sponsorblock, chapters } = options;

  const args = [
    '--ffmpeg-location', ffmpegPath,
    '--js-runtimes', 'node',
    '-o', path.join(location, '%(title)s [%(id)s].%(ext)s'),
  ];

  if (format === 'mp3') {
    args.push('-x', '--audio-format', 'mp3');
  } else {
    let formatString = `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`;
    args.push('-f', formatString);
    args.push('--merge-output-format', format === 'webm' ? 'webm' : 'mp4');
  }

  if (metadata) {
    args.push('--embed-thumbnail', '--embed-chapters', '--embed-metadata');
  }
  if (subtitles && format !== 'mp3') {
    args.push('--embed-subs', '--sub-langs', 'all');
  }

  if (playlist) {
    args.push('--yes-playlist');
  } else {
    args.push('--no-playlist');
  }

  if (sponsorblock) args.push('--sponsorblock-remove', 'all');
  if (chapters) args.push('--split-chapters');
  if (cookies) args.push('--cookies-from-browser', cookies);
  if (speedLimit) args.push('--limit-rate', speedLimit);

  args.push(url);

  const child = spawn(ytDlpPath, args);

  child.stdout.on('data', (data) => {
    event.reply('download-progress', data.toString());
  });

  child.stderr.on('data', (data) => {
    console.error(`yt-dlp stderr: ${data}`);
  });

  child.on('close', (code) => {
    event.reply('download-complete', code);
  });
});
