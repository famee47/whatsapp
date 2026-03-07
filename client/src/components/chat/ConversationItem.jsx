/**
 * ConversationItem
 * Individual conversation row in the sidebar
 */

import { format, isToday, isYesterday } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import Avatar from '../ui/Avatar';

const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MM/dd/yy');
};

export default function ConversationItem({ conversation, isActive }) {
  const { user } = useAuth();
  const { selectConversation } = useChat();

  // Get the other participant
  const other = conversation.participants?.find(p => p._id !== user?._id);
  if (!other) return null;

  const lastMsg = conversation.lastMessage;
  const unread = conversation.unreadCount?.[user?._id] || 0;

  const getLastMessagePreview = () => {
    if (!lastMsg) return 'Start a conversation';
    if (lastMsg.isDeleted) return '🚫 Message deleted';
    if (lastMsg.messageType === 'image') return '📷 Photo';
    if (lastMsg.messageType === 'file') return '📎 File';
    return lastMsg.messageText || '';
  };

  const isSentByMe = lastMsg?.senderId === user?._id ||
    lastMsg?.senderId?._id === user?._id;

  return (
    <button
      onClick={() => selectConversation(conversation)}
      className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left ${
        isActive ? 'bg-gray-100 dark:bg-gray-800' : ''
      }`}
    >
      <Avatar user={other} size="md" showOnline />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            @{other.username}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
            {formatTime(conversation.updatedAt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
            {isSentByMe && lastMsg && (
              <span className={lastMsg.isSeen ? 'text-ck-500' : 'text-gray-400'}>
                {lastMsg.isSeen ? '✓✓' : '✓'}
              </span>
            )}
            {getLastMessagePreview()}
          </p>

          {unread > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 bg-ck-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
