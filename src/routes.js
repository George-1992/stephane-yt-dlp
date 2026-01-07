const express = require('express')
const multer = require('multer')
const handleFile = require('@/services/file/process')
const { transcribeYouTube, getVideoInfo, cleanupAudioFile, transcribeYouTube2 } = require('@/services/transcribe')
const transcribeAudio = require('@/services/whisper')
const router = express.Router()

const THIS_DIR = __dirname;
const APP_DIR = process.cwd();

// Configure multer for file uploads
const storage = multer.memoryStorage() // Store files in memory as Buffer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only PDF files
        if (file.mimetype === 'application/pdf') {
            cb(null, true)
        } else {
            cb(new Error('Only PDF files are allowed!'), false)
        }
    }
})

// prefix is /api/v1
router.get('/test', (req, res) => {
    res.json({ message: 'API is working!' })
})

router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: Date.now() })
})


// file requests - use multer middleware to handle single file upload
router.post('/file', upload.single('file'), (req, res) => {
    try {
        const resObj = handleFile(req)
        res.json(resObj)
    } catch (error) {
        res.status(400).json({
            success: false,
            warning: false,
            message: error.message || 'File upload failed',
            data: null
        })
    }
})

// plain text response
router.get('/plaintext', (req, res) => {
    res.set('Content-Type', 'text/plain')
    res.send('Hello, this is a plain text response from the API.')
})

// js response
router.get('/javascript', (req, res) => {
    res.set('Content-Type', 'application/javascript')
    res.send(`console.log('Hello from the API!')`)
})

// html response
router.get('/html', (req, res) => {
    res.set('Content-Type', 'text/html')
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>API Welcome</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #333; }
                p { color: #666; }
                .api-link { color: #007bff; text-decoration: none; }
            </style>
        </head>
        <body>
            <h1>Welcome to the API</h1>
            <p>Use <a href="/api/v1/test" class="api-link">/api/v1/test</a> to test the API.</p>
            <p>Check API health at <a href="/api/v1/health" class="api-link">/api/v1/health</a></p>
        </body>
        </html>
    `)
})

// YouTube transcription routes
router.post('/transcribe/youtube', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'YouTube URL is required',
                data: null
            });
        }

        const result = await transcribeYouTube2(url);
        res.json(result);

        // const result = await transcribeYouTube(url);

        // if (result.success) {
        //     res.json(result);
        // } else {
        //     res.status(400).json(result);
        // }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Transcription failed',
            data: null
        });
    }
});

// YouTube transcription routes
router.post('/transcribe', async (req, res) => {
    let resObj = {
        success: false,
        message: '',
        data: null
    }
    try {
        const { url } = req.body;

        console.log('APP_DIR: ', APP_DIR);

        const result = await transcribeAudio(filePath = `${APP_DIR}/temp/p9hmq7msrMg.mp4`, {});
        resObj = result;

        return res.json(resObj);

    } catch (error) {
        resObj.success = false;
        resObj.message = error.message || 'Transcription failed';
        resObj.data = null;
        res.status(500).json(resObj);
    }
});



// Get YouTube video info without downloading
router.post('/youtube/info', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'YouTube URL is required',
                data: null
            });
        }

        const result = await getVideoInfo(url);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get video info',
            data: null
        });
    }
});

// Clean up audio file
router.delete('/transcribe/cleanup', async (req, res) => {
    try {
        const { audioPath } = req.body;

        if (!audioPath) {
            return res.status(400).json({
                success: false,
                message: 'Audio path is required',
                data: null
            });
        }

        const result = await cleanupAudioFile(audioPath);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Cleanup failed',
            data: null
        });
    }
});


module.exports = router
