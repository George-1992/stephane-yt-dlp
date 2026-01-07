const { nodewhisper } = require('nodejs-whisper');
const fs = require('fs');
const path = require('path');

/**
 * Transcribe audio file using local Whisper model
 * @param {string} filePath - Path to audio file
 * @param {Object} options - Transcription options
 * @returns {Promise<Object>} - Transcription result
 */
const transcribeAudio = async (filePath, options = {}) => {
    let resObj = {
        success: false,
        message: '',
        data: null
    }

    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            resObj.message = 'Audio file not found';
            return resObj;
        }

        // Use nodejs-whisper which works on Windows
        const transcript = await nodewhisper(filePath, {
            modelName: options.modelName || "small", // tiny, base, small, medium, large
            autoDownloadModelName: options.modelName || "small",
            whisperOptions: {
                outputInText: true,
                outputInVtt: false,
                outputInSrt: false,
                outputInCsv: false,
                translateToEnglish: options.translate || false,
                wordTimestamps: options.wordTimestamps || false,
                timestamps_length: options.timestamps_length || 20,
                splitOnWord: options.splitOnWord || true,
            }
        });

        resObj.success = true;
        resObj.message = 'Transcription successful';
        resObj.data = transcript;
        return resObj;

    } catch (error) {
        console.error('Error in transcribeAudio: ', error);
        resObj.success = false;
        resObj.message = error.message || 'Transcription failed';
        resObj.error = error;
        return resObj;
    }
};

module.exports = transcribeAudio;