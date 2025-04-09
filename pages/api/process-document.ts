// pages/api/process-document.ts
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Disable the default body parser to handle form data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Use the writable /tmp directory on Vercel instead of process.cwd()
    const uploadDir = path.join('/tmp', 'document-analyzer');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Parse form with uploaded file - updated for newer formidable versions
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve([fields, files]);
      });
    });

    // Get the file and naming convention
    const file = files.file;
    const namingConvention = fields.namingConvention;

    if (!file || !namingConvention) {
      return res.status(400).json({ success: false, message: 'File and naming convention are required' });
    }

    // Make sure we have a single file, not an array
    const uploadedFile = Array.isArray(file) ? file[0] : file;
    const namingConventionStr = Array.isArray(namingConvention) ? namingConvention[0] : namingConvention;

    // Extract the temporary file path
    const filePath = uploadedFile.filepath;

    // Run the Python script
    const result = await runPythonScript(filePath, namingConventionStr);

    // Clean up the temporary file
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('Error deleting temporary file:', error);
    }

    return res.status(200).json({
      success: true,
      extractedInfo: result.extractedInfo,
      newFilename: result.newFilename,
      message: 'Document processed successfully',
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

interface PythonScriptResult {
  extractedInfo: string;
  newFilename: string;
}

async function runPythonScript(filePath: string, namingConvention: string): Promise<PythonScriptResult> {
  return new Promise((resolve, reject) => {
    // Path to the Python script
    const scriptPath = path.join(process.cwd(), 'scripts', 'document_analyzer.py');

    // Run the Python script as a child process
    const pythonProcess = spawn('python', [scriptPath, filePath, namingConvention]);

    let extractedInfo = '';
    let stdErr = '';
    let newFilename = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Parse output for extracted info and new filename
      if (output.includes('Extracted information:')) {
        extractedInfo = output.split('Extracted information:')[1].split('Generated new filename:')[0].trim();
      }
      
      if (output.includes('Generated new filename:')) {
        newFilename = output.split('Generated new filename:')[1].split('File renamed successfully to:')[0].trim();
      }
      
      if (output.includes('File renamed successfully to:')) {
        newFilename = output.split('File renamed successfully to:')[1].trim();
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      stdErr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stdErr}`));
        return;
      }
      resolve({
        extractedInfo,
        newFilename,
      });
    });
  });
}
