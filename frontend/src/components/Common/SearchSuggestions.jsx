import React, { useState, useEffect, useRef } from 'react';

/**
 * SearchSuggestions - Live autocomplete for Navigation search bar
 *
 * Features:
 * - Shows suggestions as user types (after 1 character) - SQLite powered
 * - Displays product name in dropdown
 * - Debounced suggestions (300ms)
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Click outside to close
 * - Prefix matching priority (from searchProducts)
 * - No existing search flow disruption
 */
const SearchSuggestions = ({ searchQuery, onSelectSuggestion }) => {
  const [suggestions, setSuggestions]       = useState([]);
  const [isOpen, setIsOpen]                 = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading]           = useState(false);
  const [debounceTimer, setDebounceTimer]   = useState(null);
  const dropdownRef = useRef(null);

  // Fetch suggestions with debounce - using SQLite via IPC
  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!searchQuery || searchQuery.trim().length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        console.log(`🔍 Fetching suggestions for: "${searchQuery}"`);
        setIsLoading(true);

        if (!window?.api?.searchProducts) {
          throw new Error('window.api.searchProducts not available');
        }

        const response = await window.api.searchProducts(searchQuery.trim());

        if (response && response.success === false) {
          throw new Error(response.message || 'Failed to fetch suggestions');
        }

        const items = response?.data?.results || [];

        console.log(`✅ Got ${items.length} suggestions (limited to 8)`);

        setSuggestions(items.slice(0, 8));
        setIsOpen(items.length > 0);
        setHighlightedIndex(-1);
      } catch (error) {
        console.error('❌ Suggestions fetch error:', error);
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleSelectSuggestion = (product) => {
    console.log(`✅ Suggestion selected: ${product.name}`);
    onSelectSuggestion(product);
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <>
      {/* Hidden input to capture keyboard events */}
      <input
        type="hidden"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      />

      {/* Suggestions Dropdown */}
      {isOpen && (searchQuery.trim().length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto"
        >
          {isLoading && (
            <div className="px-4 py-3 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
              <div className="w-3 h-3 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              Loading suggestions...
            </div>
          )}

          {!isLoading && suggestions.length > 0 && (
            suggestions.map((product, index) => (
              <div
                key={product.id}
                onClick={() => handleSelectSuggestion(product)}
                className={`px-4 py-2 cursor-pointer flex items-center transition-colors border-b border-gray-100 last:border-b-0 ${
                  index === highlightedIndex
                    ? 'bg-sky-100 text-gray-900'
                    : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                {/* ✅ REMOVED: salt_composition / generic_name subtitle */}
                {/* ✅ REMOVED: product_type on the right */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{product.name}</div>
                </div>
              </div>
            ))
          )}

          {!isLoading && suggestions.length === 0 && searchQuery.trim().length > 0 && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              No products found for "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SearchSuggestions;