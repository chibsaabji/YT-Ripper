// DOM Elements
const urlInput = document.getElementById('url-input');
const fetchBtn = document.getElementById('fetch-btn');
const loading = document.getElementById('loading');
const videoPanel = document.getElementById('video-panel');
const progressPanel = document.getElementById('progress-panel');

// Window Controls
document.getElementById('btn-close').addEventListener('click', () => window.api.closeWindow());
document.getElementById('btn-minimize').addEventListener('click', () => window.api.minimizeWindow());
document.getElementById('btn-maximize').addEventListener('click', () => window.api.maximizeWindow());

const videoThumbnail = document.getElementById('video-thumbnail');
const videoTitle = document.getElementById('video-title');
const videoChannel = document.getElementById('video-channel');
const resolutionGroup = document.getElementById('resolution-group');

// Toast Notification System
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg = type === 'success'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34c759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    : type === 'error'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

class CustomDropdown {
  constructor(containerId, onChange) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.selected = this.container.querySelector('.dropdown-selected');
    this.selectedText = this.selected.querySelector('span');
    this.optionsContainer = this.container.querySelector('.dropdown-options');
    this.value = this.container.dataset.value;
    this.onChange = onChange;

    this.selected.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = this.container.classList.contains('open');
      document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
      if (!isOpen) this.container.classList.add('open');
    });

    this.optionsContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (item) {
        this.setValue(item.dataset.value, item.textContent);
        this.container.classList.remove('open');
      }
    });
  }

  setValue(val, text) {
    this.value = val;
    this.selectedText.textContent = text;
    this.container.dataset.value = val;
    this.optionsContainer.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
    const activeItem = this.optionsContainer.querySelector(`[data-value="${val}"]`);
    if (activeItem) activeItem.classList.add('active');

    if (this.onChange) this.onChange(val);
  }

  setOptions(optionsArray) {
    this.optionsContainer.innerHTML = '';
    optionsArray.forEach(opt => {
      const div = document.createElement('div');
      div.className = `dropdown-item ${String(opt.value) === String(this.value) ? 'active' : ''}`;
      div.dataset.value = opt.value;
      div.textContent = opt.label;
      this.optionsContainer.appendChild(div);
    });

    const hasCurrent = optionsArray.find(o => String(o.value) === String(this.value));
    if (!hasCurrent && optionsArray.length > 0) {
      this.setValue(optionsArray[0].value, optionsArray[0].label);
    } else if (hasCurrent) {
      this.setValue(hasCurrent.value, hasCurrent.label);
    }
  }
}

// Global click to close dropdowns
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
});

const formatDropdown = new CustomDropdown('format-dropdown', (val) => {
  if (val === 'mp3') {
    resolutionGroup.classList.add('hidden');
  } else {
    resolutionGroup.classList.remove('hidden');
  }
});
const resolutionDropdown = new CustomDropdown('resolution-dropdown');
const cookiesDropdown = new CustomDropdown('cookies-dropdown');
const speedLimit = document.getElementById('speed-limit');

const metadataToggle = document.getElementById('metadata-toggle');
const subtitlesToggle = document.getElementById('subtitles-toggle');
const playlistToggle = document.getElementById('playlist-toggle');
const sponsorblockToggle = document.getElementById('sponsorblock-toggle');
const chaptersToggle = document.getElementById('chapters-toggle');
const savePath = document.getElementById('save-path');
const browseBtn = document.getElementById('browse-btn');
const downloadBtn = document.getElementById('download-btn');
const cancelDownloadBtn = document.getElementById('cancel-download-btn');

const progressText = document.getElementById('progress-text');
const progressFill = document.getElementById('progress-fill');

let currentVideoUrl = '';
let selectedLocation = '';
let latestUpdateInfo = null;

// Helper: Extract YouTube video ID
function extractVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i);
  return match ? match[1] : null;
}

// Helper: Instant thumbnail preloading & caching
function preloadThumbnail(urlOrId) {
  if (!urlOrId) return;
  const videoId = (urlOrId.length === 11 && !urlOrId.includes('/')) ? urlOrId : extractVideoId(urlOrId);
  if (!videoId) return;

  const hqUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const maxUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

  // Set immediate high-quality thumbnail
  if (videoThumbnail.src !== hqUrl && videoThumbnail.src !== maxUrl) {
    videoThumbnail.src = hqUrl;
  }

  // Preload and upgrade to maxresdefault if available
  const img = new Image();
  img.onload = () => {
    // YouTube returns a 120x90 placeholder if maxresdefault doesn't exist
    if (img.naturalWidth > 120) {
      videoThumbnail.src = maxUrl;
    }
  };
  img.src = maxUrl;
}

// Clear input error and pre-fetch thumbnail on typing
urlInput.addEventListener('input', () => {
  urlInput.classList.remove('input-error');
  const id = extractVideoId(urlInput.value);
  if (id) {
    preloadThumbnail(id);
  }
});

urlInput.addEventListener('paste', (e) => {
  setTimeout(() => {
    const id = extractVideoId(urlInput.value);
    if (id) {
      preloadThumbnail(id);
    }
  }, 10);
});

// Allow pressing Enter in URL input to immediately trigger fetch
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    fetchBtn.click();
  }
});

// Helper: Build comprehensive quality options
function buildQualityOptions(formats) {
  const detectedHeights = new Set();

  if (Array.isArray(formats)) {
    formats.forEach(f => {
      if (typeof f.height === 'number' && f.height > 0) {
        detectedHeights.add(f.height);
      }
    });
  }

  // Standard resolution tiers
  const standardHeights = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144];

  let combinedHeights;
  if (detectedHeights.size > 0) {
    const maxHeight = Math.max(...detectedHeights);
    // Include all detected heights plus standard options up to 1080p (or detected max)
    const baseOptions = standardHeights.filter(h => h <= Math.max(maxHeight, 1080));
    combinedHeights = Array.from(new Set([...detectedHeights, ...baseOptions]));
  } else {
    // Fallback if no formats metadata is provided (e.g. flat playlist / embeds)
    combinedHeights = [2160, 1440, 1080, 720, 480, 360];
  }

  // Sort descending (highest resolution first)
  combinedHeights.sort((a, b) => b - a);

  return combinedHeights.map(h => {
    let label = h + 'p';
    if (h >= 4320) label = '8K (4320p)';
    else if (h >= 2160) label = '4K (2160p)';
    else if (h >= 1440) label = '1440p (2K)';
    else if (h === 1080) label = '1080p (Full HD)';
    else if (h === 720) label = '720p (HD)';
    return { value: h.toString(), label: label };
  });
}

// Fetch Video Info
fetchBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) {
    urlInput.classList.add('input-error');
    const oldPlaceholder = urlInput.placeholder;
    urlInput.placeholder = 'Please enter a valid URL!';
    setTimeout(() => {
      urlInput.classList.remove('input-error');
      urlInput.placeholder = oldPlaceholder;
    }, 2000);
    return;
  }

  // Instantly start preloading thumbnail for YouTube links
  const videoId = extractVideoId(url);
  if (videoId) {
    preloadThumbnail(videoId);
  }

  // Show loading
  loading.classList.remove('hidden');
  videoPanel.classList.add('hidden');
  progressPanel.classList.add('hidden');

  try {
    const info = await window.api.fetchInfo({
      url: url,
      cookies: cookiesDropdown.value
    });

    currentVideoUrl = url;

    // Update UI info
    if (info.thumbnail) {
      videoThumbnail.src = info.thumbnail;
    } else if (videoId) {
      preloadThumbnail(videoId);
    }
    videoTitle.textContent = info.title || 'Unknown Title';
    videoChannel.textContent = info.uploader || info.channel || 'Unknown Channel';

    // Parse and populate resolutions dynamically
    const options = buildQualityOptions(info.formats);
    resolutionDropdown.setOptions(options);

    // Default to 1080p if available, otherwise highest available
    const has1080 = options.find(o => o.value === '1080');
    if (has1080) {
      resolutionDropdown.setValue('1080', '1080p (Full HD)');
    } else if (options.length > 0) {
      resolutionDropdown.setValue(options[0].value, options[0].label);
    }

    // Check feature availabilities
    const hasSubtitles = (info.subtitles && Object.keys(info.subtitles).length > 0) || (info.automatic_captions && Object.keys(info.automatic_captions).length > 0);
    const hasChapters = (info.chapters && info.chapters.length > 0);
    const hasSponsors = (info.sponsorblock_chapters && info.sponsorblock_chapters.length > 0);

    const isPurePlaylist = url.includes('list=') && !url.includes('v=');
    const hasPlaylist = isPurePlaylist || info._type === 'playlist' || info.playlist_index != null || url.includes('list=');

    subtitlesToggle.disabled = !hasSubtitles;
    if (!hasSubtitles) subtitlesToggle.checked = false;

    chaptersToggle.disabled = !hasChapters;
    if (!hasChapters) chaptersToggle.checked = false;

    sponsorblockToggle.disabled = !hasSponsors;
    if (!hasSponsors) sponsorblockToggle.checked = false;

    playlistToggle.disabled = !hasPlaylist;
    if (isPurePlaylist) {
      playlistToggle.checked = true;
      playlistToggle.disabled = true; // force download playlist for pure playlist links
    } else if (!hasPlaylist) {
      playlistToggle.checked = false;
    }

    // Enable download button if location is already selected
    if (selectedLocation) {
      downloadBtn.disabled = false;
    }

    // Show panel
    loading.classList.add('hidden');
    videoPanel.classList.remove('hidden');
  } catch (error) {
    loading.classList.add('hidden');

    urlInput.classList.add('input-error');
    const oldPlaceholder = urlInput.placeholder;
    const errorMsg = error.message || 'Failed to fetch (Check URL or Cookies)';
    urlInput.value = '';
    urlInput.placeholder = errorMsg;
    showToast(errorMsg, 'error', 4000);

    setTimeout(() => {
      urlInput.classList.remove('input-error');
      urlInput.placeholder = oldPlaceholder;
    }, 4000);

    console.error('Fetch video error:', error);
  }
});

// Browse Location
browseBtn.addEventListener('click', async () => {
  const folderPath = await window.api.selectFolder();
  if (folderPath) {
    selectedLocation = folderPath;
    localStorage.setItem('yt_ripper_save_path', folderPath);
    savePath.textContent = folderPath;
    savePath.style.color = 'var(--text-main)';
    downloadBtn.disabled = false;
  }
});

// Download Video
downloadBtn.addEventListener('click', () => {
  if (!selectedLocation) {
    savePath.style.color = '#ff3b30';
    savePath.textContent = 'Save location is required!';
    setTimeout(() => {
      savePath.style.color = 'var(--text-muted)';
      savePath.textContent = 'Select save location...';
    }, 2000);
    return;
  }

  // Setup UI for download
  videoPanel.classList.add('hidden');
  progressPanel.classList.remove('hidden');
  progressText.textContent = 'Starting download...';
  progressFill.style.width = '0%';
  progressFill.style.backgroundColor = 'var(--accent)';
  cancelDownloadBtn.disabled = false;

  const options = {
    url: currentVideoUrl,
    location: selectedLocation,
    format: formatDropdown.value,
    resolution: resolutionDropdown.value,
    cookies: cookiesDropdown.value,
    speedLimit: speedLimit.value.trim(),
    metadata: metadataToggle.checked,
    subtitles: subtitlesToggle.checked,
    playlist: playlistToggle.checked,
    sponsorblock: sponsorblockToggle.checked,
    chapters: chaptersToggle.checked
  };

  // Remove old listeners
  window.api.removeListeners();

  // Setup listeners
  window.api.onDownloadProgress((data) => {
    const text = data.toString();

    if (text.includes('[download]') && text.includes('%')) {
      const match = text.match(/(\d+\.?\d*)%/);
      if (match && match[1]) {
        const percent = parseFloat(match[1]);
        progressFill.style.width = `${percent}%`;

        // Clean up the text for display (e.g. 45.2% of 85.00MiB at 12.4MiB/s ETA 00:04)
        let display = text.replace(/\[download\]/g, '').trim();
        progressText.textContent = display;
      }
    } else if (text.includes('[Merger]') || text.includes('[Merge]')) {
      progressText.textContent = 'Merging video & audio streams with FFmpeg...';
      progressFill.style.width = '100%';
    } else if (text.includes('[ExtractAudio]')) {
      progressText.textContent = 'Extracting MP3 audio stream...';
      progressFill.style.width = '100%';
    } else if (text.includes('[EmbedThumbnail]')) {
      progressText.textContent = 'Embedding thumbnail & metadata...';
    }
  });

  window.api.onDownloadCancelled(() => {
    progressText.textContent = 'Download cancelled.';
    progressFill.style.backgroundColor = '#ff9500';
    showToast('Download was cancelled', 'info');

    setTimeout(() => {
      progressPanel.classList.add('hidden');
      videoPanel.classList.remove('hidden');
      progressFill.style.backgroundColor = 'var(--accent)';
      progressFill.style.width = '0%';
    }, 1500);
  });

  window.api.onDownloadComplete((code) => {
    cancelDownloadBtn.disabled = true;
    if (code === 0) {
      progressText.textContent = 'Download Complete!';
      progressFill.style.backgroundColor = '#34c759'; // Green success
      showToast('Download finished successfully! 🎉', 'success');
    } else {
      progressText.textContent = 'Download Failed.';
      progressFill.style.backgroundColor = '#ff3b30'; // Red error
      showToast('Download failed. Check connection or format.', 'error');
    }

    setTimeout(() => {
      progressPanel.classList.add('hidden');
      videoPanel.classList.remove('hidden');
      progressFill.style.backgroundColor = 'var(--accent)';
      progressFill.style.width = '0%';
    }, 3000);
  });

  // Start download
  window.api.downloadVideo(options);
});

// Cancel Download Button
cancelDownloadBtn.addEventListener('click', () => {
  cancelDownloadBtn.disabled = true;
  progressText.textContent = 'Cancelling download...';
  window.api.cancelDownload();
});

// About Modal Elements
const infoBtn = document.getElementById('info-btn');
const aboutModal = document.getElementById('about-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const checkUpdatesBtn = document.getElementById('check-updates-btn');
const updateStatusMsg = document.getElementById('update-status-msg');
const aboutVersion = document.getElementById('about-version');
const appVersionBadge = document.getElementById('app-version-badge');

// Update Modal Elements
const updateModal = document.getElementById('update-modal');
const closeUpdateModalBtn = document.getElementById('close-update-modal-btn');
const updateBadge = document.getElementById('update-badge');
const modalCurrentVersion = document.getElementById('modal-current-version');
const modalLatestVersion = document.getElementById('modal-latest-version');
const releaseNotesContent = document.getElementById('release-notes-content');
const downloadUpdateBtn = document.getElementById('download-update-btn');
const viewReleaseBtn = document.getElementById('view-release-btn');

// Open/Close About Modal
infoBtn.addEventListener('click', () => {
  aboutModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
  aboutModal.classList.add('hidden');
});

aboutModal.addEventListener('click', (e) => {
  if (e.target === aboutModal) {
    aboutModal.classList.add('hidden');
  }
});

// Open/Close Update Modal
function openUpdateModal(info) {
  if (!info) return;
  modalCurrentVersion.textContent = `v${info.currentVersion}`;
  modalLatestVersion.textContent = `v${info.latestVersion}`;
  
  // Format release notes lightly
  const cleanNotes = info.releaseNotes
    ? info.releaseNotes.replace(/^#+\s/gm, '• ').trim()
    : 'New improvements and bug fixes.';
  releaseNotesContent.textContent = cleanNotes;

  updateModal.classList.remove('hidden');
}

closeUpdateModalBtn.addEventListener('click', () => {
  updateModal.classList.add('hidden');
});

updateModal.addEventListener('click', (e) => {
  if (e.target === updateModal) {
    updateModal.classList.add('hidden');
  }
});

updateBadge.addEventListener('click', () => {
  if (latestUpdateInfo) {
    openUpdateModal(latestUpdateInfo);
  }
});

downloadUpdateBtn.addEventListener('click', () => {
  if (latestUpdateInfo && latestUpdateInfo.downloadUrl) {
    window.api.openExternal(latestUpdateInfo.downloadUrl);
  }
});

viewReleaseBtn.addEventListener('click', () => {
  if (latestUpdateInfo && latestUpdateInfo.htmlUrl) {
    window.api.openExternal(latestUpdateInfo.htmlUrl);
  }
});

// Check for updates logic
async function checkUpdates(manual = false) {
  if (manual) {
    checkUpdatesBtn.disabled = true;
    checkUpdatesBtn.textContent = 'Checking...';
    updateStatusMsg.className = 'update-status-msg info';
    updateStatusMsg.textContent = 'Checking GitHub releases for latest version...';
    updateStatusMsg.classList.remove('hidden');
  }

  try {
    const result = await window.api.checkForUpdates();

    if (result.error) {
      if (manual) {
        updateStatusMsg.className = 'update-status-msg error';
        updateStatusMsg.textContent = `Update check failed: ${result.error}`;
      }
      return;
    }

    if (result.updateAvailable) {
      latestUpdateInfo = result;
      updateBadge.classList.remove('hidden');

      if (manual) {
        updateStatusMsg.className = 'update-status-msg success';
        updateStatusMsg.textContent = `A new version (v${result.latestVersion}) is available!`;
        openUpdateModal(result);
      } else {
        showToast(`Update available: v${result.latestVersion}`, 'info', 5000);
      }
    } else {
      updateBadge.classList.add('hidden');
      if (manual) {
        updateStatusMsg.className = 'update-status-msg success';
        updateStatusMsg.textContent = `You're on the latest version (v${result.currentVersion}) ✨`;
      }
    }
  } catch (err) {
    console.error('Update check error:', err);
    if (manual) {
      updateStatusMsg.className = 'update-status-msg error';
      updateStatusMsg.textContent = 'Could not reach update server. Check your connection.';
    }
  } finally {
    if (manual) {
      checkUpdatesBtn.disabled = false;
      checkUpdatesBtn.textContent = 'Check for Updates';
    }
  }
}

checkUpdatesBtn.addEventListener('click', () => checkUpdates(true));

// Global Escape Key to close open modals and dropdowns
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    aboutModal.classList.add('hidden');
    updateModal.classList.add('hidden');
    document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
  }
});

// External Links
document.querySelectorAll('.external-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    window.api.openExternal(link.href);
  });
});

// Initial App Startup
async function initApp() {
  try {
    const ver = await window.api.getAppVersion();
    if (ver) {
      if (aboutVersion) aboutVersion.textContent = ver;
      if (appVersionBadge) appVersionBadge.textContent = `v${ver}`;
    }
  } catch (e) {
    console.error('Failed to get app version:', e);
  }

  // Restore saved save path from localStorage if available
  const savedPath = localStorage.getItem('yt_ripper_save_path');
  if (savedPath) {
    selectedLocation = savedPath;
    savePath.textContent = savedPath;
    savePath.style.color = 'var(--text-main)';
  }

  // Non-blocking auto update check 2.5 seconds after launch
  setTimeout(() => {
    checkUpdates(false);
  }, 2500);
}

initApp();
