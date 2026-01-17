import React, { createContext, useContext, useState, useEffect } from 'react';

const WholesalersContext = createContext();

const WHOLESALERS_STORAGE_KEY = 'inventory_wholesalers';
const PURCHASE_HISTORY_STORAGE_KEY = 'inventory_purchase_history';

export const WholesalersProvider = ({ children }) => {
  const [wholesalers, setWholesalers] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [selectedWholesalerId, setSelectedWholesalerId] = useState(null);

  // Load from local storage on mount
  useEffect(() => {
    const savedWholesalers = localStorage.getItem(WHOLESALERS_STORAGE_KEY);
    const savedHistory = localStorage.getItem(PURCHASE_HISTORY_STORAGE_KEY);
    
    if (savedWholesalers) {
      try {
        setWholesalers(JSON.parse(savedWholesalers));
      } catch (err) {
        console.error('Failed to load wholesalers from storage:', err);
      }
    }
    
    if (savedHistory) {
      try {
        setPurchaseHistory(JSON.parse(savedHistory));
      } catch (err) {
        console.error('Failed to load purchase history from storage:', err);
      }
    }
  }, []);

  // Save wholesalers to local storage
  const saveWholesalers = (data) => {
    localStorage.setItem(WHOLESALERS_STORAGE_KEY, JSON.stringify(data));
    setWholesalers(data);
  };

  // Save purchase history to local storage
  const savePurchaseHistory = (data) => {
    localStorage.setItem(PURCHASE_HISTORY_STORAGE_KEY, JSON.stringify(data));
    setPurchaseHistory(data);
  };

  // Add new wholesaler
  const addWholesaler = (name, contactNumber = '') => {
    const newWholesaler = {
      id: Date.now().toString(),
      name: name.trim(),
      contactNumber: contactNumber.trim(),
      createdAt: new Date().toISOString()
    };
    const updated = [...wholesalers, newWholesaler];
    saveWholesalers(updated);
    return newWholesaler;
  };

  // Update wholesaler
  const updateWholesaler = (id, name, contactNumber = '') => {
    const updated = wholesalers.map(w => 
      w.id === id 
        ? { ...w, name: name.trim(), contactNumber: contactNumber.trim() }
        : w
    );
    saveWholesalers(updated);
  };

  // Delete wholesaler
  const deleteWholesaler = (id) => {
    const updated = wholesalers.filter(w => w.id !== id);
    saveWholesalers(updated);
    if (selectedWholesalerId === id) {
      setSelectedWholesalerId(null);
    }
  };

  // Record a purchase (product batch from wholesaler at specific cost price)
  const recordPurchase = (wholesalerId, productName, costPrice, date = new Date().toISOString()) => {
    const record = {
      id: Date.now().toString(),
      wholesalerId,
      productName: productName.trim(),
      costPrice: parseFloat(costPrice),
      purchaseDate: date,
      recordedAt: new Date().toISOString()
    };
    const updated = [...purchaseHistory, record];
    savePurchaseHistory(updated);
    return record;
  };

  // Get last purchase record for a product from a specific wholesaler
  const getLastPurchasePrice = (wholesalerId, productName) => {
    const records = purchaseHistory
      .filter(h => h.wholesalerId === wholesalerId && h.productName.toLowerCase() === productName.toLowerCase())
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    
    return records.length > 0 ? records[0] : null;
  };

  // Get all purchase records for a product
  const getProductPurchaseHistory = (productName) => {
    return purchaseHistory
      .filter(h => h.productName.toLowerCase() === productName.toLowerCase())
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  };

  // Get all purchase records from a specific wholesaler
  const getWholesalerPurchaseHistory = (wholesalerId) => {
    return purchaseHistory
      .filter(h => h.wholesalerId === wholesalerId)
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  };

  // Get wholesaler by ID
  const getWholesaler = (id) => {
    return wholesalers.find(w => w.id === id);
  };

  // Get selected wholesaler
  const getSelectedWholesaler = () => {
    return selectedWholesalerId ? getWholesaler(selectedWholesalerId) : null;
  };

  return (
    <WholesalersContext.Provider value={{
      wholesalers,
      purchaseHistory,
      selectedWholesalerId,
      setSelectedWholesalerId,
      addWholesaler,
      updateWholesaler,
      deleteWholesaler,
      recordPurchase,
      getLastPurchasePrice,
      getProductPurchaseHistory,
      getWholesalerPurchaseHistory,
      getWholesaler,
      getSelectedWholesaler
    }}>
      {children}
    </WholesalersContext.Provider>
  );
};

export const useWholesalers = () => {
  const context = useContext(WholesalersContext);
  if (!context) {
    throw new Error('useWholesalers must be used within WholesalersProvider');
  }
  return context;
};
