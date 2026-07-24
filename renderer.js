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
const resolutionSelect = document.getElementById('resolution-select');
const resolutionGroup = document.getElementById('resolution-group');
const formatSelect = document.getElementById('format-select');
const cookiesSelect = document.getElementById('cookies-select');
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

// Toggle resolution based on format
formatSelect.addEventListener('change', () => {
  if (formatSelect.value === 'mp3') {
    resolutionGroup.classList.add('hidden');
  } else {
    resolutionGroup.classList.remove('hidden');
  }
});

// Fetch Video Info
fetchBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) {
    alert('Please enter a valid YouTube URL');
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
      
      resolutionSelect.innerHTML = ''; // clear
      let found1080 = false;
      
      sortedHeights.forEach(h => {
        let label = h + 'p';
        if (h >= 4320) label = '8K (' + h + 'p)';
        else if (h >= 2160) label = '4K (' + h + 'p)';
        else if (h >= 1440) label = '1440p';
        
        const option = document.createElement('option');
        option.value = h.toString();
        option.textContent = label;
        if (h === 1080) {
          option.selected = true;
          found1080 = true;
        }
        resolutionSelect.appendChild(option);
      });
      
      if (!found1080 && sortedHeights.length > 0) {
        resolutionSelect.selectedIndex = 0;
      }
    } else {
      // Fallback for pure playlists where --flat-playlist omits formats
      const defaultHeights = [4320, 2160, 1440, 1080, 720, 480];
      defaultHeights.forEach(h => {
        let label = h + 'p';
        if (h >= 4320) label = '8K (' + h + 'p)';
        else if (h >= 2160) label = '4K (' + h + 'p)';
        else if (h >= 1440) label = '1440p';
        
        const option = document.createElement('option');
        option.value = h.toString();
        option.textContent = label;
        if (h === 1080) option.selected = true;
        resolutionSelect.appendChild(option);
      });
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
    alert('Failed to fetch video. Please check the URL.');
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
    alert('Please select a save location.');
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
    format: formatSelect.value,
    resolution: resolutionSelect.value,
    cookies: cookiesSelect.value,
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
