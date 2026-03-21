import React, { useState } from 'react';
import AddProductForm from '../components/Product/AddProductForm';
import ProductList from '../components/Product/ProductList';
import { useProducts } from '../context/ProductContext';

const Inventory = () => {
  const { deleteProduct } = useProducts();
  const [editingProduct, setEditingProduct] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleProductAdded = () => {
    setEditingProduct(null);
    // Refresh product list is handled by context
  };

  const handleEdit = (product) => {
    console.log('📝 Edit product:', product);
    setEditingProduct(product);
    setShowEditModal(true);
  };

  const handleDelete = async (productId) => {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this product?\n' +
      'This will also delete all its batches.'
    );
    if (!confirmDelete) return;

    try {
      const result = await deleteProduct(productId);
      if (result && result.success === false) {
        alert('Could not delete product.\nReason: ' + result.message);
        return;
      }
      // If deleteProduct doesn't return an object, assume success
      console.log('✅ Delete successful, product removed from inventory');
    } catch (error) {
      alert('Delete failed: ' + (error.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-8">

      {/* Product creation FORM */}
      <AddProductForm
        onProductAdded={handleProductAdded}
        editingProduct={editingProduct}
      />
        

      {/* Inventory LIST (MUST be outside the form) */}
      <div className="card">
        <ProductList onEdit={handleEdit} onDelete={handleDelete} />
      </div>

    </div>
  );
};

export default Inventory;
