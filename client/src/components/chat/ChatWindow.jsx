/**
 * ChatWindow
 * The main message display area with input
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getSocket } from '../../services/socket';
import Avatar from '../ui/Avatar';
import MessageBubble from './MessageBubble';
import EmojiPicker from 'emoji-picker-react';
import toast from 'react-hot-toast';

const formatDateDivider = (date) => {
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
};

export default function ChatWindow() {
  const { user } = useAuth();
  const {
    activeConversation,
    messages,
    loadingMessages,
    hasMoreMessages,
    loadMoreMessages,
    sendMessage,
    typingUsers
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeout = useRef(null);
  const [isTyping, setIsTyping] = useState(false);

  const otherParticipant = activeConversation?.participants?.find(
    p => p._id !== user?._id
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Infinite scroll - load more when scrolling to top
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 50 && hasMoreMessages && !loadingMessages) {
      loadMoreMessages();
    }
  }, [hasMoreMessages, loadingMessages, loadMoreMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Handle typing indicator
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    const socket = getSocket();
    if (!socket || !activeConversation || !otherParticipant) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', {
        conversationId: activeConversation._id,
        receiverId: otherParticipant._id,
        isTyping: true
      });
    }

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing', {
        conversationId: activeConversation._id,
        receiverId: otherParticipant._id,
        isTyping: false
      });
    }, 1500);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');
    setShowEmoji(false);

    // Stop typing indicator
    setIsTyping(false);
    const socket = getSocket();
    if (socket && otherParticipant) {
      socket.emit('typing', {
        conversationId: activeConversation._id,
        receiverId: otherParticipant._id,
        isTyping: false
      });
    }

    try {
      await sendMessage(text);
    } catch {
      toast.error('Failed to send message');
      setInputText(text); // Restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emojiData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  // Get format last seen
  const getStatusText = () => {
    if (!otherParticipant) return '';
    if (otherParticipant.isOnline) return 'Online';
    if (!otherParticipant.lastSeen) return 'Offline';
    const d = new Date(otherParticipant.lastSeen);
    if (isToday(d)) return `Last seen today at ${format(d, 'h:mm a')}`;
    if (isYesterday(d)) return `Last seen yesterday at ${format(d, 'h:mm a')}`;
    return `Last seen ${format(d, 'MMM d')}`;
  };

  const isCurrentlyTyping = typingUsers[activeConversation?._id];

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg, index) => {
    const msgDate = new Date(msg.createdAt);
    const prevMsg = messages[index - 1];
    const showDateDivider = !prevMsg || !isSameDay(new Date(prevMsg.createdAt), msgDate);

    // Show avatar if first message or different sender from previous
    const prevSender = prevMsg?.senderId?._id || prevMsg?.senderId;
    const currSender = msg.senderId?._id || msg.senderId;
    const showAvatar = !prevMsg || prevSender !== currSender;

    groups.push({ msg, showDateDivider, showAvatar, date: msgDate });
    return groups;
  }, []);

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-chat dark:bg-chat-dark chat-bg">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-2xl font-bold text-gray-600 dark:text-gray-300 mb-2">
            ChatKey
          </h2>
          <p className="text-gray-400 dark:text-gray-500 max-w-xs text-sm leading-relaxed">
            Select a conversation from the sidebar or search for a username to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* ── Chat Header ─────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Avatar user={otherParticipant} size="md" showOnline />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
            @{otherParticipant?.username}
          </h3>
          <p className={`text-xs ${otherParticipant?.isOnline ? 'text-ck-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {isCurrentlyTyping
              ? <span className="text-ck-500 italic">typing...</span>
              : getStatusText()
            }
          </p>
        </div>
      </div>

      {/* ── Messages Area ───────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 scrollbar-thin bg-chat dark:bg-chat-dark chat-bg"
      >
        {/* Load more indicator */}
        {loadingMessages && (
          <div className="flex justify-center py-4">
            <span className="w-6 h-6 border-2 border-ck-500/30 border-t-ck-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Load more button */}
        {hasMoreMessages && !loadingMessages && (
          <div className="flex justify-center pb-2">
            <button
              onClick={loadMoreMessages}
              className="text-xs text-ck-600 dark:text-ck-400 hover:underline px-4 py-1.5 bg-white/80 dark:bg-gray-800/80 rounded-full shadow"
            >
              Load older messages
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loadingMessages && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Avatar user={otherParticipant} size="xl" showOnline />
            <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">
              @{otherParticipant?.username}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              No messages yet. Say hello! 👋
            </p>
          </div>
        )}

        {/* Messages */}
        {groupedMessages.map(({ msg, showDateDivider, showAvatar, date }, index) => (
          <div key={msg._id || index}>
            {showDateDivider && (
              <div className="time-divider">
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-chat dark:bg-chat-dark px-3 py-1 rounded-full shadow-sm">
                  {formatDateDivider(date)}
                </span>
              </div>
            )}
            <MessageBubble
              message={msg}
              showAvatar={showAvatar}
              sender={otherParticipant}
            />
          </div>
        ))}

        {/* Typing indicator bubble */}
        {isCurrentlyTyping && (
          <div className="flex items-end gap-2 animate-fade-in">
            <Avatar user={otherParticipant} size="xs" />
            <div className="bg-bubble-received dark:bg-bubble-received-dark px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
              <span className="typing-dot text-gray-400 dark:text-gray-500" />
              <span className="typing-dot text-gray-400 dark:text-gray-500" />
              <span className="typing-dot text-gray-400 dark:text-gray-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ──────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-end gap-2">
          {/* Emoji toggle */}
          <div className="relative">
            <button
              onClick={() => setShowEmoji(p => !p)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-lg flex-shrink-0"
              title="Emoji"
            >
              😊
            </button>
            {showEmoji && (
              <div className="absolute bottom-12 left-0 z-50 shadow-xl rounded-2xl overflow-hidden">
                <EmojiPicker
                  onEmojiClick={handleEmojiSelect}
                  theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                  height={380}
                  width={300}
                  searchDisabled={false}
                  skinTonesDisabled
                />
              </div>
            )}
          </div>

          {/* Text input */}
          <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl px-4 py-2.5 flex items-end gap-2 min-h-[44px] shadow-sm">
            <textarea
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 msg-input bg-transparent text-gray-900 dark:text-white placeholder-gray-400 text-sm resize-none max-h-32 leading-relaxed"
              style={{ height: 'auto', minHeight: '24px' }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all flex-shrink-0 ${
              inputText.trim()
                ? 'bg-ck-600 hover:bg-ck-700 text-white shadow-lg shadow-ck-500/30 scale-100'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 scale-95'
            }`}
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>

      {/* Click outside to close emoji */}
      {showEmoji && (
        <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
      )}
    </div>
  );
}
