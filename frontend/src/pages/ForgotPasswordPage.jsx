import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ErrorAlert from '../components/Common/ErrorAlert';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { resetPasswordWithRecoveryCode, loading } = useAuth();

  const [username, setUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [step, setStep] = useState(1);

  // ✅ Ref to store timer so we can clear it on unmount
  const redirectTimerRef = useRef(null);

  // ✅ Cleanup timer when component unmounts
  // Prevents "Can't perform state update on unmounted component"
  // and prevents navigate() firing after component is gone
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  const validateStep1 = () => {
    const newErrors = {};

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!recoveryCode.trim()) {
      newErrors.recoveryCode = 'Recovery code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};

    if (!newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'username') setUsername(value);
    else if (name === 'recoveryCode') setRecoveryCode(value);
    else if (name === 'newPassword') setNewPassword(value);
    else if (name === 'confirmPassword') setConfirmPassword(value);

    // Clear field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Step 1: Just validate fields locally, then move to step 2
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateStep1()) return;

    setStep(2);
  };

  // Step 2: Actually call the reset API
  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateStep2()) return;

    try {
      setIsSubmitting(true);

      // ✅ Capture return value - AuthContext now returns { success, message }
      // instead of auto-logging in
      const result = await resetPasswordWithRecoveryCode(
        username,
        recoveryCode,
        newPassword
      );

      // ✅ Check result.success (new behavior after AuthContext fix)
      // Old behavior was: setOwner() → threw no error but redirected to dashboard
      // New behavior is: returns { success: true } or throws error
      if (result && result.success) {
        setIsSuccess(true);

        // ✅ Store timer in ref so cleanup useEffect can cancel it
        redirectTimerRef.current = setTimeout(() => {
          redirectTimerRef.current = null;
          // ✅ replace: true so back button doesn't return to /forgot-password
          navigate('/login', { replace: true });
        }, 3000);
      } else {
        // Shouldn't reach here (errors throw), but just in case
        setGeneralError('Password reset failed. Please try again.');
        setStep(1);
      }

    } catch (err) {
      // ✅ AuthContext throws on failure, so we catch it here
      setGeneralError(
        err.message || 'Invalid recovery code or failed to reset password'
      );
      // ✅ Send back to step 1 so they can re-enter username/recovery code
      setStep(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2"> Electrical Shop</h1>
          <p className="text-blue-100">Inventory Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
            Reset Password
          </h2>
          <p className="text-gray-600 text-center mb-6">
            Enter your username and recovery code to reset your password.
          </p>

          {/* ✅ SUCCESS STATE */}
          {isSuccess ? (
            <div className="text-center">
              {/* Success icon */}
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 font-semibold mb-2">
                  ✓ Password Reset Successfully!
                </p>
                <p className="text-green-700 text-sm mb-3">
                  Your password has been updated.
                </p>
                <p className="text-gray-500 text-sm">
                  Redirecting to login in 3 seconds...
                </p>
              </div>

              {/* ✅ Manual redirect button in case timer feels slow */}
              <button
                onClick={() => {
                  // Cancel the auto-timer since user clicked manually
                  if (redirectTimerRef.current) {
                    clearTimeout(redirectTimerRef.current);
                    redirectTimerRef.current = null;
                  }
                  navigate('/login', { replace: true });
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
              >
                Go to Login Now
              </button>
            </div>

          ) : (
            <>
              {/* Error Alert */}
              {generalError && (
                <ErrorAlert
                  error={generalError}
                  onDismiss={() => setGeneralError('')}
                />
              )}

              {/* STEP INDICATOR */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${step === 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-green-500 text-white'
                  }`}
                >
                  {step === 1 ? '1' : '✓'}
                </div>
                <div className={`h-1 w-12 rounded ${step === 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${step === 2
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  2
                </div>
              </div>

              {/* STEP 1: Username + Recovery Code */}
              {step === 1 && (
                <form onSubmit={handleStep1Submit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={username}
                      onChange={handleChange}
                      placeholder="Enter your username"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                        errors.username ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.username && (
                      <p className="text-red-600 text-sm mt-1">{errors.username}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recovery Code
                    </label>
                    <input
                      type="password"
                      name="recoveryCode"
                      value={recoveryCode}
                      onChange={handleChange}
                      placeholder="Enter your recovery code"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                        errors.recoveryCode ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.recoveryCode && (
                      <p className="text-red-600 text-sm mt-1">{errors.recoveryCode}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition"
                  >
                    Next →
                  </button>
                </form>
              )}

              {/* STEP 2: New Password */}
              {step === 2 && (
                <form onSubmit={handleStep2Submit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      value={newPassword}
                      onChange={handleChange}
                      placeholder="Min. 8 characters"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                        errors.newPassword ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.newPassword && (
                      <p className="text-red-600 text-sm mt-1">{errors.newPassword}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter new password"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                        errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.confirmPassword && (
                      <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setGeneralError('');
                      }}
                      disabled={isSubmitting}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg transition disabled:opacity-50"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Resetting...
                        </>
                      ) : (
                        'Reset Password'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>ℹ️ Recovery Code:</strong> This was provided during account setup.
            </p>
          </div>

          {/* Back to Login */}
          {!isSuccess && (
            <div className="mt-4 text-center">
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                ← Back to Login
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-blue-100 text-sm mt-6">
          Secure. Local. Offline-First Electrical Billing
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;