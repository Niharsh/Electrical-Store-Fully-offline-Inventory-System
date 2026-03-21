import React, { createContext, useContext, useState, useCallback } from 'react';
import { productService } from '../services/medicineService';

// ✅ REMOVED: DEFAULT_PRODUCT_TYPES constant — product types fully removed

/**
 * ProductContext - Manages state for Ojashwai Electricals inventory
 *
 * Handles: products, batches, HSN codes
 * Backend is responsible for: stock management, data persistence
 * Frontend: calls IPC to fetch/create/update/delete products and HSN codes
 */
const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
  const [products, setProducts]   = useState([]);
  // ✅ REMOVED: productTypes state
  const [hsns, setHSNs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // Fetch all products
  const fetchProducts = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      if (window?.api?.getProducts) {
        const response = await window.api.getProducts();
        const productList = Array.isArray(response.data)
          ? response.data
          : response.data.results || [];
        console.log('📥 ProductContext.fetchProducts: Fetched', productList.length, 'products:', productList);
        setProducts(productList);
      } else {
        throw new Error('window.api.getProducts is not available');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch products');
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add product
  const addProduct = useCallback(async (productData) => {
    try {
      setError(null);
      if (window?.api?.addProduct) {
        const response = await window.api.addProduct(productData);

        if (!response || !response.data) {
          throw new Error('Invalid response: missing product data');
        }

        const newProduct = response.data;

        if (!newProduct || !newProduct.id || !newProduct.name) {
          console.error('INVALID PRODUCT:', newProduct);
          throw new Error('Incomplete product data returned from server');
        }

        if (!Array.isArray(newProduct.batches)) {
          newProduct.batches = [];
        }
        if (newProduct.gst_rate === undefined) {
          newProduct.gst_rate = null;
        }

        console.log('Adding product to state:', {
          id: newProduct.id,
          name: newProduct.name,
          batches: newProduct.batches.length,
        });

        setProducts(prevProducts => {
          const filtered = prevProducts.filter(p => p && p.id && p.name);
          return [...filtered, newProduct];
        });

        return newProduct;
      } else {
        throw new Error('window.api.addProduct is not available');
      }
    } catch (err) {
      console.error('ProductContext.addProduct error:', err);
      setError(err.message || 'Failed to add product');
      throw err;
    }
  }, []);

  // Update product
  const updateProduct = useCallback(async (id, payload) => {
    try {
      setError(null);

      if (!window?.api?.updateProduct) {
        throw new Error('window.api.updateProduct not available');
      }

      const response = await window.api.updateProduct(id, payload);
      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to update product');
      }

      const updatedProduct = response.data;
      setProducts(prev => prev.map(p => (p.id === id ? updatedProduct : p)));

      console.log('✅ ProductContext.updateProduct: updated', updatedProduct);
      return updatedProduct;
    } catch (err) {
      const message = err.message || 'Failed to update product';
      setError(message);
      console.error('❌ ProductContext.updateProduct error:', err);
      throw err;
    }
  }, []);

  // Delete product
  const deleteProduct = useCallback(async (id) => {
    try {
      setError(null);

      if (!window?.api?.deleteProduct) {
        throw new Error('window.api.deleteProduct not available');
      }

      const response = await window.api.deleteProduct(id);
      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to delete product');
      }

      setProducts(prevProducts => prevProducts.filter(p => p.id !== id));
      console.log('✅ ProductContext.deleteProduct: Product', id, 'deleted successfully');
    } catch (err) {
      const message = err.message || 'Failed to delete product';
      setError(message);
      console.error('❌ ProductContext.deleteProduct: Failed to delete product', id, err);
      throw err;
    }
  }, []);

  // Get low stock products
  const getLowStock = useCallback(async (threshold = 10) => {
    try {
      return await productService.getLowStock(threshold);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      throw err;
    }
  }, []);

  // ✅ REMOVED: fetchProductTypes function
  // ✅ REMOVED: addProductType function
  // ✅ REMOVED: deleteProductType function

  // Fetch all HSN codes
  const fetchHSNs = useCallback(async () => {
    try {
      if (!window?.api?.getHSNCodes) {
        throw new Error('window.api.getHSNCodes not available');
      }

      const response = await window.api.getHSNCodes();
      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to fetch HSN codes');
      }

      const codes = response.data || [];
      setHSNs(codes);
      return codes;
    } catch (err) {
      console.error('[ProductContext] Failed to fetch HSN codes:', err);
      setError(err.message);
      return [];
    }
  }, []);

  // Add a new HSN code
  const addHSN = useCallback(async (hsnData) => {
    try {
      if (!window?.api?.addHSNCode) {
        throw new Error('window.api.addHSNCode not available');
      }

      const response = await window.api.addHSNCode(hsnData);
      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to add HSN code');
      }

      const newHSN = response.data;
      setHSNs(prevHSNs => [...prevHSNs, newHSN]);
      return newHSN;
    } catch (err) {
      const message = err.message || 'Failed to add HSN code';
      setError(message);
      throw err;
    }
  }, []);

  // Update an HSN code
  const updateHSN = useCallback(async (hsnCode, hsnData) => {
    try {
      if (!window?.api?.updateHSNCode) {
        throw new Error('window.api.updateHSNCode not available');
      }

      const response = await window.api.updateHSNCode(hsnCode, hsnData);
      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to update HSN code');
      }

      const updatedHSN = response.data;
      setHSNs(prevHSNs =>
        prevHSNs.map(h => h.hsn_code === hsnCode ? updatedHSN : h)
      );
      return updatedHSN;
    } catch (err) {
      const message = err.message || 'Failed to update HSN code';
      setError(message);
      throw err;
    }
  }, []);

  // Delete an HSN code
  const deleteHSN = useCallback(async (hsnCode) => {
    try {
      if (!window?.api?.deleteHSNCode) {
        throw new Error('window.api.deleteHSNCode not available');
      }

      const response = await window.api.deleteHSNCode(hsnCode);
      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to delete HSN code');
      }

      setHSNs(prevHSNs => prevHSNs.filter(h => h.hsn_code !== hsnCode));
    } catch (err) {
      const message = err.message || 'Failed to delete HSN code';
      setError(message);
      throw err;
    }
  }, []);

  const value = {
    products,
    // ✅ REMOVED: productTypes
    hsns,
    loading,
    error,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getLowStock,
    // ✅ REMOVED: fetchProductTypes
    // ✅ REMOVED: addProductType
    // ✅ REMOVED: deleteProductType
    fetchHSNs,
    addHSN,
    updateHSN,
    deleteHSN,
  };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProducts must be used within ProductProvider');
  }
  return context;
};