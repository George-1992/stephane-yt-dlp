# phyton

install phyton in docker
sudo apt-get update
apt-get install -y python3 python3-pip
python3 --version
add YOUTUBE_DL_SKIP_PYTHON_CHECK=1 to .env

# YouTube Transcription Service Setup

This service uses **yt-dlp** to download YouTube videos and **nodejs-whisper** for free local transcription.

## Prerequisites

### 1. Install FFmpeg (Required for audio conversion)

#### Option A: Using winget (recommended for Windows 11/10)

```powershell
winget install ffmpeg
```

#### Option B: Manual install

1. Download from https://ffmpeg.org/download.html
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to your system PATH

#### Verify installation:

```powershell
ffmpeg -version
```

### 2. Install Node.js dependencies

```bash
npm install
```

## Usage

### API Endpoints

#### 1. Get Video Info (No download)

```bash
POST /api/v1/youtube/info
Body: { "url": "https://youtube.com/watch?v=..." }
```

#### 2. Transcribe YouTube Video

```bash
POST /api/v1/transcribe/youtube
Body: { "url": "https://youtube.com/watch?v=..." }
```

#### 3. Cleanup Audio File

```bash
DELETE /api/v1/transcribe/cleanup
Body: { "audioPath": "/path/to/audio.mp4" }
```

## How It Works

1. **Download**: Uses `yt-dlp` to download best quality audio from YouTube
2. **Transcribe**: Uses `nodejs-whisper` (free, local) to transcribe audio
3. **Cleanup**: Removes temporary files after processing

## Whisper Models

Available models (auto-downloaded on first use):

- `tiny` - Fastest, least accurate
- `base` - Default, good balance
- `small` - Better accuracy
- `medium` - High accuracy (slower)
- `large` - Best accuracy (very slow)

Configure in transcription options:

```javascript
{
    modelName: "base.en", // or "small", "medium", etc.
    language: "en",
    wordTimestamps: true
}
```

## Troubleshooting

### "ffmpeg not found" error

- Make sure ffmpeg is installed and in your PATH
- Restart your terminal/IDE after installation
- Test with: `ffmpeg -version`

### Whisper model download issues

- First run will download the model (can take time)
- Models are cached in `~/.cache/whisper`
- Ensure stable internet connection

### Out of memory errors

- Use smaller whisper models (`tiny` or `base`)
- Process shorter videos
- Increase Node.js memory: `node --max-old-space-size=4096 server.js`

## Notes

- Audio files are saved to `./temp/` directory
- Remember to cleanup files after transcription
- Whisper runs locally - completely free!
- No API keys needed for basic functionality
