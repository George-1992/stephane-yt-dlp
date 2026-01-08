const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { pipeline } = require('stream');
const pipelineAsync = promisify(pipeline);
const youtubedl = require('youtube-dl-exec');
// const youtubedl = () => { return null }
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

    try {
        const videoId = ytdl.getVideoID(youtubeUrl);
        console.log('Fetching transcript for videoId:', videoId);

        const lang = options.lang || 'en';

        // Use youtube-caption-extractor - it works without cookies
        console.log(`Fetching captions with youtube-caption-extractor (lang: ${lang})...`);
        
        const captions = await getSubtitles({ videoID: videoId, lang: lang });

        if (!captions || captions.length === 0) {
            resObj.message = `No ${lang} captions found. Video may not have captions or language '${lang}' may not be available.`;
            return resObj;
        }

        console.log(`Successfully fetched ${captions.length} caption segments`);

        const fullText = captions.map(cap => cap.text).join(' ');

        resObj.success = true;
        resObj.message = 'Transcript fetched successfully';
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

    } catch (error) {
        console.error('Transcription error:', error);
        resObj.success = false;
        resObj.message = error.message || 'Failed to fetch captions. Video may not have captions enabled.';
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
