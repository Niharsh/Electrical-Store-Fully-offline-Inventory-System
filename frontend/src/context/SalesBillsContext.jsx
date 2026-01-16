import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const SalesBillsContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const SalesBillsProvider = ({ children }) => {
  const [salesBills, setSalesBills] = useState([]);
  const [summary, setSummary] = useState({ total_sales: 0, total_paid: 0, total_due: 0, bill_count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all sales bills
  const fetchSalesBills = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/sales-bills/`, { params });
      setSalesBills(Array.isArray(response.data) ? response.data : response.data.results || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      console.error('Failed to fetch sales bills:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch sales summary
  const fetchSummary = useCallback(async (period = 'month', date = null) => {
    setLoading(true);
    setError(null);
    try {
      const params = { period };
      if (date) params.date = date;
      const response = await axios.get(`${API_URL}/sales-bills/summary/`, { params });
      setSummary(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      console.error('Failed to fetch sales summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update amount paid
  const updateAmountPaid = useCallback(async (billId, amountPaid) => {
    try {
      const response = await axios.patch(`${API_URL}/sales-bills/${billId}/`, {
        amount_paid: parseFloat(amountPaid)
      });
      setSalesBills(salesBills.map(bill => bill.id === billId ? response.data : bill));
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    }
  }, [salesBills]);

  // Search sales bills
  const searchSalesBills = useCallback(async (searchTerm) => {
    try {
      return await fetchSalesBills({ search: searchTerm });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [fetchSalesBills]);

  return (
    <SalesBillsContext.Provider value={{
      salesBills,
      summary,
      loading,
      error,
      fetchSalesBills,
      fetchSummary,
      updateAmountPaid,
      searchSalesBills
    }}>
      {children}
    </SalesBillsContext.Provider>
  );
};

export const useSalesBills = () => {
  const context = useContext(SalesBillsContext);
  if (!context) {
    throw new Error('useSalesBills must be used within SalesBillsProvider');
  }
  return context;
};
