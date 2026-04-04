import React, { useState } from 'react';

/**
 * ActivationPage - License activation interface
 * 
 * This page is shown when:
 * 1. App starts and no valid license is found
 * 2. License validation fails
 * 3. License expires
 * 
 * User must activate with valid license key to proceed
 */
const ActivationPage = () => {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleActivate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!licenseKey.trim()) {
        throw new Error('Please enter a license key');
      }

      console.log('[activation] Submitting license key...');
      
      // Call backend activation
      const result = await window.api.activateLicense(licenseKey.trim());

      if (result.success) {
        setSuccess('✅ License activated successfully!');
        console.log('[activation] License activated. Expires:', result.expiry);
        
        // Reload app to reinitialize with new license
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(result.message || 'Activation failed');
      }
    } catch (err) {
      console.error('[activation] Error:', err.message);
      setError('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Choudhary Electrical Store</h1>
          <p className="text-gray-600 text-sm">License Activation Required</p>
        </div>

        {/* Description */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700">
            This is a commercial application. Please enter your license key to activate.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleActivate} className="space-y-4">
          
          {/* License Key Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              License Key
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: XXXX-XXXX-XXXX-XXXX (provided in your license email)
            </p>
          </div>

          {/* Activate Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 cursor-pointer"
          >
            {loading ? 'Activating...' : 'Activate License'}
          </button>

        </form>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Don't have a license key?{' '}
            <a href="mailto:info@choudharyelectrical.com" className="text-blue-600 hover:underline">
              Contact sales
            </a>
          </p>
        </div>

        {/* Info Box */}
        <div className="mt-4 bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
          <p className="font-semibold mb-2">📋 License Info:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>License is hardware-bound (machine-specific)</li>
            <li>Encrypted and secured on your system</li>
            <li>Valid for 1 year from activation</li>
            <li>Never shared or uploaded remotely</li>
          </ul>
        </div>

      </div>
    </div>
  );
};

export default ActivationPage;
