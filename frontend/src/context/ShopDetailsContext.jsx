import React, { createContext, useContext, useEffect, useState } from 'react';

const ShopDetailsContext = createContext();

export const ShopDetailsProvider = ({ children }) => {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchShopDetails = async () => {
      try {
        setLoading(true);
        setError('');

        if (!window?.api?.getSettings) {
          throw new Error('window.api.getSettings not available');
        }

        const response = await window.api.getSettings();
        if (response && response.success === false) {
          throw new Error(response.message || 'Failed to fetch shop settings');
        }

        // Map the database field names to shop object
        const settings = response.data;
        const shopData = {
          shop_name: settings.shop_name || 'Medical Store',
          owner_name: settings.owner_name || '',
          phone: settings.phone || '',
          address: settings.address || '',
          gst_number: settings.gst_number || '',
          dl_number: settings.dl_number || '',
          bank_holder: settings.bank_holder || '',
          bank_name: settings.bank_name || '',
          bank_account: settings.bank_account || '',
          bank_ifsc: settings.bank_ifsc || '',
        };

        setShop(shopData);
      } catch (err) {
        console.error('[ShopDetailsContext] Error fetching shop settings:', err);
        setError(err.message || 'Failed to load shop details');
        // Set default shop data on error
        setShop({
          shop_name: 'Electrical Store',
          owner_name: '',
          phone: '',
          address: '',
          gst_number: '',
          dl_number: '',
          bank_holder: '',
          bank_name: '',
          bank_account: '',
          bank_ifsc: '',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchShopDetails();
  }, []);

  return (
    <ShopDetailsContext.Provider value={{ shop, loading, error }}>
      {children}
    </ShopDetailsContext.Provider>
  );
};

export const useShopDetails = () => useContext(ShopDetailsContext);
