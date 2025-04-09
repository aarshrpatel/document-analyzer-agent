// pages/index.tsx
import { useState } from 'react';
import { Inter } from 'next/font/google';
import Head from 'next/head';
import { useRouter } from 'next/router';

const inter = Inter({ subsets: ['latin'] });

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [namingConvention, setNamingConvention] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<{
    extractedInfo: string;
    newFilename: string;
    success: boolean;
    message: string;
  } | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !namingConvention) {
      alert('Please select a file and enter a naming convention');
      return;
    }

    setIsProcessing(true);
    setResult(null);

    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('namingConvention', namingConvention);

    try {
      const response = await fetch('/api/process-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      
      // Scroll to results after processing
      setTimeout(() => {
        const resultsElement = document.getElementById('results-section');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      console.error('Error processing file:', error);
      setResult({
        extractedInfo: '',
        newFilename: '',
        success: false,
        message: `Error processing file: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
    // Keep the naming convention as it might be reused
  };

  return (
    <>
      <Head>
        <title>Document Analyzer | AI-Powered File Organization</title>
        <meta name="description" content="Upload documents and extract information for intelligent file naming" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Decorative Background Accent */}
      <div className="absolute top-[-100px] right-[-100px] w-64 h-64 rounded-full bg-indigo-300 opacity-20 filter blur-3xl z-[-1]"></div>
      
      <div className={`min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 ${inter.className}`}>
        {/* Header */}
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto py-6 px-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Document Analyzer</h1>
            <nav>
              <button 
                onClick={() => router.reload()}
                className="text-gray-600 hover:text-indigo-600 text-sm font-medium transition-colors duration-300"
              >
                New Analysis
              </button>
            </nav>
          </div>
        </header>

        <main className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <section className="bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">AI Document Analysis</h2>
              <p className="text-gray-600 mb-8">Upload your document and specify a naming convention to extract important information.</p>
              
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* File Upload Area */}
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
                    dragActive
                      ? 'border-indigo-400 bg-indigo-50 animate-pulse'
                      : 'border-gray-300 hover:border-indigo-300'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  {!file ? (
                    <div className="space-y-4">
                      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                        <span className="text-indigo-600 font-medium text-lg hover:underline">
                          Upload a file
                        </span>
                        <input 
                          id="file-upload" 
                          name="file-upload" 
                          type="file"
                          className="sr-only"
                          onChange={handleFileChange}
                          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.csv,.xlsx,.xls"
                        />
                      </label>
                      <p className="text-sm text-gray-500">or drag and drop</p>
                      <p className="text-xs text-gray-400">Supported: PDF, DOCX, Images, CSV, Excel (Max 10MB)</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-6">
                      <div className="text-left">
                        <p className="text-lg font-medium text-gray-800">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB • {file.type || 'Unknown type'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="p-2 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Naming Convention Input */}
                <div>
                  <label htmlFor="naming-convention" className="block text-sm font-medium text-gray-700 mb-2">
                    Naming Convention
                  </label>
                  <input
                    id="naming-convention"
                    type="text"
                    value={namingConvention}
                    onChange={(e) => setNamingConvention(e.target.value)}
                    placeholder="e.g., YYYY-MM-DD_ClientName_DocumentType"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Describe what information should be extracted and how the filename should be formatted.
                  </p>
                </div>
                
                {/* Submit Button */}
                <div>
                  <button
                    type="submit"
                    disabled={isProcessing || !file || !namingConvention}
                    className={`w-full flex justify-center items-center py-3 px-4 rounded-md shadow font-medium transition-colors duration-300 ${
                      isProcessing || !file || !namingConvention
                        ? 'bg-indigo-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isProcessing ? 'Processing Document' : 'Analyze Document'}
                  </button>
                </div>
              </form>
            </div>

            {/* Result Section */}
            {result && (
              <div 
                id="results-section"
                className={`border-t transition-colors ${
                  result.success ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <div className="p-8">
                  <div className="flex items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-semibold text-gray-800">
                        {result.success ? 'Analysis Complete' : 'Analysis Failed'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {result.success 
                          ? 'Your document has been successfully analyzed.' 
                          : 'There was an error processing your document.'}
                      </p>
                    </div>
                  </div>
                  
                  {result.success ? (
                    <div className="space-y-8">
                      {/* Extracted Information */}
                      <div>
                        <h4 className="text-lg font-medium text-gray-700 mb-3">Extracted Information:</h4>
                        <div className="bg-white shadow rounded-md">
                          <pre className="p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 border-b border-gray-200">
                            {result.extractedInfo}
                          </pre>
                        </div>
                      </div>
                      
                      {/* New Filename */}
                      <div>
                        <h4 className="text-lg font-medium text-gray-700 mb-3">New Filename:</h4>
                        <div className="bg-white shadow rounded-md">
                          <code className="block p-4 text-sm text-blue-800 font-mono bg-blue-50 border-b border-gray-200">
                            {result.newFilename}
                          </code>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={resetForm}
                          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white shadow hover:bg-gray-50 transition-colors"
                        >
                          Process Another Document
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="text-sm text-red-600">{result.message}</p>
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => setResult(null)}
                          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white shadow hover:bg-gray-50 transition-colors"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* How to Use Section */}
          <section className="mt-12 bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800">How to Use</h3>
              <p className="mt-1 text-sm text-gray-500">Guidelines for using the document analyzer.</p>
            </div>
            <div className="px-6 py-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col items-center text-center">
                  <h4 className="text-lg font-medium text-gray-800 mb-2">1. Upload Your Document</h4>
                  <p className="text-sm text-gray-500">Upload a PDF, Word document, image, CSV, or Excel file.</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <h4 className="text-lg font-medium text-gray-800 mb-2">2. Define Naming Convention</h4>
                  <p className="text-sm text-gray-500">Specify what information to extract and how to format it.</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <h4 className="text-lg font-medium text-gray-800 mb-2">3. Review Results</h4>
                  <p className="text-sm text-gray-500">See extracted information and the new filename suggestion.</p>
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200 pt-6">
                <h5 className="text-lg font-medium text-gray-800 mb-3">Example Naming Conventions:</h5>
                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
                  <li>
                    <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">YYYY-MM-DD_ClientName_DocumentType</span> – extracts date, client name, and document type
                  </li>
                  <li>
                    <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">YYYYMMDD_ProjectNumber_InvoiceNumber</span> – extracts date, project ID, and invoice number
                  </li>
                  <li>
                    <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">Department_Employee_ReportType_YYYYMM</span> – extracts department, employee, report type, and month/year
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto py-6 px-6 text-center">
            <p className="text-sm text-gray-500">
              Document Analyzer - AI-powered file organization and naming
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
