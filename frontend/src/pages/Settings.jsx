import React, { useEffect, useState } from 'react';
import { Database, CheckCircle, AlertCircle } from 'lucide-react';
import { useProducts } from '../context/ProductContext';
// ✅ REMOVED: import ProductTypeManager
import HSNManager from '../components/Product/HSNManager';
import HSNGSTReport from '../components/Settings/HSNGSTReport';
import ErrorAlert from '../components/Common/ErrorAlert';
import ShopDetails from "../components/Settings/ShopDetails";

const Settings = () => {
  const { 
    // ✅ REMOVED: productTypes, fetchProductTypes, addProductType, deleteProductType
    hsns,
    fetchHSNs,
    addHSN,
    updateHSN,
    deleteHSN,
    loading,
    error 
  } = useProducts();

  const [localError, setLocalError] = useState('');
  const [backupStatus, setBackupStatus] = useState('idle');
  const [backupMessage, setBackupMessage] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // ✅ FIXED: loadData now only fetches HSN codes
  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchHSNs();
      } catch (err) {
        setLocalError('Failed to load settings data');
        console.error(err);
      }
    };
    loadData();
  }, []);

  // ✅ REMOVED: handleAddType, handleDeleteType — no longer needed

  const handleAddHSN = async (hsnData) => {
    try {
      setLocalError('');
      await addHSN(hsnData);
      return Promise.resolve();
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateHSN = async (hsnCode, hsnData) => {
    try {
      setLocalError('');
      await updateHSN(hsnCode, hsnData);
      return Promise.resolve();
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteHSN = async (hsnCode) => {
    try {
      setLocalError('');
      await deleteHSN(hsnCode);
    } catch (err) {
      setLocalError(err.message || 'Failed to delete HSN code');
    }
  };

  const handleBackup = async () => {
    try {
      setBackupStatus('backing up');
      setBackupMessage('');
      const result = await window.api.backupDatabase();
      if (result.success) {
        setBackupStatus('success');
        setBackupMessage(result.message || 'Database backed up successfully');
        setTimeout(() => {
          setBackupStatus('idle');
          setBackupMessage('');
        }, 5000);
      } else {
        setBackupStatus('error');
        setBackupMessage(result.message || 'Failed to backup database');
      }
    } catch (err) {
      setBackupStatus('error');
      setBackupMessage(err.message || 'An error occurred during backup');
      console.error('Backup error:', err);
    }
  };

  const handleRestore = async () => {
    if (!showRestoreConfirm) {
      setShowRestoreConfirm(true);
      return;
    }
    try {
      setBackupStatus('restoring');
      setBackupMessage('');
      setShowRestoreConfirm(false);
      const result = await window.api.restoreDatabase();
      if (result.success) {
        setBackupStatus('success');
        setBackupMessage(result.message || 'Database restored successfully. App will restart...');
      } else {
        setBackupStatus('error');
        setBackupMessage(result.message || 'Failed to restore database');
      }
    } catch (err) {
      setBackupStatus('error');
      setBackupMessage(err.message || 'An error occurred during restore');
      console.error('Restore error:', err);
    }
  };

  const handleCancelRestore = () => {
    setShowRestoreConfirm(false);
    setBackupStatus('idle');
    setBackupMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings & Management</h1>
        <p className="text-gray-600 mt-2">
          Customize your inventory system and manage HSN codes
        </p>
      </div>

      {/* Error Display */}
      {(localError || error) && (
        <ErrorAlert
          error={localError || error}
          onDismiss={() => setLocalError('')}
        />
      )}

      {/* Shop Details Section */}
      <div className="card">
        <ShopDetails />
      </div>

      {/* ✅ REMOVED: ProductTypeManager block */}

      {/* HSN Manager */}
      <div className="card">
        <HSNManager
          hsns={hsns}
          onHSNAdded={handleAddHSN}
          onHSNUpdated={handleUpdateHSN}
          onHSNDeleted={handleDeleteHSN}
          loading={loading}
        />
      </div>

      {/* ── NEW: HSN GST Report ── */}
      <div className="card">
        <HSNGSTReport />
      </div>

      {/* Database Management Section */}
      <div className="card">
        <div className="flex items-center mb-4">
          <Database className="w-6 h-6 mr-2 text-blue-600" />
          <h3 className="text-lg font-semibold">Database Management</h3>
        </div>

        {backupMessage && (
          <div className={`mb-4 p-3 rounded flex items-center ${
            backupStatus === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}>
            {backupStatus === 'success' && <CheckCircle className="w-5 h-5 mr-2" />}
            {backupStatus === 'error'   && <AlertCircle  className="w-5 h-5 mr-2" />}
            <span className="text-sm">{backupMessage}</span>
          </div>
        )}

        {showRestoreConfirm && (
          <div className="mb-4 p-4 border border-yellow-300 bg-yellow-50 rounded">
            <p className="text-yellow-800 font-semibold mb-3">
              ⚠️ Warning: This will replace your current database with the backup.
            </p>
            <p className="text-yellow-700 text-sm mb-4">
              This action cannot be undone. Make sure you want to proceed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleRestore}
                disabled={backupStatus === 'restoring'}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-sm font-medium"
              >
                {backupStatus === 'restoring' ? 'Restoring...' : 'Yes, Restore'}
              </button>
              <button
                onClick={handleCancelRestore}
                disabled={backupStatus === 'restoring'}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 disabled:bg-gray-400 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleBackup}
              disabled={backupStatus === 'backing up' || backupStatus === 'restoring'}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 font-medium"
            >
              {backupStatus === 'backing up' ? 'Backing up...' : 'Backup Database'}
            </button>
            <button
              onClick={handleRestore}
              disabled={
                backupStatus === 'backing up' ||
                backupStatus === 'restoring'  ||
                showRestoreConfirm
              }
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400 font-medium"
            >
              {backupStatus === 'restoring' ? 'Restoring...' : 'Restore Database'}
            </button>
          </div>
          <p className="text-gray-600 text-sm">
            💾 Backups are automatically saved when you close the app. Manual backups are saved to your chosen location.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;