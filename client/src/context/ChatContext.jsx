import { createContext, useContext, useState, useCallback } from 'react';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // { type: 'dm'|'group', data: conv|group }
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});

  const updateOnlineUser = useCallback((userId, status) => {
    setOnlineUsers(prev => ({ ...prev, [userId]: status }));
  }, []);

  const incrementUnread = useCallback((chatId) => {
    setUnreadCounts(prev => ({ ...prev, [chatId]: (prev[chatId] || 0) + 1 }));
  }, []);

  const clearUnread = useCallback((chatId) => {
    setUnreadCounts(prev => ({ ...prev, [chatId]: 0 }));
  }, []);

  return (
    <ChatContext.Provider value={{
      conversations, setConversations,
      groups, setGroups,
      messages, setMessages,
      activeChat, setActiveChat,
      onlineUsers, setOnlineUsers, updateOnlineUser,
      typingUsers, setTypingUsers,
      unreadCounts, incrementUnread, clearUnread,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat outside ChatProvider');
  return ctx;
};
