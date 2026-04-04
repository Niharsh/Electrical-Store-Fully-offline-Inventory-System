import api from './api';

/**
 * ⚠️ API SERVICE CONTRACTS - GENERIC Electrical STORE INVENTORY
 * 
 * This service defines the contract between frontend and backend for a flexible,
 * product-type-agnostic inventory system. Supports tablets, syrups, powders, 
 * creams, diapers, condoms, sachets, and more.
 * 
 * Frontend does NOT:
 * - Calculate values (totals, subtotals, taxes)
 * - Enforce business rules
 * - Validate quantities or availability
 * - Transform data
 * - Apply product-type-specific logic
 * 
 * Backend MUST:
 * - Handle all calculations
 * - Return complete, ready-to-display data
 * - Validate all business rules
 * - Support flexible product types via product_type field
 * 
 * See API_CONTRACTS.md for detailed endpoint specifications.
 */

// ============ PRODUCTS ============

export const productService = {
  /**
   * GET /api/products/
   * 
   * Expected Response (DRF Paginated):
   * {
   *   "count": number,
   *   "next": string | null,
   *   "previous": string | null,
   *   "results": [{ 
   *     id, name, product_type, generic_name, manufacturer, 
   *     price, quantity, unit, description, created_at, updated_at 
   *   }]
   * }
   * 
   * @param {Object} params - Query parameters (search, quantity__lt, product_type, page, etc.)
   * @returns {Promise<Object>} Paginated product list
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/products/', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  },

  /**
   * GET /api/products/{id}/
   * 
   * Expected Response:
   * { id, name, product_type, generic_name, manufacturer, salt_composition, price, quantity, unit, description, created_at, updated_at }
   * 
   * @param {number} id - Product ID
   * @returns {Promise<Object>} Product details
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/products/${id}/`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch product ${id}: ${error.message}`);
    }
  },

  /**
   * POST /api/products/
   * 
   * Request Body: { name, product_type, generic_name, manufacturer, salt_composition, price, quantity, unit, description }
   * Expected Response: 201 Created with full product object
   * 
   * Backend Validates:
   * - name: required, unique, max 255 chars
   * - product_type: required, one of [tablet, syrup, powder, cream, diaper, condom, sachet]
   * - price: >= 0
   * - quantity: >= 0
   * - unit: flexible per product (pc, bottle, gm, ml, etc.)
   * - salt_composition: optional (max 500 chars), mainly for tablets/capsules. E.g., 'Paracetamol 500mg'
   * 
   * @param {Object} productData - Product to create (must include product_type)
   * @returns {Promise<Object>} Created product with ID
   */
  create: async (productData) => {
    try {
      const response = await api.post('/products/', productData);
      return response.data;
    } catch (error) {
      throw error; // Return backend validation errors as-is
    }
  },

  /**
   * PATCH /api/products/{id}/
   * 
   * Request Body: Partial product object (any fields can be updated)
   * Expected Response: 200 OK with updated product
   * 
   * @param {number} id - Product ID
   * @param {Object} productData - Fields to update
   * @returns {Promise<Object>} Updated product
   */
  update: async (id, productData) => {
    try {
      const response = await api.patch(`/products/${id}/`, productData);
      return response.data;
    } catch (error) {
      throw error; // Return backend validation errors as-is
    }
  },

  /**
   * DELETE /api/products/{id}/
   * 
   * Expected Response: 204 No Content
   * 
   * @param {number} id - Product ID
   */
  delete: async (id) => {
    try {
      await api.delete(`/products/${id}/`);
    } catch (error) {
      throw error;
    }
  },

  /**
   * GET /api/products/?quantity__lt=threshold
   * 
   * Frontend does NOT handle low stock logic.
   * This is a convenience filter that delegates to the backend.
   * 
   * @param {number} threshold - Stock level threshold
   * @returns {Promise<Object>} Paginated list of low stock products
   */
  getLowStock: async (threshold = 10) => {
    try {
      const response = await api.get('/products/', {
        params: { quantity__lt: threshold }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

// ============ BATCH MANAGEMENT ============

export const batchService = {
  /**
   * GET /api/batches/
   * 
   * Expected Response (DRF Paginated):
   * { count, next, previous, results: [{ id, product, batch_number, quantity, expiry_date, manufactured_date, price }] }
   * 
   * @param {Object} params - Query filters
   * @returns {Promise<Object>} Paginated batch list
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/batches/', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * GET /api/batches/?product={productId}
   * 
   * Backend filters by product ID.
   * 
   * @param {number} productId - Product ID
   * @returns {Promise<Object>} Batches for this product
   */
  getByProduct: async (productId) => {
    try {
      const response = await api.get('/batches/', {
        params: { product: productId }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * POST /api/batches/
   * 
   * Request: { product, batch_number, quantity, expiry_date, manufactured_date, price }
   * Response: 201 Created with batch object
   * 
   * Backend Validates:
   * - batch_number: required, unique
   * - quantity: > 0
   * - expiry_date >= manufactured_date
   * - price >= 0
   * 
   * @param {Object} batchData - Batch to create
   * @returns {Promise<Object>} Created batch
   */
  create: async (batchData) => {
    try {
      const response = await api.post('/batches/', batchData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * PATCH /api/batches/{id}/
   * 
   * @param {number} id - Batch ID
   * @param {Object} batchData - Fields to update
   * @returns {Promise<Object>} Updated batch
   */
  update: async (id, batchData) => {
    try {
      const response = await api.patch(`/batches/${id}/`, batchData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * DELETE /api/batches/{id}/
   * 
   * @param {number} id - Batch ID
   */
  delete: async (id) => {
    try {
      await api.delete(`/batches/${id}/`);
    } catch (error) {
      throw error;
    }
  },

  /**
   * GET /api/batches/?expiry_date__lt={date}
   * 
   * Backend filters expiring batches.
   * 
   * @param {number} daysThreshold - Days until expiry
   * @returns {Promise<Object>} Expiring batches
   */
  getExpiring: async (daysThreshold = 30) => {
    try {
      const daysFromNow = new Date();
      daysFromNow.setDate(daysFromNow.getDate() + daysThreshold);
      
      const response = await api.get('/batches/', {
        params: { expiry_date__lt: daysFromNow.toISOString().split('T')[0] }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

// ============ INVOICES/BILLS ============

export const invoiceService = {
  /**
   * GET /api/invoices/
   * 
   * Expected Response (DRF Paginated):
   * { count, next, previous, results: [{ id, customer_name, customer_phone, total_amount, notes, created_at, updated_at }] }
   * 
   * Note: total_amount is calculated by the backend from invoice items.
   * Frontend does NOT calculate totals.
   * 
   * @param {Object} params - Query filters
   * @returns {Promise<Object>} Paginated invoice list
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/invoices/', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * GET /api/invoices/{id}/
   * 
   * Expected Response:
   * {
   *   id, customer_name, customer_phone, total_amount, notes,
   *   items: [{ id, product, product_name, quantity, unit_price, subtotal }],
   *   created_at, updated_at
   * }
   * 
   * Note: Backend includes product_name and calculated subtotal for display.
   * 
   * @param {number} id - Invoice ID
   * @returns {Promise<Object>} Invoice with items
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/invoices/${id}/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * POST /api/invoices/
   * 
   * Request:
   * {
   *   customer_name: string (required),
   *   customer_phone: string (optional),
   *   notes: string (optional),
   *   items: [
   *     { product: number, quantity: number, unit_price: string }
   *   ]
   * }
   * 
   * Response: 201 Created
   * {
   *   id, customer_name, customer_phone, total_amount, notes,
   *   items: [{ id, product, quantity, unit_price, subtotal }],
   *   created_at, updated_at
   * }
   * 
   * Backend Responsibilities:
   * - Create invoice and items in transaction
   * - Validate product IDs exist
   * - Validate quantities > 0
   * - Calculate total_amount and subtotals
   * - Check stock (if applicable)
   * 
   * Frontend Responsibility:
   * - Only validate form input (required fields, data types)
   * - Pass user input as-is to backend
   * - Display the returned total_amount (do NOT calculate it)
   * 
   * @param {Object} invoiceData - Invoice with items
   * @returns {Promise<Object>} Created invoice with calculated totals
   */
  create: async (invoiceData) => {
    try {
      const response = await api.post('/invoices/', invoiceData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * PATCH /api/invoices/{id}/
   * 
   * Update invoice metadata (customer_name, notes, etc.)
   * Do NOT use this to update items - use invoice-items endpoints instead.
   * 
   * @param {number} id - Invoice ID
   * @param {Object} invoiceData - Fields to update
   * @returns {Promise<Object>} Updated invoice
   */
  update: async (id, invoiceData) => {
    try {
      const response = await api.patch(`/invoices/${id}/`, invoiceData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * DELETE /api/invoices/{id}/
   * 
   * @param {number} id - Invoice ID
   */
  delete: async (id) => {
    try {
      await api.delete(`/invoices/${id}/`);
    } catch (error) {
      throw error;
    }
  },

  /**
   * POST /api/invoices/{id}/items/
   * 
   * Add item to existing invoice.
   * Backend recalculates total_amount.
   * 
   * Request: { product, quantity, unit_price }
   * Response: 201 Created with item
   * 
   * @param {number} invoiceId - Invoice ID
   * @param {Object} itemData - Item to add
   * @returns {Promise<Object>} Created item
   */
  addItem: async (invoiceId, itemData) => {
    try {
      const response = await api.post(`/invoices/${invoiceId}/items/`, itemData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * DELETE /api/invoices/{id}/items/{itemId}/
   * 
   * Remove item from invoice.
   * Backend recalculates total_amount.
   * 
   * @param {number} invoiceId - Invoice ID
   * @param {number} itemId - Item ID to remove
   */
  removeItem: async (invoiceId, itemId) => {
    try {
      await api.delete(`/invoices/${invoiceId}/items/${itemId}/`);
    } catch (error) {
      throw error;
    }
  },
};

// ============ INVOICE ITEMS ============

export const invoiceItemService = {
  /**
   * GET /api/invoice-items/?invoice={invoiceId}
   * 
   * Backend filters items by invoice.
   * 
   * @param {number} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice items
   */
  getByInvoice: async (invoiceId) => {
    try {
      const response = await api.get('/invoice-items/', {
        params: { invoice: invoiceId }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * PATCH /api/invoice-items/{id}/
   * 
   * Update item quantity/price.
   * Backend recalculates parent invoice total_amount.
   * 
   * Request: { quantity, unit_price } (or both)
   * Response: Updated item with subtotal
   * 
   * @param {number} id - Item ID
   * @param {Object} itemData - Fields to update
   * @returns {Promise<Object>} Updated item with subtotal
   */
  update: async (id, itemData) => {
    try {
      const response = await api.patch(`/invoice-items/${id}/`, itemData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * DELETE /api/invoice-items/{id}/
   * 
   * Backend recalculates parent invoice total_amount.
   * 
   * @param {number} id - Item ID
   */
  delete: async (id) => {
    try {
      await api.delete(`/invoice-items/${id}/`);
    } catch (error) {
      throw error;
    }
  },
};

export default {
  productService,
  batchService,
  invoiceService,
  invoiceItemService,
};
