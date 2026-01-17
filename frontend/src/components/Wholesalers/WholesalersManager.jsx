import React, { useState } from 'react';
import { useWholesalers } from '../../context/WholesalersContext';

const WholesalersManager = () => {
  const { wholesalers, selectedWholesalerId, setSelectedWholesalerId, addWholesaler, updateWholesaler, deleteWholesaler } = useWholesalers();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', contactNumber: '' });
  const [message, setMessage] = useState('');

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setMessage('Wholesaler name is required');
      return;
    }

    try {
      if (editingId) {
        updateWholesaler(editingId, formData.name, formData.contactNumber);
        setMessage('Wholesaler updated successfully');
        setEditingId(null);
      } else {
        addWholesaler(formData.name, formData.contactNumber);
        setMessage('Wholesaler added successfully');
      }
      setFormData({ name: '', contactNumber: '' });
      setShowForm(false);
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Error saving wholesaler');
      console.error(err);
    }
  };

  const handleEdit = (wholesaler) => {
    setEditingId(wholesaler.id);
    setFormData({ name: wholesaler.name, contactNumber: wholesaler.contactNumber });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this wholesaler?')) {
      deleteWholesaler(id);
      setMessage('Wholesaler deleted successfully');
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', contactNumber: '' });
  };

  const selectedWholesaler = wholesalers.find(w => w.id === selectedWholesalerId);

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">🏢 Wholesaler Selection</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2 rounded font-semibold transition ${
            showForm
              ? 'bg-gray-400 text-white hover:bg-gray-500'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {showForm ? 'Cancel' : '+ Add Wholesaler'}
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Form for adding/editing wholesaler */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-blue-50 p-4 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Wholesaler Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              placeholder="e.g., Pharma Wholesalers Ltd"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Contact Number (Optional)</label>
            <input
              type="tel"
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handleFormChange}
              placeholder="e.g., +91-9876543210"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
            >
              {editingId ? 'Update' : 'Add'} Wholesaler
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Current selection info */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-gray-700 mb-2">
          <strong>Currently Selected Wholesaler:</strong>
        </p>
        {selectedWholesaler ? (
          <div className="bg-white p-3 rounded border-l-4 border-blue-600">
            <p className="font-semibold text-lg">{selectedWholesaler.name}</p>
            {selectedWholesaler.contactNumber && (
              <p className="text-sm text-gray-600">📞 {selectedWholesaler.contactNumber}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              All products added below will be attributed to this wholesaler
            </p>
          </div>
        ) : (
          <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-600 text-yellow-800">
            ⚠️ No wholesaler selected. Select or add a wholesaler before adding products.
          </div>
        )}
      </div>

      {/* List of wholesalers */}
      {wholesalers.length > 0 && (
        <div className="mt-6">
          <h4 className="font-semibold mb-3">Available Wholesalers</h4>
          <div className="space-y-2">
            {wholesalers.map(wholesaler => (
              <div
                key={wholesaler.id}
                className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                  selectedWholesalerId === wholesaler.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-blue-400'
                }`}
                onClick={() => setSelectedWholesalerId(wholesaler.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-lg">
                      {selectedWholesalerId === wholesaler.id ? '✓ ' : ''}{wholesaler.name}
                    </p>
                    {wholesaler.contactNumber && (
                      <p className="text-sm text-gray-600">📞 {wholesaler.contactNumber}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(wholesaler);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(wholesaler.id);
                      }}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {wholesalers.length === 0 && !showForm && (
        <div className="text-center py-6 text-gray-600">
          No wholesalers added yet. Click "Add Wholesaler" to get started.
        </div>
      )}
    </div>
  );
};

export default WholesalersManager;
