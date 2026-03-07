/**
 * Sidebar Component
 * Shows user profile, search, and conversations list
 */

import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { userAPI } from '../../services/api';
import Avatar from '../ui/Avatar';
import ConversationItem from './ConversationItem';
import toast from 'react-hot-toast';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { conversations, loadingConversations, startConversation, activeConversation } = useChat();
  const { isDark, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const searchTimeout = useRef(null);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setSearchResult(null);

    if (!query.trim()) return;

    // Debounce search
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await userAPI.search(query.trim());
        setSearchResult({ type: 'found', user: data.user });
      } catch (err) {
        const msg = err.response?.data?.message || 'User not found';
        setSearchResult({ type: 'notFound', message: msg });
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const handleStartChat = async (receiverId) => {
    try {
      await startConversation(receiverId);
      setSearchQuery('');
      setSearchResult(null);
      toast.success('Chat opened!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start chat');
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
  };

  // Filter conversations by search when not searching for new users
  const filteredConversations = searchQuery && !searchResult
    ? []
    : conversations.filter(c => {
        if (!searchQuery) return true;
        const other = c.participants?.find(p => p._id !== user?._id);
        return other?.username?.toLowerCase().includes(searchQuery.toLowerCase());
      });

  return (
    <div className="flex flex-col h-full bg-sidebar dark:bg-sidebar-dark border-r border-gray-200 dark:border-gray-800">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 flex items-center justify-between">
        <button
          onClick={() => setShowProfile(p => !p)}
          className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
        >
          <Avatar user={user} size="md" showOnline={true} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
              {user?.username}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.bio || 'Online'}</p>
          </div>
        </button>

        <div className="flex items-center gap-1 ml-2">
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-lg"
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
            title="Logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────── */}
      <div className="px-3 py-2 bg-sidebar dark:bg-sidebar-dark">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by username..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-transparent focus:border-ck-400 dark:focus:border-ck-600 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResult(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Search Results ──────────────────────────────────────── */}
      {(searching || searchResult) && (
        <div className="px-3 pb-2">
          {searching && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm">
              <span className="w-4 h-4 border-2 border-ck-500/30 border-t-ck-500 rounded-full animate-spin flex-shrink-0" />
              Searching...
            </div>
          )}

          {searchResult?.type === 'found' && (
            <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-ck-200 dark:border-ck-800">
              <div className="flex items-center gap-3">
                <Avatar user={searchResult.user} size="sm" showOnline />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    @{searchResult.user.username}
                  </p>
                  {searchResult.user.bio && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{searchResult.user.bio}</p>
                  )}
                </div>
                <button
                  onClick={() => handleStartChat(searchResult.user._id)}
                  className="px-3 py-1.5 bg-ck-600 hover:bg-ck-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
                >
                  Chat
                </button>
              </div>
            </div>
          )}

          {searchResult?.type === 'notFound' && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <span>❌</span>
              {searchResult.message}
            </div>
          )}
        </div>
      )}

      {/* ── Conversations List ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loadingConversations ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <span className="w-6 h-6 border-2 border-ck-500/30 border-t-ck-500 rounded-full animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-6">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {searchQuery ? 'No conversations found' : 'No chats yet. Search for a username to start chatting!'}
            </p>
          </div>
        ) : (
          filteredConversations.map(conversation => (
            <ConversationItem
              key={conversation._id}
              conversation={conversation}
              isActive={activeConversation?._id === conversation._id}
            />
          ))
        )}
      </div>
    </div>
  );
}
