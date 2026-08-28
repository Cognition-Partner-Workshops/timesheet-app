const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Configure multer for PDF uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

router.use(authenticateUser);

// Extract text from an uploaded PDF (supports both digital and scanned PDFs)
router.post('/extract-text', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  const pdfPath = req.file.path;
  const tempDir = path.join(uploadDir, `temp-${Date.now()}`);

  try {
    // First try extracting embedded text with pdf-parse
    const pdfParse = require('pdf-parse');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);

    const embeddedText = (pdfData.text || '').trim();

    // If we got meaningful text, return it (digital/text-based PDF)
    if (embeddedText.length > 20) {
      cleanup(pdfPath, tempDir);
      return res.json({
        message: 'Text extracted successfully',
        method: 'digital',
        pages: pdfData.numpages,
        text: embeddedText,
      });
    }

    // Otherwise, treat as scanned PDF — use OCR
    fs.mkdirSync(tempDir, { recursive: true });

    // Convert PDF pages to PNG images using pdftoppm
    execSync(`pdftoppm -png -r 300 "${pdfPath}" "${path.join(tempDir, 'page')}"`, {
      timeout: 60000,
    });

    const imageFiles = fs.readdirSync(tempDir)
      .filter((f) => f.endsWith('.png'))
      .sort();

    if (imageFiles.length === 0) {
      cleanup(pdfPath, tempDir);
      return res.status(422).json({ error: 'Could not convert PDF pages to images for OCR' });
    }

    // Run OCR on each page image
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('eng');

    const pageTexts = [];
    for (const imageFile of imageFiles) {
      const imagePath = path.join(tempDir, imageFile);
      const { data: { text } } = await worker.recognize(imagePath);
      pageTexts.push(text);
    }

    await worker.terminate();

    const ocrText = pageTexts.join('\n\n--- Page Break ---\n\n').trim();

    cleanup(pdfPath, tempDir);

    return res.json({
      message: 'Text extracted successfully via OCR',
      method: 'ocr',
      pages: imageFiles.length,
      text: ocrText,
    });
  } catch (err) {
    console.error('PDF text extraction error:', err);
    cleanup(pdfPath, tempDir);
    return res.status(500).json({ error: 'Failed to extract text from PDF' });
  }
});

function cleanup(pdfPath, tempDir) {
  try {
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    console.error('Cleanup error:', e);
  }
}

module.exports = router;
