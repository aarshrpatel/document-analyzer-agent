// pages/api/process-document.ts

import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Disable the default body parser to handle form data (required for file uploads)
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Use the writable /tmp directory on Vercel (if available) for temporary storage
    const uploadDir = path.join('/tmp', 'document-analyzer');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Set up formidable to handle the incoming form-data
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    // Parse the incoming request to extract fields and files
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          return reject(err);
        }
        resolve([fields, files]);
      });
    });

    // Retrieve the uploaded file and naming convention field
    const file = files.file;
    const namingConvention = fields.namingConvention;

    if (!file || !namingConvention) {
      return res
        .status(400)
        .json({ success: false, message: 'File and naming convention are required' });
    }

    // If multiple files are uploaded, take the first one
    const uploadedFile = Array.isArray(file) ? file[0] : file;
    const namingConventionStr = Array.isArray(namingConvention) ? namingConvention[0] : namingConvention;

    // Get the file path of the temporary uploaded file
    const filePath = uploadedFile.filepath;

    // Run the Python script and collect its results
    const result = await runPythonScript(filePath, namingConventionStr);

    // Clean up the temporary file
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('Error deleting temporary file:', error);
    }

    // Return the result from the Python script
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

// Define the expected output from your Python script
interface PythonScriptResult {
  extractedInfo: string;
  newFilename: string;
}

// Helper function to run the Python script with the provided file path and naming convention
async function runPythonScript(filePath: string, namingConvention: string): Promise<PythonScriptResult> {
  return new Promise((resolve, reject) => {
    // Determine the path to your Python script and virtual environment's interpreter
    const scriptPath = path.join(process.cwd(), 'scripts', 'document_analyzer.py');
    const pythonInterpreter = path.join(process.cwd(), 'scripts', 'venv', 'bin', 'python');

    // Spawn a child process to run the Python script with its arguments
    const pythonProcess = spawn(pythonInterpreter, [scriptPath, filePath, namingConvention]);

    let extractedInfo = '';
    let stdErr = '';
    let newFilename = '';

    // Listen for data on stdout and parse the output for your expected keys
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Python stdout:', output);

      // Example parsing based on your output format from the Python script
      if (output.includes('Extracted information:')) {
        const parts = output.split('Extracted information:');
        if (parts[1]) {
          extractedInfo = parts[1].split('Generated new filename:')[0].trim();
        }
      }

      if (output.includes('Generated new filename:')) {
        const parts = output.split('Generated new filename:');
        if (parts[1]) {
          // If 'File renamed successfully to:' is present, extract accordingly
          if (parts[1].includes('File renamed successfully to:')) {
            newFilename = parts[1].split('File renamed successfully to:')[1].trim();
          } else {
            newFilename = parts[1].split('File renamed successfully to:')[0].trim();
          }
        }
      }

      if (output.includes('File renamed successfully to:')) {
        newFilename = output.split('File renamed successfully to:')[1].trim();
      }
    });

    // Gather any error output
    pythonProcess.stderr.on('data', (data) => {
      stdErr += data.toString();
      console.error('Python stderr:', data.toString());
    });

    // Once the Python process closes, check its exit code and resolve or reject accordingly
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python script exited with code ${code}: ${stdErr}`));
      }
      resolve({
        extractedInfo,
        newFilename,
      });
    });
  });
}
