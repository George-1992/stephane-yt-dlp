// pdfjs.js
const fs = require("fs");
const pdfjsLib = require("pdfjs-dist/build/pdf.js");

/**
 * Create a new PDF from positioning data
 * @param {object} positioningData - Data from extractTextWithPositions
 * @param {string} outputPath - Path where to save the new PDF
 * @returns {Promise<boolean>} - Success status
 */
async function createPDFFromPositions(positioningData, outputPath) {
    try {
        // Import PDFLib for PDF creation
        const PDFLib = await import('pdf-lib');
        const { PDFDocument, rgb, StandardFonts } = PDFLib;

        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();

        // Process each page
        for (const pageData of positioningData.pages) {
            // Add a new page with original dimensions
            const page = pdfDoc.addPage([pageData.width, pageData.height]);

            // Get a font
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

            // Add each text item with its original position
            pageData.items.forEach(item => {
                // PDFLib uses bottom-left origin, so we need to flip Y coordinate back
                const yPos = pageData.height - item.y - item.height;

                page.drawText(item.text, {
                    x: item.x,
                    y: yPos,
                    size: item.fontSize || 12,
                    font: font,
                    color: rgb(0, 0, 0)
                });
            });
        }

        // Save the PDF
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);

        console.log(`New PDF created: ${outputPath}`);
        return true;

    } catch (error) {
        console.error('Error creating PDF from positions:', error);

        // If pdf-lib is not installed, show installation instructions
        if (error.message.includes('Cannot resolve module')) {
            console.log('\nTo create PDFs, install pdf-lib:');
            console.log('npm install pdf-lib');
        }

        return false;
    }
}

/**
 * Create a simplified PDF with just the text content (no exact positioning)
 * @param {object} positioningData - Data from extractTextWithPositions  
 * @param {string} outputPath - Path where to save the new PDF
 * @returns {Promise<boolean>} - Success status
 */
async function createSimplePDFFromText(positioningData, outputPath) {
    try {
        const PDFLib = await import('pdf-lib');
        const { PDFDocument, rgb, StandardFonts } = PDFLib;

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        for (const pageData of positioningData.pages) {
            const page = pdfDoc.addPage();
            const { width, height } = page.getSize();

            // Split text into lines and add with basic formatting
            const lines = pageData.text.split('\n');
            let yPosition = height - 50; // Start from top with margin

            lines.forEach(line => {
                if (yPosition > 50) { // Leave bottom margin
                    page.drawText(line, {
                        x: 50,
                        y: yPosition,
                        size: 12,
                        font: font,
                        color: rgb(0, 0, 0)
                    });
                    yPosition -= 15; // Line spacing
                }
            });
        }

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);

        console.log(`Simple PDF created: ${outputPath}`);
        return true;

    } catch (error) {
        console.error('Error creating simple PDF:', error);
        return false;
    }
}

async function extractTextFromPDF(filePath) {
    const data = new Uint8Array(fs.readFileSync(filePath));

    try {
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        let text = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((item) => item.str).join(" ");
            text += "\n";
        }

        return text;
    } catch (err) {
        console.error("Error extracting text with pdfjs:", err);
        return null;
    }
}

/**
 * Extract text from PDF with positioning data using pdfjs-dist
 * @param {string} filePath - Path to the PDF file
 * @param {object} options - Configuration options
 * @returns {Promise<object>} - Extracted text with positioning data
 */
async function extractTextWithPositions(filePath, options = {}) {
    const {
        preserveSpacing = true,
        groupByLines = true,
        detectColumns = true
    } = options;

    const data = new Uint8Array(fs.readFileSync(filePath));

    try {
        // Suppress warnings
        const originalWarn = console.warn;
        console.warn = () => { };

        const pdf = await pdfjsLib.getDocument({ data }).promise;

        const extractedData = {
            pages: [],
            totalPages: pdf.numPages,
            metadata: {
                filePath,
                timestamp: new Date().toISOString(),
                preserveSpacing,
                groupByLines,
                detectColumns
            }
        };

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            console.log(`Processing page ${pageNum}/${pdf.numPages}...`);

            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1.0 });

            const pageData = {
                pageNumber: pageNum,
                width: viewport.width,
                height: viewport.height,
                items: [],
                lines: [],
                text: '',
                structure: {}
            };

            // Extract text items with positions
            textContent.items.forEach((item, index) => {
                const textItem = {
                    text: item.str,
                    x: Math.round(item.transform[4]),
                    y: Math.round(viewport.height - item.transform[5]), // Flip Y coordinate
                    width: Math.round(item.width),
                    height: Math.round(item.height),
                    fontName: item.fontName,
                    fontSize: Math.round(item.transform[0]),
                    index: index
                };
                pageData.items.push(textItem);
            });

            // Group items into lines based on Y position
            if (groupByLines) {
                const lineGroups = {};
                const lineThreshold = 5; // Pixels threshold for grouping into same line

                pageData.items.forEach(item => {
                    let foundLine = false;
                    for (const yPos in lineGroups) {
                        if (Math.abs(item.y - parseInt(yPos)) <= lineThreshold) {
                            lineGroups[yPos].push(item);
                            foundLine = true;
                            break;
                        }
                    }
                    if (!foundLine) {
                        lineGroups[item.y] = [item];
                    }
                });

                // Sort lines by Y position (top to bottom)
                const sortedYPositions = Object.keys(lineGroups)
                    .map(y => parseInt(y))
                    .sort((a, b) => a - b);

                sortedYPositions.forEach(yPos => {
                    // Sort items in line by X position (left to right)
                    const lineItems = lineGroups[yPos].sort((a, b) => a.x - b.x);

                    const line = {
                        y: yPos,
                        x: Math.min(...lineItems.map(item => item.x)),
                        width: Math.max(...lineItems.map(item => item.x + item.width)) - Math.min(...lineItems.map(item => item.x)),
                        height: Math.max(...lineItems.map(item => item.height)),
                        items: lineItems,
                        text: ''
                    };

                    // Build line text with spacing preservation
                    if (preserveSpacing) {
                        let lineText = '';
                        let lastX = line.x;

                        lineItems.forEach(item => {
                            const gap = item.x - lastX;
                            if (gap > item.fontSize) { // Significant gap
                                const spaces = Math.round(gap / (item.fontSize * 0.3));
                                lineText += ' '.repeat(Math.min(spaces, 10)); // Limit spaces
                            }
                            lineText += item.text;
                            lastX = item.x + item.width;
                        });
                        line.text = lineText;
                    } else {
                        line.text = lineItems.map(item => item.text).join(' ');
                    }

                    pageData.lines.push(line);
                });
            }

            // Build page text
            pageData.text = pageData.lines.map(line => line.text).join('\n');

            // Detect column structure
            if (detectColumns) {
                pageData.structure = analyzePageStructure(pageData);
            }

            extractedData.pages.push(pageData);
        }

        // Restore console.warn
        console.warn = originalWarn;

        return extractedData;

    } catch (err) {
        console.error("Error extracting text with positions:", err);
        return null;
    }
}

/**
 * Analyze page structure to detect columns, tables, etc.
 * @param {object} pageData - Page data with items and lines
 * @returns {object} - Structure analysis
 */
function analyzePageStructure(pageData) {
    const structure = {
        columns: [],
        possibleTables: [],
        headers: [],
        alignment: {
            left: [],
            center: [],
            right: []
        }
    };

    if (pageData.lines.length === 0) return structure;

    // Detect columns by X positions
    const xPositions = pageData.lines.map(line => line.x);
    const uniqueXPositions = [...new Set(xPositions)].sort((a, b) => a - b);

    // Group lines by similar X positions (within 20px)
    const columnThreshold = 20;
    const columnGroups = [];

    uniqueXPositions.forEach(x => {
        let addedToGroup = false;
        for (const group of columnGroups) {
            if (Math.abs(group[0] - x) <= columnThreshold) {
                group.push(x);
                addedToGroup = true;
                break;
            }
        }
        if (!addedToGroup) {
            columnGroups.push([x]);
        }
    });

    // Calculate average X position for each column
    structure.columns = columnGroups.map(group => {
        const avgX = group.reduce((sum, x) => sum + x, 0) / group.length;
        const linesInColumn = pageData.lines.filter(line =>
            group.some(x => Math.abs(line.x - x) <= columnThreshold)
        );
        return {
            x: Math.round(avgX),
            lineCount: linesInColumn.length,
            lines: linesInColumn
        };
    });

    // Detect potential tables (lines with similar structure)
    const lineWidths = pageData.lines.map(line => line.width);
    const similarWidthLines = [];

    lineWidths.forEach((width, index) => {
        const similarLines = pageData.lines.filter(line =>
            Math.abs(line.width - width) <= 50 // Within 50px
        );
        if (similarLines.length >= 3) { // At least 3 similar lines
            similarWidthLines.push({
                width: width,
                lines: similarLines
            });
        }
    });

    structure.possibleTables = similarWidthLines;

    // Detect text alignment
    const pageWidth = pageData.width;
    pageData.lines.forEach(line => {
        const centerX = line.x + (line.width / 2);
        const rightX = line.x + line.width;

        if (line.x <= 50) {
            structure.alignment.left.push(line);
        } else if (Math.abs(centerX - pageWidth / 2) <= 50) {
            structure.alignment.center.push(line);
        } else if (rightX >= pageWidth - 50) {
            structure.alignment.right.push(line);
        }
    });

    return structure;
}

module.exports = {
    extractTextFromPDF,
    extractTextWithPositions,
    createPDFFromPositions,
    createSimplePDFFromText
};
