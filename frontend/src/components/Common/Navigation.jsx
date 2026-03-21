import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchSuggestions from './SearchSuggestions';
import { useAuth } from '../../context/AuthContext';

const Navigation = () => {
  const { isAuthenticated, logout, owner } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    performSearch();
  };
  const handleLogout = () => {
    logout();
    navigate('/login');
    navigate('/',{ replace: true });
  }

  const performSearch = () => {
    const trimmedQuery = searchQuery.trim();
    console.log('🔍 Search triggered:', { query: trimmedQuery, isEmpty: !trimmedQuery });
    
    // Allow search with even a single character
    if (trimmedQuery.length >= 1) {
      console.log('✅ Navigating to search results:', trimmedQuery);
      navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      setSearchQuery('');
    } else {
      console.warn('⚠️ Search query is empty - enter at least 1 character');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  const handleSuggestionSelect = (product) => {
    console.log(`🎯 Product selected from suggestions: ${product.name}`);
    // Set the query to the product name
    setSearchQuery(product.name);
    // Navigate to search results
    navigate(`/search?q=${encodeURIComponent(product.name)}`);
  };

  return (
    <nav className="bg-gray-900 text-white">
      <div className="w-full px-10">
        <div className="flex justify-between items-center py-4">
          {/* Navigation Links */}
          <ul className="flex space-x-6 text-lg font-semibold">
            <li>
              <Link
                to="/"
                className="hover:text-sky-400 transition-colors"
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/inventory"
                className="hover:text-sky-400 transition-colors"
              >
                Inventory
              </Link>
            </li>
            <li>
              <Link
                to="/billing"
                className="hover:text-sky-400 transition-colors"
              >
                Billing
              </Link>
            </li>
            <li>
              <Link
                to="/settings"
                className="hover:text-sky-400 transition-colors"
              >
                Settings
              </Link>
            </li>
          </ul>

          {/* Global Search Bar */}
          <div className="relative">
            <form onSubmit={handleSearch} className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search product or brand..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  console.log('🔤 Input changed:', e.target.value);
                }}
                onKeyPress={handleKeyPress}
                className="bg-gray-800 text-white placeholder-gray-400 focus:outline-none w-56 flex-1"
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    console.log('✕ Search cleared');
                  }}
                  className="text-gray-400 hover:text-white transition-colors text-lg"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className="px-3 py-1 bg-sky-500 hover:bg-sky-600 rounded transition-colors text-white text-sm font-medium ml-2"
                title="Search (Enter or click button)"
              >
                Search
              </button>
            </form>

            {/* Live Suggestions Dropdown */}
            <SearchSuggestions 
              searchQuery={searchQuery} 
              onSelectSuggestion={handleSuggestionSelect}
            />
          </div>
          {/* User Info & Logout */}
          {isAuthenticated && (
            <div className="flex items-center space-x-4">
              <span className="text-sm">Hello, <strong>{owner?.first_name || owner?.email || 'User'}</strong></span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded transition-colors text-white text-sm font-medium"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
