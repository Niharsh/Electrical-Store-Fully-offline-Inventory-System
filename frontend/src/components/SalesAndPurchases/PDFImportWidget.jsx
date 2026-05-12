import React, { useState } from 'react';
import { Upload, AlertCircle, FileText, X } from 'lucide-react';
 
const PDFImportWidget = ({ onImportSuccess, onImportError }) => {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [fileName, setFileName] = useState('');
 
  const handleClick = async () => {
    if (loading) return;
    setError('');
 
    try {
      // Use Electron's native dialog — gives real absolute file path
      // No hidden <input type="file"> needed; file.path is empty in Electron renderer
      const result = await window.api.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });
 
      if (result.canceled || !result.filePaths[0]) return;
 
      const filePath = result.filePaths[0];
 
      // Extract filename from full path (works on Windows \ and Mac/Linux /)
      const name = filePath.split('\\').pop().split('/').pop();
 
      setLoading(true);
      setFileName(name);
 
      if (!window?.api?.importPurchasePdf) {
        throw new Error('PDF import API not available. Check your preload bridge.');
      }
 
      const response = await window.api.importPurchasePdf(filePath);
 
      if (response.success && response.data) {
        onImportSuccess(response.data);
      } else {
        throw new Error(response.message || 'Failed to parse PDF.');
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to import PDF.';
      setError(errorMsg);
      onImportError?.(errorMsg);
      setFileName('');
    } finally {
      setLoading(false);
    }
  };
 
  const handleClear = () => {
    setFileName('');
    setError('');
  };
 
  return (
    <div className="mb-6">
      <div className="flex items-center gap-4 flex-wrap">
 
        {!fileName && (
          <button
            onClick={handleClick}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
              ${loading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              }`}
          >
            <Upload size={18} />
            {loading ? 'Reading PDF...' : 'Import from PDF'}
          </button>
        )}
 
        {fileName && !loading && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200
                          rounded-lg text-green-700 text-sm font-medium">
            <FileText size={15} className="flex-shrink-0" />
            <span className="max-w-[220px] truncate">{fileName}</span>
            <button
              onClick={handleClear}
              className="ml-1 hover:text-green-900 transition-colors"
              title="Clear"
            >
              <X size={14} />
            </button>
          </div>
        )}
 
        {fileName && !loading && (
          <button
            onClick={handleClick}
            className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2
                       transition-colors"
          >
            Upload different PDF
          </button>
        )}
 
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Reading PDF, please wait...
          </div>
        )}
 
        {!fileName && !loading && (
          <span className="text-sm text-gray-400">
            Upload supplier invoice PDF to auto-fill the form
          </span>
        )}
 
      </div>
 
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg
                        flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={handleClick}
              className="text-xs text-red-600 underline mt-1 hover:text-red-800"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
 
export default PDFImportWidget;