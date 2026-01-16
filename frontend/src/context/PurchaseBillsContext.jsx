import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const PurchaseBillsContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const PurchaseBillsProvider = ({ children }) => {
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [summary, setSummary] = useState({ total_purchases: 0, total_paid: 0, total_due: 0, bill_count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all purchase bills
  const fetchPurchaseBills = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/purchase-bills/`, { params });
      setPurchaseBills(Array.isArray(response.data) ? response.data : response.data.results || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      console.error('Failed to fetch purchase bills:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch purchase summary
  const fetchSummary = useCallback(async (period = 'month', date = null) => {
    setLoading(true);
    setError(null);
    try {
      const params = { period };
      if (date) params.date = date;
      const response = await axios.get(`${API_URL}/purchase-bills/summary/`, { params });
      setSummary(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      console.error('Failed to fetch purchase summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create purchase bill
  const createPurchaseBill = useCallback(async (billData) => {
    try {
      const response = await axios.post(`${API_URL}/purchase-bills/`, billData);
      setPurchaseBills([response.data, ...purchaseBills]);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    }
  }, [purchaseBills]);

  // Update purchase bill
  const updatePurchaseBill = useCallback(async (billId, billData) => {
    try {
      const response = await axios.patch(`${API_URL}/purchase-bills/${billId}/`, billData);
      setPurchaseBills(purchaseBills.map(bill => bill.id === billId ? response.data : bill));
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    }
  }, [purchaseBills]);

  // Delete purchase bill
  const deletePurchaseBill = useCallback(async (billId) => {
    try {
      await axios.delete(`${API_URL}/purchase-bills/${billId}/`);
      setPurchaseBills(purchaseBills.filter(bill => bill.id !== billId));
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    }
  }, [purchaseBills]);

  // Search purchase bills
  const searchPurchaseBills = useCallback(async (searchTerm) => {
    try {
      return await fetchPurchaseBills({ search: searchTerm });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [fetchPurchaseBills]);

  return (
    <PurchaseBillsContext.Provider value={{
      purchaseBills,
      summary,
      loading,
      error,
      fetchPurchaseBills,
      fetchSummary,
      createPurchaseBill,
      updatePurchaseBill,
      deletePurchaseBill,
      searchPurchaseBills
    }}>
      {children}
    </PurchaseBillsContext.Provider>
  );
};

export const usePurchaseBills = () => {
  const context = useContext(PurchaseBillsContext);
  if (!context) {
    throw new Error('usePurchaseBills must be used within PurchaseBillsProvider');
  }
  return context;
};
