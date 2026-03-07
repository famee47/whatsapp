/**
 * MessageBubble
 * Renders individual chat messages with actions (edit, delete)
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import Avatar from '../ui/Avatar';
import toast from 'react-hot-toast';

export default function MessageBubble({ message, showAvatar, sender }) {
  const { user } = useAuth();
  const { deleteMessage, editMessage } = useChat();
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.messageText || '');
  const [actionLoading, setActionLoading] = useState(false);

  const isMine = message.senderId?._id === user?._id ||
    message.senderId === user?._id;

  const handleDelete = async () => {
    if (!confirm('Delete this message?')) return;
    setActionLoading(true);
    try {
      await deleteMessage(message._id);
    } catch {
      toast.error('Failed to delete message');
    } finally {
      setActionLoading(false);
      setShowActions(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editText.trim()) return;
    setActionLoading(true);
    try {
      await editMessage(message._id, editText);
      setEditing(false);
    } catch {
      toast.error('Failed to edit message');
    } finally {
      setActionLoading(false);
    }
  };

  if (message.isDeleted) {
    return (
      <div className={`flex items-end gap-2 animate-fade-in ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isMine && showAvatar && <Avatar user={sender} size="xs" />}
        {!isMine && !showAvatar && <div className="w-7" />}
        <div className={`px-3 py-2 rounded-2xl text-sm italic text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 ${isMine ? 'mr-1' : 'ml-1'}`}>
          🚫 Message deleted
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-2 group animate-bounce-in ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar (receiver side) */}
      {!isMine && (
        showAvatar
          ? <Avatar user={sender} size="xs" />
          : <div className="w-7 flex-shrink-0" />
      )}

      {/* Message content */}
      <div className={`max-w-[70%] ${isMine ? 'mr-1' : 'ml-1'}`}>
        {/* Edit mode */}
        {editing ? (
          <form onSubmit={handleEdit} className="flex gap-2">
            <input
              value={editText}
              onChange={e => setEditText(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border-2 border-ck-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={actionLoading}
              className="px-3 py-2 bg-ck-600 text-white rounded-xl text-sm hover:bg-ck-700 disabled:opacity-50"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setEditText(message.messageText || ''); }}
              className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm"
            >
              ✕
            </button>
          </form>
        ) : (
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
              isMine
                ? 'bg-bubble-sent dark:bg-bubble-sent-dark text-gray-900 dark:text-gray-100 rounded-br-sm'
                : 'bg-bubble-received dark:bg-bubble-received-dark text-gray-900 dark:text-gray-100 rounded-bl-sm'
            }`}
          >
            {/* Image message */}
            {message.messageType === 'image' && message.fileUrl && (
              <img
                src={message.fileUrl}
                alt="Shared image"
                className="rounded-xl max-w-xs mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(message.fileUrl, '_blank')}
              />
            )}

            {/* File message */}
            {message.messageType === 'file' && message.fileUrl && (
              <a
                href={message.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-ck-600 dark:text-ck-400 hover:underline"
              >
                📎 {message.fileName || 'Download file'}
              </a>
            )}

            {/* Text content */}
            {message.messageText && (
              <span className="break-words">{message.messageText}</span>
            )}

            {/* Meta: time + edit indicator + seen */}
            <div className={`flex items-center gap-1.5 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {message.isEdited && (
                <span className="text-xs text-gray-400 italic">edited</span>
              )}
              <span className="text-[10px] text-gray-400">
                {format(new Date(message.createdAt), 'h:mm a')}
              </span>
              {isMine && (
                <span className={`text-[11px] ${message.isSeen ? 'text-ck-600 dark:text-ck-400' : 'text-gray-400'}`}>
                  {message.isSeen ? '✓✓' : '✓'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Message actions (hover) */}
      {!editing && isMine && (
        <div className={`flex items-center gap-1 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={() => setEditing(true)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow text-xs hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow text-xs hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}
