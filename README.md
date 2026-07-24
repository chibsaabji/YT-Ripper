# YT Ripper | YouTube Video Downloader

**YT Ripper** is a premium, beautifully designed desktop application for downloading YouTube videos in stunning quality. Built with Electron, it provides a sleek, modern, and user-friendly graphical interface powered by the robust backend capabilities of `yt-dlp` and `FFmpeg`.

## Features
- **High-Quality Downloads:** Choose between MP4 and WebM video formats up to 4K/8K resolutions, or extract Audio only (MP3).
- **Members-Only & Age-Restricted:** Built-in support for passing browser cookies, allowing you to seamlessly download restricted or members-only videos directly from your active browser session.
- **Playlist Support:** Automatically detects playlists and lets you download the entire series in one click.
- **SponsorBlock Integration:** Optionally remove sponsored segments automatically from downloaded videos.
- **Rich Metadata:** Embed video thumbnails, metadata, subtitles, and split chapters directly into the media file.
- **Premium UI:** Features an Apple-inspired frosted glass aesthetic, custom-built animated dropdowns, dynamic status updates, and a responsive layout.

## Prerequisites
Before running YT Ripper, ensure you have the core extraction engines in the root folder:
1. **yt-dlp**: Download the latest release from the [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp/releases) and place `yt-dlp.exe` in the root directory.
2. **FFmpeg**: Download from [FFmpeg Builds](https://github.com/BtbN/FFmpeg-Builds/releases) and place the `ffmpeg` folder (containing `bin/ffmpeg.exe`) in the root directory.
3. **Node.js**: Required to install dependencies, run the Electron app, and act as the JavaScript runtime for `yt-dlp`.

## How to Use
1. Clone the repository:
   ```bash
   git clone https://github.com/chibsaabji/YT-Ripper.git
   cd YT-Ripper
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. **Paste your YouTube link**, hit **Fetch Video**, select your desired format and features, choose a save location, and hit **Download!**

## Credits
YT Ripper is made possible by these amazing open-source projects:
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** - The core video extraction engine
- **[FFmpeg](https://ffmpeg.org/)** - Media processing and stream merging

Built with ❤️ by [chibsaabji](https://github.com/chibsaabji).
