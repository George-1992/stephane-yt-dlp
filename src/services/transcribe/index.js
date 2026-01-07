const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { pipeline } = require('stream');
const pipelineAsync = promisify(pipeline);
const youtubedl = require('youtube-dl-exec');
const transcribeAudio = require('@/services/whisper');
const {
    getSubtitles,
    getVideoDetails,
    Subtitle
} = require('youtube-caption-extractor');
const { YoutubeTranscript } = require('youtube-transcript');

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);

// Configure ytdl-core to store cache files in temp directory instead of root
const tempDir = path.join(process.cwd(), 'temp');
const ytdlAgent = ytdl.createAgent(undefined, {
    localAddress: undefined,
    // This will prevent player script files from being created
});

// Set cache directory for ytdl if temp exists
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Downloads audio from YouTube video and prepares it for transcription
 * @param {string} youtubeUrl - YouTube video URL
 * @returns {Promise<Object>} - Returns object with success status, audio file path, and video info
 */
async function downloadYouTubeAudio(youtubeUrl) {
    let resObj = {
        success: false,
        message: '',
        data: null
    }
    try {
        // Validate YouTube URL
        if (!ytdl.validateURL(youtubeUrl)) {
            resObj.message = 'Invalid YouTube URL';
            return resObj;
        }

        // Create temp directory if it doesn't exist
        const tempDir = path.join(process.cwd(), 'temp');
        try {
            await mkdir(tempDir, { recursive: true });
        } catch (err) {
            if (err.code !== 'EEXIST') {
                resObj.message = 'Failed to create temp directory';
                return resObj;
            }
        }

        // Get video info (disable player script caching)
        const info = await ytdl.getInfo(youtubeUrl, { agent: ytdlAgent });
        const videoTitle = info.videoDetails.title.replace(/[^\w\s-]/g, '').substring(0, 50);
        const videoId = info.videoDetails.videoId;
        // console.log(' >>>> aaaaa >>>>  videoTitle: ', videoTitle);


        // Define file paths
        const audioPath = path.join(tempDir, `${videoId}.mp3`);
        const videoPath = path.join(tempDir, `${videoId}.mp4`);



        const saveVideoStream = async ({ savePath, youtubeUrl }) => {
            try {
                // Download best audio without post-processing (no ffmpeg needed)
                await youtubedl(youtubeUrl, {
                    output: savePath,
                    format: 'bestaudio[ext=m4a]/bestaudio/best',
                    // Remove extractAudio and audioFormat to avoid ffmpeg requirement
                    noCheckCertificates: true,
                    noWarnings: true,
                    preferFreeFormats: true,
                    addHeader: [
                        'referer:youtube.com',
                        'user-agent:googlebot'
                    ]
                });

                console.log('>>>> Download completed successfully! >>>>');
                return fs.existsSync(savePath)
                    ? savePath
                    : null;
            } catch (error) {
                console.log('ERROR: ', error);
                if (error.message && error.message.includes('ffmpeg')) {
                    throw new Error('ffmpeg is required. Install: winget install ffmpeg (or download from ffmpeg.org)');
                }
                throw error;
            }
        };

        const result = await saveVideoStream({
            youtubeUrl,
            savePath: videoPath,
        });
        if (!result) {
            resObj.message = 'Failed to download video audio';
            return resObj;
        }

        resObj.success = true;
        resObj.message = 'Audio downloaded successfully';
        resObj.filePath = result;
        resObj.data = {
            title: videoTitle,
            videoId: videoId,
            audioPath: result
        };

        return resObj
    } catch (error) {
        console.error('Error in downloadYouTubeAudio: ', error);
        resObj.success = false;
        resObj.message = error.message;
        return resObj;
    }
}

/**
 * Transcribe YouTube video - currently returns audio file info
 * TODO: Integrate with actual transcription service (e.g., OpenAI Whisper, Google Speech-to-Text)
 * @param {string} youtubeUrl - YouTube video URL
 * @param {Object} options - Transcription options
 * @returns {Promise<Object>} - Transcription result
 */
async function transcribeYouTube(youtubeUrl, options = {}) {
    let resObj = {
        success: false,
        message: '',
        data: null
    }
    try {
        const dRes = await downloadYouTubeAudio(youtubeUrl);
        if (!dRes.success) {
            resObj = dRes;
            return resObj;
        }

        const result = await transcribeAudio(dRes.filePath, options);
        resObj = result;
        return resObj;

    } catch (error) {
        return {
            success: false,
            message: error.message,
            data: null
        };
    }
}

const transcribeYouTube2 = async (youtubeUrl, options = {}) => {
    let resObj = {
        success: false,
        message: '',
        data: null
    }

    const tempDir = path.join(process.cwd(), 'temp');
    let subtitlePath = null;

    try {
        // Create temp directory if it doesn't exist
        await mkdir(tempDir, { recursive: true });

        const videoId = ytdl.getVideoID(youtubeUrl);
        console.log('Attempting to fetch transcript for videoId:', videoId);

        const lang = options.lang || 'en';

        // First, try youtube-caption-extractor (uses different API, might bypass rate limits)
        try {
            console.log(`Trying youtube-caption-extractor for language: ${lang}...`);
            const captions = await getSubtitles({ videoID: videoId, lang: lang });

            if (captions && captions.length > 0) {
                console.log(`Caption extractor success: ${captions.length} segments`);

                const fullText = captions.map(cap => cap.text).join(' ');

                resObj.success = true;
                resObj.message = 'Transcript fetched successfully via caption extractor';
                resObj.data = {
                    transcript: captions.map(cap => ({
                        text: cap.text,
                        start: cap.start,
                        startSeconds: parseFloat(cap.start),
                        duration: parseFloat(cap.dur),
                        endSeconds: parseFloat(cap.start) + parseFloat(cap.dur)
                    })),
                    fullText: fullText,
                    segmentCount: captions.length,
                    language: lang
                };

                return resObj;
            }
        } catch (captionError) {
            console.log(`Caption extractor failed: ${captionError.message}`);
            console.log('Falling back to yt-dlp...');
        }

        // Fallback to yt-dlp with retry logic and rate limit handling
        subtitlePath = path.join(tempDir, `${videoId}.${lang}.vtt`);

        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    const delay = attempt * 2000; // 2s, 4s, 6s delays
                    console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                console.log(`Downloading subtitles with yt-dlp (attempt ${attempt})...`);

                await youtubedl(youtubeUrl, {
                    skipDownload: true,
                    writeAutoSub: true,
                    writeSub: true,
                    subLang: lang,
                    subFormat: 'vtt',
                    output: path.join(tempDir, `${videoId}.%(ext)s`),
                    noWarnings: true,
                    // Add headers to potentially avoid rate limiting
                    addHeader: [
                        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    ],
                    sleepSubtitles: 1, // Sleep between subtitle downloads
                });

                // Check which subtitle file was created
                const possibleFiles = [
                    path.join(tempDir, `${videoId}.${lang}.vtt`),
                    path.join(tempDir, `${videoId}.vtt`),
                ];

                let actualSubPath = null;
                for (const file of possibleFiles) {
                    if (fs.existsSync(file)) {
                        actualSubPath = file;
                        break;
                    }
                }

                if (!actualSubPath) {
                    throw new Error('Subtitle file not found after download');
                }

                console.log('Subtitle file downloaded:', actualSubPath);

                // Read and parse the VTT file
                const vttContent = fs.readFileSync(actualSubPath, 'utf8');
                const transcriptSegments = parseVTT(vttContent);

                // Clean up subtitle file
                try {
                    fs.unlinkSync(actualSubPath);
                } catch (e) {
                    // Ignore cleanup errors
                }

                if (!transcriptSegments || transcriptSegments.length === 0) {
                    throw new Error('Subtitles downloaded but parsing failed');
                }

                console.log(`Transcript parsed: ${transcriptSegments.length} segments`);

                const fullText = transcriptSegments.map(seg => seg.text).join(' ');

                resObj.success = true;
                resObj.message = 'Transcript fetched successfully via yt-dlp';
                resObj.data = {
                    transcript: transcriptSegments,
                    fullText: fullText,
                    segmentCount: transcriptSegments.length,
                    language: lang
                };

                return resObj;

            } catch (ytdlpError) {
                lastError = ytdlpError;
                console.error(`yt-dlp attempt ${attempt} failed:`, ytdlpError.message);

                // If it's a 429 error and we have retries left, continue
                if (ytdlpError.message.includes('429') && attempt < maxRetries) {
                    continue;
                }

                // For other errors or last attempt, break
                if (attempt === maxRetries) {
                    break;
                }
            }
        }

        // If we got here, all methods failed
        throw new Error(lastError?.message || 'All subtitle extraction methods failed');

    } catch (error) {
        console.error('Transcription error:', error);
        resObj.success = false;
        resObj.message = error.message || 'Transcription failed - video may not have captions/transcripts available';
        return resObj;
    }
}

/**
 * Parse VTT subtitle format
 * @param {string} vttContent - VTT file content
 * @returns {Array} - Array of subtitle segments with text and timestamps
 */
function parseVTT(vttContent) {
    const lines = vttContent.split('\n');
    const segments = [];
    let currentSegment = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip header and empty lines
        if (line === '' || line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('Kind:') || line.startsWith('Language:')) {
            continue;
        }

        // Timestamp line (e.g., "00:00:00.000 --> 00:00:02.000")
        if (line.includes('-->')) {
            const [start, end] = line.split('-->').map(t => t.trim());
            currentSegment = {
                start: start,
                end: end,
                startSeconds: vttTimeToSeconds(start),
                endSeconds: vttTimeToSeconds(end),
                text: ''
            };
        } else if (currentSegment && line !== '' && !/^\d+$/.test(line)) {
            // Text line (skip numbers, they're cue identifiers)
            currentSegment.text += (currentSegment.text ? ' ' : '') + line;

            // Check if next line is empty or a timestamp (end of segment)
            if (i + 1 >= lines.length || lines[i + 1].trim() === '' || lines[i + 1].includes('-->')) {
                segments.push(currentSegment);
                currentSegment = null;
            }
        }
    }

    return segments;
}

/**
 * Convert VTT timestamp to seconds
 * @param {string} vttTime - VTT timestamp (e.g., "00:00:12.340")
 * @returns {number} - Time in seconds
 */
function vttTimeToSeconds(vttTime) {
    const parts = vttTime.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
}


/**
 * Clean up temporary audio file
 * @param {string} audioPath - Path to audio file
 */
async function cleanupAudioFile(audioPath) {
    try {
        if (fs.existsSync(audioPath)) {
            await unlink(audioPath);
            return { success: true, message: 'Audio file cleaned up' };
        }
        return { success: false, message: 'File not found' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Get YouTube video information without downloading
 * @param {string} youtubeUrl - YouTube video URL
 * @returns {Promise<Object>} - Video information
 */
async function getVideoInfo(youtubeUrl) {
    try {
        if (!ytdl.validateURL(youtubeUrl)) {
            throw new Error('Invalid YouTube URL');
        }

        const info = await ytdl.getInfo(youtubeUrl, { agent: ytdlAgent });

        return {
            success: true,
            data: {
                title: info.videoDetails.title,
                author: info.videoDetails.author.name,
                duration: info.videoDetails.lengthSeconds,
                durationFormatted: new Date(info.videoDetails.lengthSeconds * 1000).toISOString().substr(11, 8),
                videoId: info.videoDetails.videoId,
                url: youtubeUrl,
                thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
                description: info.videoDetails.description.substring(0, 200) + '...'
            }
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            data: null
        };
    }
}

module.exports = {
    transcribeYouTube,
    transcribeYouTube2,
    downloadYouTubeAudio,
    cleanupAudioFile,
    getVideoInfo
};
