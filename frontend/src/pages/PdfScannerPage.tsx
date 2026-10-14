import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  ContentCopy as ContentCopyIcon,
  Download as DownloadIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import apiClient from '../api/client';

interface ExtractionResult {
  message: string;
  method: 'digital' | 'ocr';
  pages: number;
  text: string;
}

const PdfScannerPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type !== 'application/pdf') {
        setError('Please select a PDF file');
        return;
      }
      if (selected.size > 20 * 1024 * 1024) {
        setError('File size must be less than 20 MB');
        return;
      }
      setFile(selected);
      setError('');
      setResult(null);
    }
  };

  const handleExtract = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError('');
    setResult(null);

    try {
      const data = await apiClient.extractPdfText(file);
      setResult(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to extract text from PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (result?.text) {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    if (result?.text) {
      const blob = new Blob([result.text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file?.name?.replace('.pdf', '') || 'extracted'}-text.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleClear = () => {
    setFile(null);
    setResult(null);
    setError('');
    setCopied(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">PDF Scanner</Typography>
        {(file || result) && (
          <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClear}>
            Clear
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Upload area */}
      <Paper
        sx={{
          p: 4,
          mb: 3,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: file ? 'primary.main' : 'grey.300',
          backgroundColor: file ? 'primary.50' : 'grey.50',
          cursor: 'pointer',
          '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' },
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={handleFileChange}
        />
        <CloudUploadIcon sx={{ fontSize: 48, color: file ? 'primary.main' : 'grey.500', mb: 1 }} />
        {file ? (
          <Box>
            <Typography variant="subtitle1" fontWeight="medium">
              {file.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </Typography>
          </Box>
        ) : (
          <Box>
            <Typography variant="subtitle1" color="text.secondary">
              Click to upload or drag a PDF file here
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supports both digital and scanned PDFs (up to 20 MB)
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Extract button */}
      {file && !result && (
        <Box display="flex" justifyContent="center" mb={3}>
          <Button
            variant="contained"
            size="large"
            onClick={handleExtract}
            disabled={isProcessing}
            startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            {isProcessing ? 'Extracting Text...' : 'Extract Text'}
          </Button>
        </Box>
      )}

      {isProcessing && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Processing PDF — scanned documents may take longer as OCR is applied to each page.
        </Alert>
      )}

      {/* Results */}
      {result && (
        <Paper sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6">Extracted Text</Typography>
              <Chip
                label={result.method === 'ocr' ? 'OCR (Scanned)' : 'Digital PDF'}
                color={result.method === 'ocr' ? 'warning' : 'success'}
                size="small"
              />
              <Chip label={`${result.pages} page${result.pages !== 1 ? 's' : ''}`} size="small" variant="outlined" />
            </Box>
            <Box display="flex" gap={1}>
              <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
                <IconButton onClick={handleCopy} color={copied ? 'success' : 'default'}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download as .txt">
                <IconButton onClick={handleDownloadTxt}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box
            sx={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              maxHeight: '600px',
              overflow: 'auto',
              backgroundColor: 'grey.50',
              p: 2,
              borderRadius: 1,
            }}
          >
            {result.text || 'No text could be extracted from this PDF.'}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default PdfScannerPage;
