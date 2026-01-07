const handleFile = (req) => {
    let resObj = {
        success: false,
        warning: false,
        message: '',
        data: null,
    }
    try {
        // Check if file parameter exists
        if (!req || !req.file) {
            resObj.warning = true
            resObj.message = 'No file parameter provided. Make sure to send file with key "file".'
            return resObj
        }

        const file = req.file
        console.log('File received:', {
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size + ' bytes',
            buffer: file.buffer ? 'Buffer received' : 'No buffer'
        })

        // Process the PDF file here
        // file.buffer contains the file data
        // file.originalname contains the original filename
        // file.mimetype contains the MIME type

        resObj.success = true
        resObj.message = 'File uploaded and processed successfully!'
        resObj.data = {
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            // Add your PDF processing results here
        }

        return resObj;
    } catch (error) {
        console.error(error);
        resObj.message = error.message || 'An error occurred while processing the file request.';
        return resObj
    }
}

module.exports = handleFile