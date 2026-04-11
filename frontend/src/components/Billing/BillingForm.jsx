import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvoices } from '../../context/InvoiceContext';
import { useProducts } from '../../context/ProductContext';
import ErrorAlert from '../Common/ErrorAlert';

// Remark Box inline edit component
const RemarkBox = ({ remark, onSave }) => {
  const [editing,  setEditing]  = useState(false);
  const [value,    setValue]    = useState(remark);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    setValue(remark);
    setEditing(false);
  }, [remark]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } catch (err) {
      console.error('RemarkBox save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      marginBottom: '24px',
      padding:      '14px 16px',
      background:   '#fffbeb',
      border:       '1px solid #f59e0b',
      borderRadius: '8px',
    }}>
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '8px',
        marginBottom: editing ? '10px' : '6px',
      }}>
        <span style={{ fontSize: '18px' }}>📋</span>
        <span style={{
          fontWeight: 700,
          fontSize:   '13px',
          color:      '#92400e',
          flex:       1,
        }}>
          Customer Remark
        </span>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              background:   'none',
              border:       '1px solid #d97706',
              borderRadius: '4px',
              padding:      '2px 10px',
              fontSize:     '12px',
              color:        '#92400e',
              cursor:       'pointer',
            }}
          >
            ✏️ Edit
          </button>
        )}
      </div>
      {!editing && (
        <div style={{
          fontSize: '13px',
          color:    '#78350f',
          minHeight: '20px',
        }}>
          {remark
            ? remark
            : <span style={{ color: '#b45309', fontStyle: 'italic' }}>
                No remark yet — click Edit to add one
              </span>
          }
        </div>
      )}
      {editing && (
        <div>
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Enter remark for this customer..."
            style={{
              width:        '100%',
              padding:      '8px 10px',
              border:       '1px solid #f59e0b',
              borderRadius: '6px',
              fontSize:     '13px',
              resize:       'vertical',
              background:   '#fff',
              outline:      'none',
              marginBottom: '8px',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                background:   '#d97706',
                color:        '#fff',
                border:       'none',
                borderRadius: '5px',
                padding:      '5px 16px',
                fontSize:     '12px',
                fontWeight:   700,
                cursor:       'pointer',
              }}
            >
              {saving ? 'Saving...' : '✅ Save Remark'}
            </button>
            <button
              type="button"
              onClick={() => { setValue(remark); setEditing(false); }}
              style={{
                background:   '#f3f4f6',
                color:        '#374151',
                border:       '1px solid #d1d5db',
                borderRadius: '5px',
                padding:      '5px 16px',
                fontSize:     '12px',
                cursor:       'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const BillingForm = ({ onBillingComplete }) => {
  // ── Edit-mode detection ──────────────────────────────────────────
  const { id: invoiceId } = useParams();          // present on /billing/invoices/:id/edit
  const isEditMode       = Boolean(invoiceId);
  const navigate         = useNavigate();

  // ── Context ──────────────────────────────────────────────────────
  const { createInvoice, error: invoiceError } = useInvoices();
  const { products, fetchProducts }            = useProducts();

  // ── State ────────────────────────────────────────────────────────
  const [formError,            setFormError]            = useState('');
  const [loading,              setLoading]              = useState(false);
  const [editLoading,          setEditLoading]          = useState(false); // loading existing invoice
  const [billItems,            setBillItems]            = useState([]);
  const [customers,            setCustomers]            = useState([]);
  const [selectedCustomerId,   setSelectedCustomerId]   = useState(null);
  const [customerSearchText,   setCustomerSearchText]   = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerRemark,       setCustomerRemark]       = useState('');
  const [saveCustomerDetails,  setSaveCustomerDetails]  = useState(false);
  const [invoiceNumber,        setInvoiceNumber]        = useState('');
  const [globalDiscount,      setGlobalDiscount]      = useState(0);
  const [manualDiscountItems, setManualDiscountItems] = useState(new Set());
  const [addlDiscountValue, setAddlDiscountValue] = useState('');
  const [addlDiscountType,  setAddlDiscountType]  = useState('amount'); // 'amount' or 'percent'

  const [formData, setFormData] = useState({
    customer_name:    '',
    customer_phone:   '',
    customer_address: '',
    bill_to_gstin:    '',
    bill_to_state:    '',
    ship_same_as_bill: true,
    ship_to_name:    '',
    ship_to_phone:   '',
    ship_to_address: '',
    ship_to_gstin:   '',
    ship_to_state:   '',
    place_of_supply: '',
    eway_bill_no:    '',
    notes:           '',
    discount_percent: '',
    tax_type:        'gst',
  });

  // ── Load products ────────────────────────────────────────────────
  useEffect(() => {
    console.log('📋 BillingForm useEffect: products.length =', products.length);
    if (products.length === 0) {
      console.log('📋 BillingForm: Calling fetchProducts...');
      fetchProducts();
    }
  }, [products, fetchProducts]);

  // ── Load all customers for dropdown ─────────────────────────────
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        if (!window?.api?.getAllCustomers) return;
        const response = await window.api.getAllCustomers();
        if (response.success) {
          setCustomers(response.data || []);
        }
      } catch (err) {
        console.error('❌ BillingForm: Error loading customers:', err);
      }
    };
    loadCustomers();
  }, []);

  // ── Load next invoice number (CREATE mode only) ──────────────────
  useEffect(() => {
    if (isEditMode) return; // edit mode keeps the existing invoice number
    const loadInvoiceNumber = async () => {
      try {
        if (!window?.api?.getNextInvoiceNumber) return;
        const response = await window.api.getNextInvoiceNumber();
        if (response.success) {
          setInvoiceNumber(response.invoice_number || '');
        }
      } catch (err) {
        console.error('BillingForm: Error fetching next invoice number', err);
      }
    };
    loadInvoiceNumber();
  }, [isEditMode]);

  // ── EDIT MODE: load existing invoice and pre-fill all fields ─────
  useEffect(() => {
    if (!isEditMode) return;

    const loadInvoice = async () => {
      setEditLoading(true);
      try {
        const res = await window.api.getInvoiceById(Number(invoiceId));

        if (!res.success || !res.data) {
          alert('Failed to load invoice for editing');
          navigate('/billing');
          return;
        }

        const inv = res.data;
        console.log('✅ BillingForm EDIT: loaded invoice', inv.invoice_number);

        // ── Pre-fill invoice number ──
        setInvoiceNumber(inv.invoice_number || '');

        // ── Pre-fill customer search box ──
        setCustomerSearchText(inv.customer_name || '');
        setSelectedCustomerId(inv.customer_id || null);

        // ── Pre-fill formData ──
        setFormData({
          customer_name:    inv.customer_name    || '',
          customer_phone:   inv.customer_phone   || '',
          customer_address: inv.customer_address || '',
          bill_to_gstin:    inv.bill_to_gstin    || '',
          bill_to_state:    inv.bill_to_state    || '',
          ship_same_as_bill: inv.ship_same_as_bill === 1 || inv.ship_same_as_bill === true,
          ship_to_name:    inv.ship_to_name    || '',
          ship_to_phone:   inv.ship_to_phone   || '',
          ship_to_address: inv.ship_to_address || '',
          ship_to_gstin:   inv.ship_to_gstin   || '',
          ship_to_state:   inv.ship_to_state   || '',
          place_of_supply: inv.place_of_supply || '',
          eway_bill_no:    inv.eway_bill_no    || '',
          notes:           inv.notes           || '',
          discount_percent: inv.discount_percent != null ? String(inv.discount_percent) : '',
          tax_type:        inv.tax_type        || 'gst',
        });

        // ── Pre-fill items ──
        const mappedItems = (inv.items || []).map(item => ({
          product_id:            item.product_id    ? String(item.product_id) : '',
          batch_number:          item.batch_number  || '',
          quantity:              item.quantity      != null ? String(item.quantity) : '',
          original_selling_rate: item.original_selling_rate != null
                                   ? String(item.original_selling_rate)
                                   : String(item.selling_rate || ''),
          selling_rate:          item.selling_rate  != null ? String(item.selling_rate) : '',
          mrp:                   item.mrp           != null ? String(item.mrp) : '',
          hsn_code:              item.hsn_code      || '',
          expiry_date:           item.expiry_date   || '',
          discount_percent:      item.discount_percent != null ? String(item.discount_percent) : '0',
          discount_pct:          item.discount_percent != null ? String(item.discount_percent) : '0', // for backward compatibility
          gst_percent:           item.gst_percent   != null ? String(item.gst_percent) : '',
          is_return:             item.is_return === 1 || item.is_return === true,
          return_reason:         item.return_reason || '',
        }));

        setBillItems(mappedItems);
        console.log('✅ BillingForm EDIT: pre-filled', mappedItems.length, 'items');

        // Pre-fill additional discount
        setAddlDiscountValue(
          inv.additional_discount_amount
            ? String(inv.additional_discount_amount)
            : ''
        );
        setAddlDiscountType(inv.additional_discount_type || 'amount');

      } catch (err) {
        console.error('❌ BillingForm EDIT: error loading invoice:', err);
        alert('Error loading invoice for editing');
        navigate('/billing');
      } finally {
        setEditLoading(false);
      }
      setManualDiscountItems(
        new Set(mappedItems.map((_, i) => i))
      );
    };

    loadInvoice();
  }, [invoiceId, isEditMode, navigate]);

  // ── Customer selection ───────────────────────────────────────────
  const handleCustomerSelect = (customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearchText(customer.customer_name);
    setShowCustomerDropdown(false);

    const ship_to_name     = customer.ship_to_name || customer.customer_name;
    const ship_same_as_bill = !customer.ship_to_name || ship_to_name === customer.customer_name;

    const customerDiscount = parseFloat(customer.discount) || 0;
    setGlobalDiscount(customerDiscount);

    // Show customer remark if exists
    setCustomerRemark(customer.notes || '');

    
  setFormData(prev => ({          // ← use prev to read existing notes
    customer_name:    customer.customer_name   || '',
    customer_phone:   customer.phone_number    || '',
    customer_address: customer.bill_to_address || '',
    bill_to_gstin:    customer.bill_to_gstin   || '',
    bill_to_state:    customer.bill_to_state   || '',
    ship_same_as_bill,
    ship_to_name:    customer.ship_to_name    || '',
    ship_to_phone:   customer.ship_to_phone   || '',
    ship_to_address: customer.ship_to_address || '',
    ship_to_gstin:   customer.ship_to_gstin   || '',
    ship_to_state:   customer.ship_to_state   || '',
    place_of_supply: '',
    eway_bill_no:    '',
    notes:           prev.notes,  // ← FIXED: preserve whatever user typed
    discount_percent: customer.discount || '',
    tax_type:        customer.tax_type  || 'gst',
  }));  
  };

  const handleCustomerSearch = (text) => {
    setCustomerSearchText(text);
    setShowCustomerDropdown(true);
    if (text === '') setSelectedCustomerId(null);
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId(null);
    setCustomerSearchText('');
    setShowCustomerDropdown(false);
    setCustomerRemark('');
    setAddlDiscountValue('');
    setAddlDiscountType('amount');
    setFormData({
      customer_name:    '',
      customer_phone:   '',
      customer_address: '',
      bill_to_gstin:    '',
      bill_to_state:    '',
      ship_same_as_bill: true,
      ship_to_name:    '',
      ship_to_phone:   '',
      ship_to_address: '',
      ship_to_gstin:   '',
      ship_to_state:   '',
      place_of_supply: '',
      eway_bill_no:    '',
      notes:           '',
      discount_percent: '',
      tax_type:        'gst',
    });
  };

  // ── Global discount change handler ─────────────────────────────────
  const handleGlobalDiscountChange = (value) => {
    const newGlobal = parseFloat(value) || 0;
    setGlobalDiscount(newGlobal);

    setFormData(prev => ({ ...prev, discount_percent: value }));

    // Only update items NOT manually overridden
    setBillItems(prev =>
      prev.map((item, index) => {
        if (manualDiscountItems.has(index)) return item; // protected

        const mrp = parseFloat(item.mrp) || 0;
        if (!mrp) return { ...item, discount_pct: newGlobal }; // no MRP yet, just store

        const newRate = parseFloat((mrp * (1 - newGlobal / 100)).toFixed(2));
        return {
          ...item,
          discount_pct:  newGlobal,
          selling_rate:  String(newRate),
        };
      })
    );
  };

  // ── Individual item discount change handler ─────────────────────────────
  const handleItemDiscountChange = (index, value) => {
    const disc = parseFloat(value) || 0;

    // Mark this item as manually overridden
    setManualDiscountItems(prev => new Set([...prev, index]));

    setBillItems(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const mrp     = parseFloat(item.mrp) || 0;
        const newRate = parseFloat((mrp * (1 - disc / 100)).toFixed(2));
        return {
          ...item,
          discount_pct: disc,
          selling_rate: String(newRate),
        };
      })
    );
  };

  const filteredCustomers = customerSearchText
    ? customers.filter(c =>
        c.customer_name.toLowerCase().includes(customerSearchText.toLowerCase()) ||
        (c.phone_number && c.phone_number.includes(customerSearchText))
      )
    : customers;

  // ── Item helpers ─────────────────────────────────────────────────
  const handleAddItem = () => {
    setBillItems(prev => [
      ...prev,
      {
        product_id:            '',
        batch_number:          '',
        quantity:              '',
        original_selling_rate: '',
        selling_rate:          '',   // calculated, not entered
        mrp:                   '',   // readonly, from batch
        hsn_code:              '',
        discount_pct:          globalDiscount,  // prefilled from global
        gst_percent:           '',
        is_return:             false,
        return_reason:         '',
      }
    ]);
    // new items are NOT added to manualDiscountItems — follow global
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...billItems];
    updatedItems[index][field] = value;

    if (field === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === parseInt(value));
      if (selectedProduct?.batches?.length > 0) {
        const firstBatch = selectedProduct.batches.find(b => b.quantity > 0)
                        || selectedProduct.batches[0];

        const mrp      = parseFloat(firstBatch.mrp) || 0;
        const disc     = manualDiscountItems.has(index)
                           ? (updatedItems[index].discount_pct ?? globalDiscount)
                           : globalDiscount;
        const calcRate = parseFloat((mrp * (1 - disc / 100)).toFixed(2));

        updatedItems[index].batch_number          = firstBatch.batch_number;
        updatedItems[index].mrp                   = String(mrp);
        updatedItems[index].original_selling_rate = String(calcRate);
        updatedItems[index].selling_rate          = String(calcRate);
        updatedItems[index].discount_pct          = disc;
        updatedItems[index].hsn_code              = selectedProduct.hsn || '';
        updatedItems[index].gst_percent           = String(selectedProduct.gst_rate || '');
      } else {
        updatedItems[index].batch_number          = '';
        updatedItems[index].mrp                   = '';
        updatedItems[index].original_selling_rate = '';
        updatedItems[index].selling_rate          = '';
        updatedItems[index].hsn_code              = '';
        updatedItems[index].gst_percent           = '';
      }
    }

    if (field === 'batch_number' && updatedItems[index].product_id) {
      const selectedProduct = products.find(
        p => p.id === parseInt(updatedItems[index].product_id)
      );
      if (selectedProduct?.batches) {
        const batch = selectedProduct.batches.find(b => b.batch_number === value);
        if (batch) {
          const mrp      = parseFloat(batch.mrp) || 0;
          const disc     = manualDiscountItems.has(index)
                             ? (updatedItems[index].discount_pct ?? globalDiscount)
                             : globalDiscount;
          const calcRate = parseFloat((mrp * (1 - disc / 100)).toFixed(2));

          updatedItems[index].mrp                   = String(mrp);
          updatedItems[index].original_selling_rate = String(calcRate);
          updatedItems[index].selling_rate          = String(calcRate);
          updatedItems[index].discount_pct          = disc;
        }
      }
    }

    setBillItems(updatedItems);
  };

  const handleRemoveItem = (index) => {
    setBillItems(prev => prev.filter((_, i) => i !== index));

    // Rebuild Set with shifted indexes
    setManualDiscountItems(prev => {
      const updated = new Set();
      prev.forEach(i => {
        if (i < index)  updated.add(i);
        if (i > index)  updated.add(i - 1); // shift down
      });
      return updated;
    });
  };

  // ── Build payload (shared between create and update) ─────────────
  const buildPayload = () => {
    const ship_to_data = formData.ship_same_as_bill
      ? {
          ship_to_name:    formData.customer_name,
          ship_to_phone:   formData.customer_phone,
          ship_to_address: formData.customer_address,
          ship_to_gstin:   formData.bill_to_gstin,
          ship_to_state:   formData.bill_to_state,
        }
      : {
          ship_to_name:    formData.ship_to_name,
          ship_to_phone:   formData.ship_to_phone,
          ship_to_address: formData.ship_to_address,
          ship_to_gstin:   formData.ship_to_gstin,
          ship_to_state:   formData.ship_to_state,
        };

    return {
      customer_name:    formData.customer_name,
      customer_phone:   formData.customer_phone   || '',
      customer_address: formData.customer_address || '',
      bill_to_name:     formData.customer_name,      // mirrors customer name
      bill_to_phone:    formData.customer_phone  || '',
      bill_to_gstin:    formData.bill_to_gstin   || '',
      bill_to_state:    formData.bill_to_state   || '',
      ship_same_as_bill: formData.ship_same_as_bill,
      ...ship_to_data,
      place_of_supply: formData.place_of_supply || '',
      eway_bill_no:    formData.eway_bill_no     || '',
      notes:           formData.notes           || '',
      invoice_number:  invoiceNumber,
      discount_percent: parseFloat(formData.discount_percent) || 0,
      tax_type:        formData.tax_type         || 'gst',
      customer_id:     selectedCustomerId        || null,
      additional_discount_value: parseFloat(addlDiscountValue) || 0,
      additional_discount_type:  addlDiscountType,
      items: billItems.map(item => ({
        product_id:            parseInt(item.product_id),
        batch_number:          item.batch_number,
        quantity:              parseInt(item.quantity),
        original_selling_rate: parseFloat(item.original_selling_rate),
        selling_rate:          parseFloat(item.selling_rate),
        mrp:                   parseFloat(item.mrp)  || null,
        hsn_code:              item.hsn_code         || '',
        expiry_date:           item.expiry_date      || '',
        discount_percent:      parseFloat(item.discount_pct) || 0,
        gst_percent:           parseFloat(item.gst_percent)      || 0,
        is_return:             item.is_return  || false,
        return_reason:         item.return_reason || '',
      })),
    };
  };

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setLoading(true);

    try {
      // ── Validation (same for both modes) ──
      if (!formData.customer_name) throw new Error('Customer name is required');
      if (billItems.length === 0)  throw new Error('Add at least one item to the bill');

      for (let i = 0; i < billItems.length; i++) {
        const item = billItems[i];
        if (!item.product_id || !item.batch_number || !item.quantity) {
          throw new Error(`Item ${i + 1} is missing required fields (product, batch, quantity)`);
        }
        if (parseInt(item.quantity) <= 0) {
          throw new Error(`Item ${i + 1}: Quantity must be greater than 0`);
        }
        if (!item.mrp || parseFloat(item.mrp) <= 0) {
          throw new Error(`Item ${i + 1}: MRP is missing. Re-select the product.`);
        }
      }

      const payload = buildPayload();

      // ════════════════════════════════════════════════════
      //  EDIT MODE
      // ════════════════════════════════════════════════════
      if (isEditMode) {
      const res = await window.api.updateInvoice(Number(invoiceId), payload);

      if (!res.success) {
        throw new Error(res.message || res.error || 'Failed to update invoice');
      }
    
      console.log('✅ BillingForm EDIT: Invoice updated successfully');
    
      // Use REPLACE instead of PUSH so edit page is removed from history stack
      // Back from invoice view will go to invoice list, not back to edit
      navigate(`/billing/invoices/${invoiceId}`, { replace: true });
      return;
    }

      // ════════════════════════════════════════════════════
      //  CREATE MODE  (original logic — unchanged)
      // ════════════════════════════════════════════════════
      console.log('📤 BillingForm CREATE: Sending invoice payload');
      const newInvoice = await createInvoice(payload);
      console.log('✅ BillingForm CREATE: Invoice created successfully:', newInvoice);

      // Save customer details if checkbox is checked
      if (saveCustomerDetails && formData.customer_name) {
        try {
          const customerData = {
            customer_name:   formData.customer_name,
            phone_number:    formData.customer_phone   || null,
            bill_to_address: formData.customer_address || null,
            bill_to_gstin:   formData.bill_to_gstin    || null,
            bill_to_state:   formData.bill_to_state    || null,
            ship_to_name:    formData.ship_same_as_bill ? null : (formData.ship_to_name    || null),
            ship_to_phone:   formData.ship_same_as_bill ? null : (formData.ship_to_phone   || null),
            ship_to_address: formData.ship_same_as_bill ? null : (formData.ship_to_address || null),
            ship_to_gstin:   formData.ship_same_as_bill ? null : (formData.ship_to_gstin   || null),
            ship_to_state:   formData.ship_same_as_bill ? null : (formData.ship_to_state   || null),
            discount:        parseFloat(formData.discount_percent) || 0,
            notes:           formData.notes || '',
          };
          const response = await window.api.saveOrUpdateCustomer(customerData);
          if (response.success) {
            const customersResponse = await window.api.getAllCustomers();
            if (customersResponse.success) setCustomers(customersResponse.data || []);
          }
        } catch (err) {
          console.error('❌ BillingForm: Error saving customer:', err);
        }
      }

      // Reset form
      setBillItems([]);
      setSelectedCustomerId(null);
      setCustomerSearchText('');
      setCustomerRemark('');
      setSaveCustomerDetails(false);
      setAddlDiscountValue('');
      setAddlDiscountType('amount');
      setFormData({
        customer_name:    '',
        customer_phone:   '',
        customer_address: '',
        bill_to_gstin:    '',
        bill_to_state:    '',
        ship_same_as_bill: true,
        ship_to_name:    '',
        ship_to_phone:   '',
        ship_to_address: '',
        ship_to_gstin:   '',
        ship_to_state:   '',
        place_of_supply: '',
        eway_bill_no:    '',
        notes:           '',
        discount_percent: '',
        tax_type:        'gst',
      });

      try {
        if (window?.api?.getNextInvoiceNumber) {
          const nextResp = await window.api.getNextInvoiceNumber();
          if (nextResp.success) setInvoiceNumber(nextResp.invoice_number || '');
        }
      } catch (err) {
        console.error('BillingForm: Error generating next invoice number after save', err);
      }

      await fetchProducts();

      if (onBillingComplete) onBillingComplete(newInvoice);

    } catch (err) {
      console.error('❌ BillingForm: Submit error:', err);

      let errorMessage = isEditMode ? 'Failed to update invoice' : 'Failed to create bill';

      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'object' && !Array.isArray(data)) {
          if (data.items && Array.isArray(data.items)) {
            errorMessage = Array.isArray(data.items[0]) ? data.items[0][0] : data.items[0];
          } else if (data.detail) {
            errorMessage = data.detail;
          } else {
            const key = Object.keys(data)[0];
            if (key) errorMessage = Array.isArray(data[key]) ? data[key][0] : data[key];
          }
        } else if (Array.isArray(data)) {
          errorMessage = data[0] || errorMessage;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setFormError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ── Edit-mode loading screen ─────────────────────────────────────
  if (editLoading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading invoice for editing...</p>
        </div>
      </div>
    );
  }

  // ── JSX ──────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="card">

      {/* ── Page title changes based on mode ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-header-lg">
          {isEditMode ? `✏️ Edit Invoice — ${invoiceNumber}` : 'Create Invoice'}
        </h2>
        {isEditMode && (
          <button
            type="button"
            onClick={() => navigate(`/billing/invoices/${invoiceId}`, { replace: true })}
            className="btn-secondary text-sm px-3 py-1"
          >
            ← Back to Invoice
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="form-group">
          <label className="form-label">Invoice Number</label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="input-field"
            placeholder="OE/2024-25/001"
          />
          <p className="text-xs text-gray-500 mt-1">
            {isEditMode
              ? 'Invoice number is preserved from original.'
              : 'Auto-generated by system. You can edit this value.'}
          </p>
        </div>
      </div>

      {(formError || invoiceError) && (
        <ErrorAlert error={formError || invoiceError} onDismiss={() => setFormError('')} />
      )}

      {/* ── Edit-mode notice banner ── */}
      {isEditMode && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
          <p className="text-amber-800 text-sm font-medium">
            ⚠️ You are editing an existing invoice. Stock will be restored for old items
            and re-deducted for updated items when you save.
          </p>
        </div>
      )}

      {/* Customer Selection Dropdown */}
      <div className="mb-8 p-5 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="form-label">Select Existing Customer</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or phone number..."
                value={customerSearchText}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                onFocus={() => setShowCustomerDropdown(true)}
                className="input-field w-full"
              />
              {showCustomerDropdown && customerSearchText && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => handleCustomerSelect(customer)}
                        className="px-4 py-3 border-b last:border-b-0 hover:bg-blue-50 cursor-pointer"
                      >
                        <div className="font-semibold text-gray-900">{customer.customer_name}</div>
                        {customer.phone_number && (
                          <div className="text-sm text-gray-500">{customer.phone_number}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 text-sm">No customers found</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearCustomer}
            className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded text-sm font-medium"
            title="Clear customer selection and start fresh"
          >
            ✕ Clear
          </button>
        </div>
      </div>

      {/* ── Customer Remark Alert ───────────────────────────────── */}
      {customerRemark !== undefined && selectedCustomerId && (
        <RemarkBox
          remark={customerRemark}
          onSave={(updated) => {
            setCustomerRemark(updated);
            if (selectedCustomerId) {
              window.api.updateCustomer(selectedCustomerId, {
                customer_name:   formData.customer_name,
                phone_number:    formData.customer_phone,
                bill_to_address: formData.customer_address,
                bill_to_gstin:   formData.bill_to_gstin,
                bill_to_state:   formData.bill_to_state,
                ship_to_name:    formData.ship_to_name,
                ship_to_address: formData.ship_to_address,
                ship_to_gstin:   formData.ship_to_gstin,
                ship_to_state:   formData.ship_to_state,
                discount:        formData.discount_percent,
                notes:           updated,
              }).catch(err => console.error('Failed to update remark:', err));
            }
          }}
        />
      )}

      {/* Bill To Information */}
      <h3 className="section-subheader">Bill To Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="form-group">
          <label className="form-label form-label-required">Bill To - Name</label>
          <input
            type="text"
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            className="input-field"
            placeholder="Enter customer name"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input
            type="tel"
            value={formData.customer_phone}
            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
            className="input-field"
            placeholder="Optional"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Bill To - GSTIN</label>
          <input
            type="text"
            value={formData.bill_to_gstin}
            onChange={(e) => setFormData({ ...formData, bill_to_gstin: e.target.value })}
            className="input-field"
            placeholder="e.g., 09ABCDE1234F1Z5"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Bill To - State</label>
          <input
            type="text"
            value={formData.bill_to_state}
            onChange={(e) => setFormData({ ...formData, bill_to_state: e.target.value })}
            className="input-field"
            placeholder="e.g., Uttar Pradesh"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Bill To - Address</label>
          <textarea
            rows={2}
            value={formData.customer_address}
            onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
            className="input-field"
            placeholder="Enter customer address"
          />
        </div>
      </div>

      {/* Save Customer Details Checkbox — hidden in edit mode */}
      {!isEditMode && (
        <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveCustomerDetails}
              onChange={(e) => setSaveCustomerDetails(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">
              Save customer details for future use
            </span>
          </label>
          <p className="text-xs text-gray-600 mt-2 ml-6">
            Customer info will be saved and available in the dropdown for future bills
          </p>
        </div>
      )}

      {/* Ship To Section */}
      <h3 className="section-subheader" style={{ marginTop: '2rem' }}>Ship To Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="form-group mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.ship_same_as_bill}
              onChange={(e) => setFormData({ ...formData, ship_same_as_bill: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">Same as Bill To</span>
          </label>
        </div>
      </div>

      {!formData.ship_same_as_bill && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="form-group">
            <label className="form-label">Ship To - Name</label>
            <input
              type="text"
              value={formData.ship_to_name}
              onChange={(e) => setFormData({ ...formData, ship_to_name: e.target.value })}
              className="input-field"
              placeholder="Enter shipping name"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Ship To - Phone</label>
            <input
              type="text"
              value={formData.ship_to_phone}
              onChange={(e) => setFormData({ ...formData, ship_to_phone: e.target.value })}
              className="input-field"
              placeholder="Enter shipping phone number"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ship To - Address</label>
            <textarea
              rows={2}
              value={formData.ship_to_address}
              onChange={(e) => setFormData({ ...formData, ship_to_address: e.target.value })}
              className="input-field"
              placeholder="Enter shipping address"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ship To - GSTIN</label>
            <input
              type="text"
              value={formData.ship_to_gstin}
              onChange={(e) => setFormData({ ...formData, ship_to_gstin: e.target.value })}
              className="input-field"
              placeholder="e.g., 09ABCDE1234F1Z5"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ship To - State</label>
            <input
              type="text"
              value={formData.ship_to_state}
              onChange={(e) => setFormData({ ...formData, ship_to_state: e.target.value })}
              className="input-field"
              placeholder="e.g., Uttar Pradesh"
            />
          </div>
        </div>
      )}

      {/* Additional Information */}
      <h3 className="section-subheader">Additional Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="form-group">
          <label className="form-label">Place of Supply</label>
          <input
            type="text"
            value={formData.place_of_supply}
            onChange={(e) => setFormData({ ...formData, place_of_supply: e.target.value })}
            className="input-field"
            placeholder="e.g., UTTARPRADESH"
          />
        </div>

        <div className="form-group">
          <label className="form-label">E-Way Bill No</label>
          <input
            type="text"
            value={formData.eway_bill_no}
            onChange={(e) => setFormData({ ...formData, eway_bill_no: e.target.value })}
            className="input-field"
            placeholder="e.g., 123456789012"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="input-field"
            placeholder="Optional notes"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Global Discount (%)
            <span className="text-xs text-gray-500 ml-2 font-normal">
              — applies to new items only
            </span>
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.discount_percent}
            onChange={(e) => handleGlobalDiscountChange(e.target.value)}
            className="input-field"
            placeholder="0"
          />
        </div>

        {/* Additional Discount (Feature 3) */}
        <div className="form-group">
          <label className="form-label">
            Additional Discount
            <span className="text-xs text-gray-500 ml-2 font-normal">
              — applied after subtotal, before tax
            </span>
          </label>
          <div className="flex gap-2">
            {/* Toggle ₹ / % */}
            <div className="flex rounded overflow-hidden border border-gray-300">
              <button
                type="button"
                onClick={() => setAddlDiscountType('amount')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  addlDiscountType === 'amount'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                ₹
              </button>
              <button
                type="button"
                onClick={() => setAddlDiscountType('percent')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  addlDiscountType === 'percent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                %
              </button>
            </div>

            {/* Value input */}
            <input
              type="number"
              min="0"
              step="0.01"
              value={addlDiscountValue}
              onChange={(e) => setAddlDiscountValue(e.target.value)}
              className="input-field flex-1"
              placeholder={addlDiscountType === 'percent' ? 'e.g. 5' : 'e.g. 100'}
            />
          </div>

          {/* Live preview */}
          {addlDiscountValue && parseFloat(addlDiscountValue) > 0 && (
            <p className="text-xs text-green-700 mt-1 font-medium">
              {addlDiscountType === 'percent'
                ? `${addlDiscountValue}% off subtotal`
                : `₹${parseFloat(addlDiscountValue).toFixed(2)} off subtotal`}
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Tax Type</label>
          <select
            value={formData.tax_type}
            onChange={(e) => setFormData({ ...formData, tax_type: e.target.value })}
            className="input-field"
          >
            <option value="gst">GST — CGST + SGST (Intrastate)</option>
            <option value="igst">IGST (Interstate)</option>
            <option value="none">None (No tax)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {formData.tax_type === 'None'
              ? 'No tax will be applied to items. Grand total will be sum of item totals.'
            : formData.tax_type === 'igst'
              ? 'IGST applied for Interstate supply.'
              : 'SGST and CGST applied for Intrastate supply.'}
          </p>
        </div>
      </div>

      {/* Bill Items */}
      <h3 className="section-subheader divider-section">Bill Items (Products)</h3>

      {billItems.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg text-center mb-6">
          <p className="text-gray-500 mb-4">
            No items added. Click "Add Item" to start building the invoice.
          </p>
          <button type="button" onClick={handleAddItem} className="btn-primary">
            + Add First Item
          </button>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {billItems.map((item, index) => {
            const selectedProduct  = products.find(p => p.id === parseInt(item.product_id));
            const availableBatches = (selectedProduct?.batches || []).filter(b => b.quantity > 0);

            // In edit mode also show the saved batch even if quantity is now 0
            const batchOptions = isEditMode
              ? (selectedProduct?.batches || [])
              : availableBatches;

            const itemTotal = item.quantity && item.selling_rate
              ? (parseInt(item.quantity) * parseFloat(item.selling_rate)).toFixed(2)
              : '0.00';

            return (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-semibold text-gray-700">Item #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    ✕ Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
                  <div className="form-group">
                    <label className="form-label form-label-required text-xs">Product</label>
                    <select
                      value={item.product_id}
                      onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="">Select product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label-required text-xs">Batch</label>
                    <select
                      value={item.batch_number}
                      onChange={(e) => handleItemChange(index, 'batch_number', e.target.value)}
                      className="input-field text-sm"
                      disabled={!selectedProduct || batchOptions.length === 0}
                    >
                      <option value="">
                        {!selectedProduct
                          ? 'Select product first'
                          : batchOptions.length === 0
                            ? 'No batches available'
                            : 'Select batch'}
                      </option>
                      {batchOptions.map((batch, bIdx) => (
                        <option key={bIdx} value={batch.batch_number}>
                          {batch.batch_number} (Qty: {batch.quantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label-required text-xs">Quantity</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="input-field text-sm"
                      min="1"
                      placeholder="Qty"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label text-xs">MRP (₹)</label>
                    <input
                      type="number"
                      value={item.mrp || ''}
                      readOnly
                      tabIndex={-1}
                      className="input-field text-sm bg-gray-100 cursor-not-allowed"
                      placeholder="—"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label text-xs">
                      Discount (%)
                      {manualDiscountItems.has(index) && (
                        <span className="ml-1 text-amber-600 text-xs" title="Custom — not affected by global">
                          ✎ custom
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                        value={item.discount_pct !== undefined && item.discount_pct !== null
                          ? item.discount_pct
                          : globalDiscount}
                      onChange={(e) => handleItemDiscountChange(index, e.target.value)}
                      className={`input-field text-sm ${
                        manualDiscountItems.has(index)
                          ? 'bg-amber-50 border-amber-300'
                          : ''
                      }`}
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                    
                  <div className="form-group">
                    <label className="form-label text-xs">Selling Price (₹)</label>
                    <input
                      type="number"
                      value={item.selling_rate || ''}
                      readOnly
                      tabIndex={-1}
                      className="input-field text-sm bg-gray-100 cursor-not-allowed"
                      placeholder="—"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label text-xs font-medium">Total (₹)</label>
                    <div className="input-field bg-green-50 border-green-300 text-lg font-bold text-green-700 flex items-center justify-center">
                      {itemTotal}
                    </div>
                  </div>
                </div>

                {/* Discount & GST Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div className="form-group">
                    <label className="form-label text-xs font-medium">
                      GST (%)
                      {item.gst_percent && item.hsn_code && (
                        <span className="text-green-600 ml-1">✓ From HSN</span>
                      )}
                    </label>
                    <select
                      value={item.gst_percent}
                      onChange={(e) => handleItemChange(index, 'gst_percent', e.target.value)}
                      className={`input-field text-sm ${
                        item.gst_percent && item.hsn_code ? 'bg-green-50 border-green-300' : ''
                      }`}
                    >
                      <option value="">Select GST</option>
                      <option value="0">0% (Exempted)</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>

                  <div className="form-group lg:col-span-2">
                    <label className="form-label text-xs font-medium">HSN/SAC Code</label>
                    <div className={`input-field text-sm flex items-center justify-center ${
                      item.hsn_code
                        ? 'bg-blue-50 border-blue-300 font-semibold text-blue-700'
                        : 'bg-gray-50 text-gray-500'
                    }`}>
                      {item.hsn_code ? `${item.hsn_code} ✓` : 'No HSN Code'}
                    </div>
                  </div>
                </div>

                {/* Return Section */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_return || false}
                        onChange={(e) => handleItemChange(index, 'is_return', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Mark as Return</span>
                    </label>

                    {item.is_return && (
                      <div className="flex-1">
                        <select
                          value={item.return_reason}
                          onChange={(e) => handleItemChange(index, 'return_reason', e.target.value)}
                          className="input-field text-sm"
                        >
                          <option value="">Select return reason</option>
                          <option value="Defective">Defective</option>
                          <option value="Expired">Expired</option>
                          <option value="Customer Request">Customer Request</option>
                          <option value="Wrong Item">Wrong Item</option>
                          <option value="Damaged Packaging">Damaged Packaging</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {item.is_return && (
                    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
                      ⚠️ This item will be marked as a return. Stock quantity will be refunded to inventory.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {billItems.length > 0 && (
        <button type="button" onClick={handleAddItem} className="btn-secondary mb-6">
          + Add Another Item
        </button>
      )}

      {/* Info Box */}
      <div className="alert alert-info mb-6">
        <strong>How it works:</strong><br />
        ✓ Set a Global Discount % — applies to all new items automatically<br />
        ✓ Override discount per item — that item is protected from global changes<br />
        ✓ Selling Price = MRP × (1 − Discount%)<br />
        ✓ MRP and Selling Price are calculated — not entered manually<br />
        ✓ Quantity deducted from selected batch on save
      </div>

      {/* Summary */}
      {billItems.length > 0 && (
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Invoice Summary:</span>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                Total Items: <span className="font-semibold">{billItems.length}</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                ₹{billItems
                  .reduce((sum, item) =>
                    sum + (parseInt(item.quantity || 0) * parseFloat(item.selling_rate || 0)), 0)
                  .toFixed(2)}
              </div>
              <span className="text-xs text-gray-500">(Calculated before backend confirmation)</span>
            </div>
          </div>
        </div>
      )}

      {/* Submit button */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || billItems.length === 0}
          className="btn-primary"
        >
          {loading
            ? (isEditMode ? '⏳ Updating...' : '⏳ Creating...')
            : (isEditMode ? '💾 Update Invoice' : '✓ Create Invoice')}
        </button>

        {isEditMode && (
          <button
            type="button"
            onClick={() => navigate(`/billing/invoices/${invoiceId}`, { replace: true })}
            className="btn-secondary"
          >
            Cancel
          </button>
        )}

        {billItems.length === 0 && (
          <span className="text-sm text-gray-500 py-2">Add items to save the invoice</span>
        )}
      </div>

    </form>
  );
};

export default BillingForm;