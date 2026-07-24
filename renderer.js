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
  if (val === 'mp3') resolutionGroup.classList.add('hidden');
  else resolutionGroup.classList.remove('hidden');
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

const progressText = document.getElementById('progress-text');
const progressFill = document.getElementById('progress-fill');

let currentVideoUrl = '';
let selectedLocation = '';

// Remove old event listener since CustomDropdown handles it

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

  // Show loading
  loading.classList.remove('hidden');
  videoPanel.classList.add('hidden');
  progressPanel.classList.add('hidden');

  try {
    const info = await window.api.fetchInfo(url);

    currentVideoUrl = url;

    // Update UI
    videoThumbnail.src = info.thumbnail || '';
    videoTitle.textContent = info.title || 'Unknown Title';
    videoChannel.textContent = info.uploader || 'Unknown Channel';

    // Parse resolutions dynamically
    if (info.formats && Array.isArray(info.formats)) {
      const heights = new Set();
      info.formats.forEach(f => {
        if (f.height && f.vcodec !== 'none') {
          heights.add(f.height);
        }
      });
      const sortedHeights = Array.from(heights).sort((a, b) => b - a); // descending

      const options = [];
      let found1080 = false;

      sortedHeights.forEach(h => {
        let label = h + 'p';
        if (h >= 4320) label = '8K (' + h + 'p)';
        else if (h >= 2160) label = '4K (' + h + 'p)';
        else if (h >= 1440) label = '1440p';

        options.push({ value: h.toString(), label: label });
        if (h === 1080) found1080 = true;
      });

      resolutionDropdown.setOptions(options);
      if (found1080) resolutionDropdown.setValue('1080', '1080p');

    } else {
      // Fallback for pure playlists where --flat-playlist omits formats
      const defaultHeights = [4320, 2160, 1440, 1080, 720, 480];
      const options = [];
      defaultHeights.forEach(h => {
        let label = h + 'p';
        if (h >= 4320) label = '8K (' + h + 'p)';
        else if (h >= 2160) label = '4K (' + h + 'p)';
        else if (h >= 1440) label = '1440p';

        options.push({ value: h.toString(), label: label });
      });
      resolutionDropdown.setOptions(options);
      resolutionDropdown.setValue('1080', '1080p');
    }

    // Check availabilities
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
      playlistToggle.disabled = true; // force download playlist since it's a pure playlist
    } else if (!hasPlaylist) {
      playlistToggle.checked = false;
    }

    // Show panel
    loading.classList.add('hidden');
    videoPanel.classList.remove('hidden');
  } catch (error) {
    loading.classList.add('hidden');

    urlInput.classList.add('input-error');
    const oldPlaceholder = urlInput.placeholder;
    urlInput.value = '';
    urlInput.placeholder = 'Failed to fetch (Check URL or Cookies)';
    setTimeout(() => {
      urlInput.classList.remove('input-error');
      urlInput.placeholder = oldPlaceholder;
    }, 3000);

    console.error(error);
  }
});

// Browse Location
browseBtn.addEventListener('click', async () => {
  const folderPath = await window.api.selectFolder();
  if (folderPath) {
    selectedLocation = folderPath;
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
    // Basic yt-dlp parsing: [download]  15.2% of 50.00MiB at 5.00MiB/s ETA 00:05
    const text = data.toString();
    console.log(text);

    if (text.includes('[download]') && text.includes('%')) {
      const match = text.match(/(\d+\.\d+)%/);
      if (match && match[1]) {
        const percent = match[1];
        progressFill.style.width = `${percent}%`;

        // Clean up the text for display
        let display = text.replace('[download]', '').trim();
        progressText.textContent = display;
      }
    } else if (text.includes('[Merge]')) {
      progressText.textContent = 'Merging video and audio...';
      progressFill.style.width = '100%';
    }
  });

  window.api.onDownloadComplete((code) => {
    if (code === 0) {
      progressText.textContent = 'Download Complete!';
      progressFill.style.backgroundColor = '#34c759'; // Green success
    } else {
      progressText.textContent = 'Download Failed.';
      progressFill.style.backgroundColor = '#ff3b30'; // Red error
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

// About Modal Logic
const infoBtn = document.getElementById('info-btn');
const aboutModal = document.getElementById('about-modal');
const closeModalBtn = document.getElementById('close-modal-btn');

infoBtn.addEventListener('click', () => {
  aboutModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
  aboutModal.classList.add('hidden');
});

// Close modal when clicking outside of the content
aboutModal.addEventListener('click', (e) => {
  if (e.target === aboutModal) {
    aboutModal.classList.add('hidden');
  }
});

// External Links
document.querySelectorAll('.external-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    window.api.openExternal(link.href);
  });
});
