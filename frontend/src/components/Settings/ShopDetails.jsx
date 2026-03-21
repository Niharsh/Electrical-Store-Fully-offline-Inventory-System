import { useEffect, useState } from "react";
import { Upload, Trash2 } from "lucide-react";

const ShopDetails = () => {
  const [form, setForm] = useState({
    shop_name: "",
    owner_name: "",
    phone: "",
    address: "",
    gst_number: "",
    bank_holder: "",
    bank_name: "",
    bank_account: "",
    bank_ifsc: "",
  });

  const [fetchedData, setFetchedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Replace the entire fetchShopDetails useEffect with this:
  useEffect(() => {
    const fetchShopDetails = async () => {
      try {
        const response = await window.api.getSettings();
        if (response?.data) {
          setForm({
            shop_name:    response.data.shop_name    || "",
            owner_name:   response.data.owner_name   || "",
            phone:        response.data.phone         || "",
            address:      response.data.address       || "",
            gst_number:   response.data.gst_number    || "",
            bank_holder:  response.data.bank_holder   || "",
            bank_name:    response.data.bank_name     || "",
            bank_account: response.data.bank_account  || "",
            bank_ifsc:    response.data.bank_ifsc     || "",
          });
          setFetchedData(response.data);
        }
      } catch (err) {
        console.log("[ShopDetails] fetch error", err);
      } finally {
        setLoading(false);
      }
    
      // ✅ Always call getQrImage separately — 
      // completely independent of getSettings
      // If no QR exists it returns success:false and we ignore it
      try {
        const qrResult = await window.api.getQrImage();
        console.log('[ShopDetails] QR on mount:', qrResult);
        if (qrResult?.success && qrResult?.dataUrl) {
          setQrDataUrl(qrResult.dataUrl);
        }
      } catch (err) {
        // No QR saved yet, that is fine
      }
    };
  
    fetchShopDetails();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePickQrImage = async () => {
    try {
      console.log('[ShopDetails] QR upload started');
      setQrLoading(true);
      setMessage({ type: "", text: "" });
      
      if (!window?.api?.pickQrImage) {
        throw new Error('window.api.pickQrImage not available');
      }

      console.log('[ShopDetails] calling pickQrImage');
      const result = await window.api.pickQrImage();
      console.log('[ShopDetails] pickQrImage result:', result);
      
      if (result.canceled || !result.path) {
        console.log('[ShopDetails] file selection canceled or no path');
        setQrLoading(false);
        return;
      }

      console.log('[ShopDetails] selected file path:', result.path);
      
      // Save the image
      if (!window?.api?.saveQrImage) {
        throw new Error('window.api.saveQrImage not available');
      }

      console.log('[ShopDetails] calling saveQrImage');
      const saveResult = await window.api.saveQrImage(result.path);
      console.log('[ShopDetails] saveQrImage result:', saveResult);
      
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save QR image');
      }

      console.log('[ShopDetails] QR file saved, calling getQrImage');
      
      // Load and display the saved image
      const getResult = await window.api.getQrImage();
      console.log('[ShopDetails] getQrImage result:', getResult);
      
      if (getResult.success && getResult.dataUrl) {
        setQrDataUrl(getResult.dataUrl);
        setMessage({
          type: "success",
          text: "QR image uploaded successfully!",
        });
        setTimeout(() => {
          setMessage({ type: "", text: "" });
        }, 3000);
      } else {
        throw new Error(getResult.error || 'Failed to load QR image after save');
      }
    } catch (error) {
      console.error('[ShopDetails] QR upload error:', error);
      setMessage({
        type: "error",
        text: `QR Upload Error: ${error.message}`,
      });
    } finally {
      setQrLoading(false);
    }
  };

  const handleRemoveQrImage = () => {
    setQrDataUrl(null);
    setMessage({
      type: "success",
      text: "QR image removed",
    });
    setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      if (!window?.api?.saveSettings) {
        throw new Error('window.api.saveSettings not available');
      }

      // Prepare payload with current form state including bank details
      const payload = {
        shop_name: form.shop_name || fetchedData?.shop_name || "",
        owner_name: form.owner_name || fetchedData?.owner_name || "",
        phone: form.phone || fetchedData?.phone || "",
        address: form.address || fetchedData?.address || "",
        gst_number: form.gst_number || fetchedData?.gst_number || "",
        bank_holder: form.bank_holder || "",
        bank_name: form.bank_name || "",
        bank_account: form.bank_account || "",
        bank_ifsc: form.bank_ifsc || "",
        bank_qr_path: fetchedData?.bank_qr_path || "", // Include existing QR path if available
      };

      console.log('[ShopDetails] Calling saveSettings with:', payload);
      const response = await window.api.saveSettings(payload);
      console.log('[ShopDetails] saveSettings response:', response);

      if (response && response.success === false) {
        throw new Error(response.message || 'Save failed');
      }

      // Update local state with the response from IPC
      if (response && response.data) {
        const updatedData = {
          shop_name: response.data.shop_name || "",
          owner_name: response.data.owner_name || "",
          phone: response.data.phone || "",
          address: response.data.address || "",
          gst_number: response.data.gst_number || "",
          bank_holder: response.data.bank_holder || "",
          bank_name: response.data.bank_name || "",
          bank_account: response.data.bank_account || "",
          bank_ifsc: response.data.bank_ifsc || "",
          dl_number: response.data.dl_number || "",
        };
        setFetchedData(response.data);
        setForm(updatedData);
      }

      // Show success message
      setMessage({
        type: "success",
        text: "Shop details saved successfully!",
      });

      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
    } catch (error) {
      const errorMsg =
        error.message ||
        "Failed to save shop details";

      setMessage({
        type: "error",
        text: `Error: ${errorMsg}`,
      });

      console.error("[ShopDetails] Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading shop details...</p>;

  return (
    <div className="card space-y-6">
      <h3 className="text-xl font-semibold">Shop / Owner Details</h3>

      {message.text && (
        <div
          className={`p-3 rounded text-sm ${
            message.type === "success"
              ? "bg-green-100 text-green-800 border border-green-300"
              : "bg-red-100 text-red-800 border border-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Shop / Owner Details Section */}
        <div>
          <h4 className="text-md font-semibold mb-4">Shop Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input
              className="input"
              name="shop_name"
              placeholder="Shop Name"
              value={form.shop_name}
              onChange={handleChange}
            />

            <input
              className="input"
              name="owner_name"
              placeholder="Owner Name"
              value={form.owner_name}
              onChange={handleChange}
            />

            <input
              className="input"
              name="phone"
              placeholder="Phone Number"
              value={form.phone}
              onChange={handleChange}
            />

            <textarea
              className="input"
              name="address"
              placeholder="Shop Address"
              value={form.address}
              onChange={handleChange}
            />

            <input
              className="input"
              name="gst_number"
              placeholder="GST Number (optional)"
              value={form.gst_number}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Bank Details Section */}
        <div className="border-t pt-6">
          <h4 className="text-md font-semibold mb-4">Bank Details (For Invoice)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input
              className="input"
              name="bank_holder"
              placeholder="Account Holder Name"
              value={form.bank_holder}
              onChange={handleChange}
            />

            <input
              className="input"
              name="bank_name"
              placeholder="Bank Name"
              value={form.bank_name}
              onChange={handleChange}
            />

            <input
              className="input"
              name="bank_account"
              placeholder="Account Number"
              value={form.bank_account}
              onChange={handleChange}
            />

            <input
              className="input"
              name="bank_ifsc"
              placeholder="IFSC Code"
              value={form.bank_ifsc}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* QR Code Section */}
        <div className="border-t pt-6">
          <h4 className="text-md font-semibold mb-4">Payment QR Code</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Upload Area */}
            <div>
              <button
                type="button"
                onClick={handlePickQrImage}
                disabled={qrLoading || saving}
                className="w-full border-2 border-dashed border-blue-300 rounded-lg p-4 hover:bg-blue-50 disabled:bg-gray-100 disabled:border-gray-300 transition flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                <span>{qrLoading ? "Uploading..." : "Upload QR Code"}</span>
              </button>
              <p className="text-xs text-gray-500 mt-2">PNG or JPG format, max 5MB</p>
            </div>

            {/* QR Preview */}
            <div className="flex flex-col items-center gap-4">
              {qrDataUrl ? (
                <>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <img 
                      src={qrDataUrl} 
                      alt="Payment QR Code" 
                      className="w-32 h-32 object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveQrImage}
                    disabled={saving}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove QR
                  </button>
                </>
              ) : (
                <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 text-gray-400 text-xs text-center p-2">
                  No QR Code
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="border-t pt-6 flex justify-end">
          <button className="btn-primary" disabled={saving || qrLoading}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ShopDetails;
