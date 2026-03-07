import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { convAPI, userAPI, groupAPI, statusAPI, authAPI } from '../services/api';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';

/* ─── Helpers ──────────────────────────────────────────────────────────── */
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:true}) : '';
const fmtConvTime = (d) => {
  if (!d) return '';
  const dt = new Date(d), now = new Date(), diff = now - dt;
  if (diff < 86400000) return fmtTime(dt);
  if (diff < 604800000) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
  return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit'});
};
const fmtLastSeen = (d) => {
  if (!d) return '';
  const dt = new Date(d), now = new Date();
  const timeStr = fmtTime(dt);
  if (dt.toDateString() === now.toDateString()) return `today at ${timeStr}`;
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate()-1);
  if (dt.toDateString() === yesterday.toDateString()) return `yesterday at ${timeStr}`;
  return `${dt.getDate()} ${dt.toLocaleString('en-US',{month:'long'})} at ${timeStr}`;
};
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
const fmtFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
};
const isSameDay = (a,b) => new Date(a).toDateString() === new Date(b).toDateString();
const EMOJIS = ['❤️','👍','😂','😮','😢','🙏','🔥','👀','🎉','💯'];
const BG_COLORS = ['#005c4b','#1565c0','#6a1b9a','#ad1457','#00695c','#4e342e','#1b5e20'];

/* ─── Cloudinary Upload ────────────────────────────────────────────────── */
const uploadToCloudinary = async (file, onProgress) => {
  const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'numberfree';
  const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'numberfree_upload';
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('file', file); fd.append('upload_preset', PRESET);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded/e.total)*100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) { resolve(JSON.parse(xhr.responseText).secure_url); }
      else reject(new Error('Upload failed'));
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`);
    xhr.send(fd);
  });
};

/* ─── Avatar ───────────────────────────────────────────────────────────── */
const Avatar = ({ user, size='md', className='' }) => {
  const s = {xs:'w-7 h-7 text-xs',sm:'w-8 h-8 text-sm',md:'w-10 h-10 text-base',lg:'w-12 h-12 text-lg',xl:'w-16 h-16 text-xl',xxl:'w-20 h-20 text-2xl'}[size];
  const palette = ['#e53935','#8e24aa','#039be5','#00897b','#43a047','#fb8c00','#6d4c41','#546e7a'];
  const color = palette[(user?.username?.charCodeAt(0)||0) % palette.length];
  if (user?.profilePicture) return <img src={user.profilePicture} alt={user?.username} className={`${s} rounded-full object-cover flex-shrink-0 ${className}`}/>;
  return <div className={`${s} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`} style={{backgroundColor:color}}>{(user?.username||'?')[0].toUpperCase()}</div>;
};

/* ─── Skeleton ─────────────────────────────────────────────────────────── */
const SkeletonChat = () => (
  <div className="flex items-center gap-3 px-3 py-3 border-b border-[#2a3942]/20 animate-pulse">
    <div className="w-10 h-10 rounded-full bg-[#2a3942] flex-shrink-0"/>
    <div className="flex-1 min-w-0">
      <div className="h-3 bg-[#2a3942] rounded-full w-2/3 mb-2"/>
      <div className="h-2.5 bg-[#2a3942] rounded-full w-1/2"/>
    </div>
    <div className="h-2 bg-[#2a3942] rounded-full w-8"/>
  </div>
);

/* ─── Ticks ────────────────────────────────────────────────────────────── */
const Ticks = ({ status }) => {
  if (status==='seen') return <svg viewBox="0 0 18 18" className="w-4 h-4 flex-shrink-0" style={{fill:'#53bdeb'}}><path d="M17.394 5.035l-.57-.444a.434.434 0 00-.609.076L8.106 14.218l-4.12-3.198a.433.433 0 00-.609.076l-.444.571a.434.434 0 00.076.609l4.87 3.781a.434.434 0 00.609-.076l9.381-12.077a.434.434 0 00-.076-.609zM9.49 8.668l-.609.076L5.96 5.546a.434.434 0 00-.609.076l-.444.571a.434.434 0 00.076.609l3.692 2.869.57-.444z"/></svg>;
  if (status==='delivered') return <svg viewBox="0 0 18 18" className="w-4 h-4 flex-shrink-0" style={{fill:'#8696a0'}}><path d="M17.394 5.035l-.57-.444a.434.434 0 00-.609.076L8.106 14.218l-4.12-3.198a.433.433 0 00-.609.076l-.444.571a.434.434 0 00.076.609l4.87 3.781a.434.434 0 00.609-.076l9.381-12.077a.434.434 0 00-.076-.609zM9.49 8.668l-.609.076L5.96 5.546a.434.434 0 00-.609.076l-.444.571a.434.434 0 00.076.609l3.692 2.869.57-.444z"/></svg>;
  return <svg viewBox="0 0 18 18" className="w-4 h-4 flex-shrink-0" style={{fill:'#8696a0'}}><path d="M17.394 5.035l-.57-.444a.434.434 0 00-.609.076L8.106 14.218l-4.12-3.198a.433.433 0 00-.609.076l-.444.571a.434.434 0 00.076.609l4.87 3.781a.434.434 0 00.609-.076l9.381-12.077a.434.434 0 00-.076-.609z"/></svg>;
};

/* ─── MediaViewer ──────────────────────────────────────────────────────── */
const MediaViewer = ({ url, type, onClose }) => {
  useEffect(() => {
    const h = (e) => { if (e.key==='Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white text-3xl hover:text-[#8696a0] z-10 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10">✕</button>
      <div onClick={e=>e.stopPropagation()} className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {type==='video'
          ? <video src={url} controls autoPlay className="max-w-full max-h-[85vh] rounded-lg"/>
          : <img src={url} alt="media" className="max-w-full max-h-[85vh] object-contain rounded-lg"/>
        }
      </div>
    </div>
  );
};

/* ─── SaveContactButton ─────────────────────────────────────────────────── */
const SaveContactButton = ({ userId, username, contacts, setContacts }) => {
  const existing = contacts.find(c => (c.user?._id||c.user) === userId);
  const [nickname, setNickname] = useState(existing?.nickname || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setNickname(existing?.nickname || ''); }, [existing?.nickname]);
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await userAPI.saveContact({ userId, nickname: nickname.trim() });
      setContacts(prev => {
        const filtered = prev.filter(c => (c.user?._id||c.user) !== userId);
        return [...filtered, data.contact || { user:{_id:userId,username}, nickname:nickname.trim() }];
      });
      setEditing(false);
      toast.success(nickname.trim() ? `Saved as "${nickname.trim()}"` : 'Contact saved!');
    } catch { toast.error('Failed to save contact.'); }
    finally { setSaving(false); }
  };
  if (editing) return (
    <div className="flex gap-2">
      <input value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="Nickname (optional)" autoFocus onKeyDown={e=>e.key==='Enter'&&save()}
        className="flex-1 px-3 py-2 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm"/>
      <button onClick={save} disabled={saving} className="px-3 py-2 bg-[#00a884] text-white rounded-xl text-sm font-bold disabled:opacity-50">{saving?'...':'Save'}</button>
      <button onClick={()=>setEditing(false)} className="px-3 py-2 bg-[#2a3942] text-[#8696a0] rounded-xl text-sm">✕</button>
    </div>
  );
  return (
    <button onClick={()=>setEditing(true)} className="w-full py-2.5 bg-[#2a3942] hover:bg-[#364a52] text-[#e9edef] rounded-xl font-semibold text-sm transition-colors">
      {existing ? `✏️ Edit: ${existing.nickname || '@'+username}` : '👤 Save Contact'}
    </button>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const { user, logout, updateUser } = useAuth();
  const { conversations, setConversations, groups, setGroups, messages, setMessages,
          activeChat, setActiveChat, onlineUsers, setOnlineUsers, typingUsers, setTypingUsers,
          unreadCounts, incrementUnread, clearUnread } = useChat();

  /* ── UI state ── */
  const [mobileView, setMobileView] = useState('list');
  const [activeTab, setActiveTab] = useState('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Messaging ── */
  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [emojiPicker, setEmojiPicker] = useState(null);
  const [sending, setSending] = useState(false);
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  const [convTypingMap, setConvTypingMap] = useState({});
  const [uploadProgress, setUploadProgress] = useState(null); // 0-100 or null
  const [selectedMsgs, setSelectedMsgs] = useState([]); // multi-select

  /* ── Swipe to reply ── */
  const [swipeState, setSwipeState] = useState({});
  const swipeStart = useRef({});

  /* ── Chat search ── */
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchResults, setChatSearchResults] = useState([]);
  const [showChatSearch, setShowChatSearch] = useState(false);

  /* ── Jump to latest ── */
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);

  /* ── Media viewer ── */
  const [mediaViewer, setMediaViewer] = useState(null); // { url, type }

  /* ── File upload ── */
  const [filePreview, setFilePreview] = useState(null); // { file, url, type, name, size }

  /* ── Voice recording ── */
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  /* ── Profile ── */
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ bio:'', displayName:'', customStatus:'' });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  /* ── Settings modal ── */
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile'); // profile | password | delete | privacy

  /* ── Change password ── */
  const [pwForm, setPwForm] = useState({ current:'', new:'', confirm:'' });
  const [pwLoading, setPwLoading] = useState(false);

  /* ── Delete account ── */
  const [deleteForm, setDeleteForm] = useState({ password:'' });
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── Status ── */
  const [statuses, setStatuses] = useState([]);
  const [showStatusCreate, setShowStatusCreate] = useState(false);
  const [newStatus, setNewStatus] = useState({ type:'text', content:'', backgroundColor:'#005c4b' });
  const [viewingStatusUser, setViewingStatusUser] = useState(null);

  /* ── Groups ── */
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [viewingGroupMembers, setViewingGroupMembers] = useState(null);
  const [groupForm, setGroupForm] = useState({ name:'', description:'' });
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addMemberResults, setAddMemberResults] = useState([]);

  /* ── Group settings ── */
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupSettingsForm, setGroupSettingsForm] = useState({ name:'', description:'' });

  /* ── Contacts ── */
  const [contacts, setContacts] = useState([]);

  /* ── Block ── */
  const [blockedByUsers, setBlockedByUsers] = useState({});
  const [iBlockedUsers, setIBlockedUsers] = useState({});

  /* ── Chat options (right-click on chat list item) ── */
  const [chatCtxMenu, setChatCtxMenu] = useState(null); // { x, y, item, isDM }

  /* ── Mute modal ── */
  const [muteModal, setMuteModal] = useState(null); // chatId

  /* ── Forward modal ── */
  const [forwardModal, setForwardModal] = useState(null); // msg object

  /* ── Message info modal ── */
  const [msgInfoModal, setMsgInfoModal] = useState(null); // msg object

  /* ── Draft ── */
  const [drafts, setDrafts] = useState({}); // chatId -> text

  /* ── Refs ── */
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const recordingInterval = useRef(null);
  const activeChatRef = useRef(activeChat);
  const userRef = useRef(user);
  const conversationsRef = useRef(conversations);
  const groupsRef = useRef(groups);
  const messagesRef = useRef(messages);
  const longPressTimer = useRef(null); // for chat list long-press on mobile
  const socket = getSocket();

  /* ── Chat list long-press (mobile) ── */
  const handleChatLongPressStart = (e, item, isDM) => {
    // Prevent if it's a scroll gesture
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches?.[0];
      const x = touch ? touch.clientX : e.clientX;
      const y = touch ? touch.clientY : e.clientY;
      setChatCtxMenu({ x, y, item, isDM });
    }, 500);
  };
  const handleChatLongPressEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  /* ── Keep refs fresh ── */
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  /* ════════════════════════════════════════════════════════════════════
     BOOT
  ════════════════════════════════════════════════════════════════════ */
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cvRes, grpRes] = await Promise.all([convAPI.getAll(), groupAPI.getAll()]);
      setConversations(Array.isArray(cvRes.data) ? cvRes.data : []);
      setGroups(Array.isArray(grpRes.data) ? grpRes.data : []);
    } catch {}
    try { const r = await userAPI.getContacts(); setContacts(Array.isArray(r.data)?r.data:[]); } catch {}
    try { const r = await statusAPI.getAll(); setStatuses(Array.isArray(r.data)?r.data:[]); } catch {}
    setLoading(false);
  };

  /* ── Auto scroll + scroll button ── */
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShowScrollBtn(false);
      setNewMsgCount(0);
    } else {
      setShowScrollBtn(true);
      setNewMsgCount(p => p + 1);
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBtn(false);
    setNewMsgCount(0);
  };

  const handleScroll = (e) => {
    const el = e.target;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBtn(!atBottom);
    if (atBottom) setNewMsgCount(0);
  };

  /* ── Save draft when switching chats ── */
  const saveDraft = useCallback((chatId, text) => {
    if (!chatId) return;
    setDrafts(p => ({ ...p, [chatId]: text }));
  }, []);

  /* ════════════════════════════════════════════════════════════════════
     SOCKET
  ════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!socket) return;
    const handle = (ev, fn) => { socket.on(ev, fn); return () => socket.off(ev, fn); };
    const cleanups = [
      handle('newMessage', (msg) => {
        const cid = msg.conversationId;
        setMessages(prev => prev.find(m=>m._id===msg._id) ? prev : [...prev, msg]);
        setConversations(prev => prev.map(c=>c._id===cid?{...c,lastMessage:msg,updatedAt:msg.createdAt}:c).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)));
        if (activeChatRef.current?.data?._id===cid && socket) {
          socket.emit('messageSeen', { conversationId:cid, senderId:msg.senderId?._id||msg.senderId });
        } else { incrementUnread(cid); }
      }),
      handle('newGroupMessage', (msg) => {
        const gid = msg.groupId;
        setMessages(prev => prev.find(m=>m._id===msg._id) ? prev : [...prev, msg]);
        setGroups(prev => prev.map(g=>g._id===gid?{...g,lastMessage:msg,updatedAt:msg.createdAt}:g).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)));
        if (activeChatRef.current?.data?._id!==gid) incrementUnread(gid);
      }),
      handle('messageSent', (msg) => {
        setMessages(prev => prev.find(m=>m._id===msg._id) ? prev : [...prev, msg]);
      }),
      handle('userTyping', ({ conversationId, senderId, username, isTyping:t }) => {
        if (conversationId===activeChatRef.current?.data?._id) setTypingUsers(p=>({...p,[senderId]:{isTyping:t,username}}));
        setConvTypingMap(p => {
          if (t) return {...p, [conversationId]: { username, senderId }};
          const n={...p}; delete n[conversationId]; return n;
        });
      }),
      handle('userStatusChanged', ({ userId, isOnline, lastSeen }) => setOnlineUsers(p=>({...p,[userId]:{isOnline,lastSeen}}))),
      handle('onlineUsers', (users) => { const m={}; users.forEach(id=>m[id]={isOnline:true}); setOnlineUsers(m); }),
      handle('messagesSeenByReceiver', ({ conversationId }) => {
        setMessages(p=>p.map(m=>(m.conversationId===conversationId||m.conversationId?._id===conversationId)&&(m.senderId?._id||m.senderId)?.toString()===userRef.current?._id?.toString()?{...m,status:'seen'}:m));
        setConversations(p=>p.map(c=>c._id===conversationId&&c.lastMessage?{...c,lastMessage:{...c.lastMessage,status:'seen'}}:c));
      }),
      handle('messageDelivered', ({ messageId, conversationId }) => {
        setMessages(p=>p.map(m=>m._id===messageId?{...m,status:'delivered'}:m));
        if (conversationId) setConversations(p=>p.map(c=>c._id===conversationId&&(c.lastMessage?._id===messageId||c.lastMessage===messageId)?{...c,lastMessage:{...c.lastMessage,status:'delivered'}}:c));
      }),
      handle('messageDeleted', ({ messageId }) => setMessages(p=>p.map(m=>m._id===messageId?{...m,isDeleted:true,messageText:'',fileUrl:null}:m))),
      handle('messageEdited', ({ message }) => setMessages(p=>p.map(m=>m._id===message._id?message:m))),
      handle('messageReaction', ({ message }) => setMessages(p=>p.map(m=>m._id===message._id?message:m))),
      handle('newStatus', (s) => setStatuses(p=>[s,...p])),
    ];
    return () => cleanups.forEach(fn => fn());
  }, [socket]);

  useEffect(() => {
    if (!socket || groups.length===0) return;
    socket.emit('joinGroups', groups.map(g=>g._id));
    const onReconnect = () => socket.emit('joinGroups', groups.map(g=>g._id));
    socket.on('connect', onReconnect);
    return () => socket.off('connect', onReconnect);
  }, [socket, groups.length]);

  /* ════════════════════════════════════════════════════════════════════
     CHAT OPEN
  ════════════════════════════════════════════════════════════════════ */
  const openDM = async (conv) => {
    // Save draft for current chat
    if (activeChat?.data?._id && messageText) saveDraft(activeChat.data._id, messageText);
    setActiveChat({ type:'dm', data:conv });
    setMobileView('chat');
    setSearchQuery(''); setSearchResults([]);
    setShowChatSearch(false); setChatSearchQuery(''); setChatSearchResults([]);
    clearUnread(conv._id);
    setSelectedMsgs([]);
    const other = getOther(conv);
    if (other) checkBlockStatus(other._id);
    // Restore draft
    const draft = drafts[conv._id] || '';
    setMessageText(draft);
    setReplyingTo(null); setEditingMsg(null);
    try {
      const { data } = await convAPI.getMessages(conv._id);
      setMessages(Array.isArray(data)?data:[]);
      if (socket) socket.emit('messageSeen', { conversationId:conv._id, senderId:other?._id });
      await convAPI.markSeen(conv._id);
    } catch { setMessages([]); }
  };

  const openGroup = async (group) => {
    if (activeChat?.data?._id && messageText) saveDraft(activeChat.data._id, messageText);
    setActiveChat({ type:'group', data:group });
    setMobileView('chat');
    setShowChatSearch(false); setChatSearchQuery(''); setChatSearchResults([]);
    clearUnread(group._id);
    setSelectedMsgs([]);
    const draft = drafts[group._id] || '';
    setMessageText(draft);
    setReplyingTo(null); setEditingMsg(null);
    try {
      const { data } = await groupAPI.getMessages(group._id);
      setMessages(Array.isArray(data)?data:[]);
    } catch { setMessages([]); }
  };

  const startDM = async (otherUser) => {
    try {
      const { data } = await convAPI.create(otherUser._id);
      setConversations(prev => prev.find(c=>c._id===data._id) ? prev : [data,...prev]);
      openDM(data);
    } catch { toast.error('Failed to start conversation.'); }
  };

  /* ════════════════════════════════════════════════════════════════════
     SEND MESSAGE
  ════════════════════════════════════════════════════════════════════ */
  const sendMessage = async () => {
    if ((!messageText.trim() && !filePreview) || !activeChat || sending) return;
    const text = messageText.trim();
    setMessageText('');
    setReplyingTo(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    // Clear draft
    saveDraft(activeChat.data._id, '');

    if (editingMsg) {
      try {
        const { data } = await convAPI.editMessage(editingMsg._id, text);
        setMessages(p=>p.map(m=>m._id===data._id?data:m));
        if (socket) socket.emit('messageEdited', { message:data, receiverId:getOther(activeChat.data)?._id, groupId:activeChat.type==='group'?activeChat.data._id:null });
      } catch { toast.error('Failed to edit message.'); }
      setEditingMsg(null); return;
    }

    setSending(true);
    setUploadProgress(null);
    try {
      let fileUrl = null, messageType = 'text', fileName = null, fileSize = null, fileMimeType = null;

      if (filePreview) {
        try {
          fileUrl = await uploadToCloudinary(filePreview.file, (p) => setUploadProgress(p));
          messageType = filePreview.type; // 'image', 'video', 'file'
          fileName = filePreview.name;
          fileSize = filePreview.size;
          fileMimeType = filePreview.file.type;
        } catch {
          toast.error('Upload failed. Make sure Cloudinary is configured.');
          setSending(false); setUploadProgress(null); return;
        }
        setFilePreview(null);
      }

      const payload = {
        messageText: text || null, messageType, fileUrl, fileName, fileSize, fileMimeType,
        replyTo: replyingTo?._id || null,
        isForwarded: false,
        ...(activeChat.type==='dm' ? { conversationId: activeChat.data._id } : { groupId: activeChat.data._id })
      };

      const { data } = await convAPI.sendMessage(payload);
      setMessages(p=>[...p, data]);

      if (activeChat.type==='dm') {
        setConversations(p=>p.map(c=>c._id===activeChat.data._id?{...c,lastMessage:{...data,status:'sent'},updatedAt:data.createdAt}:c).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)));
        if (socket) socket.emit('sendMessage', {...data, receiverId:getOther(activeChat.data)?._id});
      } else {
        setGroups(p=>p.map(g=>g._id===activeChat.data._id?{...g,lastMessage:data,updatedAt:data.createdAt}:g).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)));
        if (socket) socket.emit('sendGroupMessage', data);
      }
    } catch(err) {
      toast.error(err?.response?.data?.message || 'Failed to send. Please try again.');
    } finally { setSending(false); setUploadProgress(null); }
  };

  /* ── Forward message ── */
  const forwardMessage = async (msg, targetConvId, targetGroupId) => {
    try {
      const payload = {
        messageText: msg.messageText || null,
        messageType: msg.messageType,
        fileUrl: msg.fileUrl || null,
        fileName: msg.fileName || null,
        fileSize: msg.fileSize || null,
        fileMimeType: msg.fileMimeType || null,
        isForwarded: true,
        forwardedFrom: msg.senderId?._id || msg.senderId,
        ...(targetConvId ? { conversationId: targetConvId } : { groupId: targetGroupId })
      };
      const { data } = await convAPI.sendMessage(payload);
      if (targetConvId) {
        setConversations(p=>p.map(c=>c._id===targetConvId?{...c,lastMessage:data,updatedAt:data.createdAt}:c));
        if (socket) socket.emit('sendMessage', {...data, receiverId: null});
      }
      toast.success('Message forwarded!');
    } catch { toast.error('Failed to forward.'); }
    setForwardModal(null);
  };

  /* ── Handle input ── */
  const handleInput = (e) => {
    setMessageText(e.target.value);
    const ta = e.target; ta.style.height='auto'; ta.style.height=Math.min(ta.scrollHeight,140)+'px';
    if (!socket || !activeChat) return;
    if (!isTypingLocal) {
      setIsTypingLocal(true);
      socket.emit('typing', { conversationId:activeChat.data._id, receiverId:getOther(activeChat.data)?._id, groupId:activeChat.type==='group'?activeChat.data._id:null, isTyping:true });
    }
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => {
      setIsTypingLocal(false);
      socket.emit('typing', { conversationId:activeChat.data._id, receiverId:getOther(activeChat.data)?._id, groupId:activeChat.type==='group'?activeChat.data._id:null, isTyping:false });
    }, 1500);
  };

  /* ── Swipe to reply ── */
  const handleTouchStartSwipe = (e, msg) => { swipeStart.current[msg._id] = { x:e.touches[0].clientX }; };
  const handleTouchMoveSwipe = (e, msg) => {
    const start = swipeStart.current[msg._id]; if (!start) return;
    const dx = e.touches[0].clientX - start.x;
    if (dx > 0 && dx < 80) setSwipeState(p=>({...p,[msg._id]:dx}));
  };
  const handleTouchEndSwipe = (e, msg) => {
    const tx = swipeState[msg._id]||0;
    if (tx > 50) { setReplyingTo(msg); setTimeout(()=>textareaRef.current?.focus(),100); }
    setSwipeState(p=>({...p,[msg._id]:0}));
    delete swipeStart.current[msg._id];
  };

  /* ── File select ── */
  const handleFileSelect = (e, type) => {
    const file = e.target.files[0]; if (!file) return;
    const maxSize = type === 'video' ? 50*1024*1024 : type === 'file' ? 50*1024*1024 : 10*1024*1024;
    if (file.size > maxSize) { toast.error(`Max size: ${fmtFileSize(maxSize)}`); return; }
    const url = URL.createObjectURL(file);
    setFilePreview({ file, url, type, name: file.name, size: file.size });
    e.target.value = '';
  };

  /* ── Voice recording ── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type:'audio/webm' });
        try {
          const url = await uploadToCloudinary(new File([blob],'voice.webm',{type:'audio/webm'}));
          const { data } = await convAPI.sendMessage({
            messageType:'voice', fileUrl:url, duration:recordingTime,
            ...(activeChat.type==='dm' ? { conversationId:activeChat.data._id } : { groupId:activeChat.data._id })
          });
          setMessages(p=>[...p,data]);
          if (activeChat.type==='dm'&&socket) socket.emit('sendMessage',{...data,receiverId:getOther(activeChat.data)?._id});
          else if (socket) socket.emit('sendGroupMessage',data);
        } catch { toast.error('Failed to send voice message.'); }
        stream.getTracks().forEach(t=>t.stop());
      };
      mr.start(); setMediaRecorder(mr); setRecording(true); setRecordingTime(0);
      recordingInterval.current = setInterval(()=>setRecordingTime(p=>p+1),1000);
    } catch { toast.error('Microphone access denied.'); }
  };
  const stopRecording = () => {
    if (mediaRecorder) { mediaRecorder.stop(); setMediaRecorder(null); }
    setRecording(false); clearInterval(recordingInterval.current);
  };

  /* ── Reactions ── */
  const reactToMessage = async (msgId, emoji) => {
    setEmojiPicker(null);
    try {
      const { data } = await convAPI.reactToMessage(msgId, emoji);
      setMessages(p=>p.map(m=>m._id===data._id?data:m));
      if (socket) socket.emit('messageReaction', { message:data, receiverId:getOther(activeChat?.data)?._id, groupId:activeChat?.type==='group'?activeChat.data._id:null });
    } catch {}
  };

  /* ── Delete message ── */
  const deleteMessage = async (msg, forEveryone=false) => {
    setCtxMenu(null);
    try {
      await convAPI.deleteMessage(msg._id, forEveryone);
      if (forEveryone) {
        setMessages(p=>p.map(m=>m._id===msg._id?{...m,isDeleted:true,messageText:'',fileUrl:null}:m));
        if (socket) socket.emit('messageDeleted', { messageId:msg._id, conversationId:activeChat.data._id, receiverId:getOther(activeChat?.data)?._id, groupId:activeChat?.type==='group'?activeChat.data._id:null });
      } else {
        // Delete for me only - remove from view
        setMessages(p=>p.filter(m=>m._id!==msg._id));
      }
    } catch { toast.error('Failed to delete.'); }
  };

  /* ── Star ── */
  const starMessage = async (msg) => {
    setCtxMenu(null);
    try {
      await convAPI.starMessage(msg._id);
      setMessages(p=>p.map(m=>m._id===msg._id?{...m,starredBy:m.starredBy?.some(id=>(id._id||id)===user._id)?m.starredBy.filter(id=>(id._id||id)!==user._id):[...(m.starredBy||[]),user._id]}:m));
    } catch {}
  };

  /* ── Block ── */
  const blockUser = async (userId) => {
    try {
      const { data } = await userAPI.block(userId);
      toast.success(data.message);
      setIBlockedUsers(p=>({...p,[userId]:data.blocked}));
      setShowProfile(false);
    } catch { toast.error('Failed.'); }
  };
  const checkBlockStatus = async (userId) => {
    try {
      const { data } = await userAPI.checkBlocked(userId);
      setIBlockedUsers(p=>({...p,[userId]:data.iBlockedThem}));
      setBlockedByUsers(p=>({...p,[userId]:data.theyBlockedMe}));
    } catch {}
  };

  /* ── Avatar upload ── */
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5*1024*1024) { toast.error('Max 5MB'); return; }
    setUploadingAvatar(true);
    try {
      const url = await uploadToCloudinary(file);
      await authAPI.updateProfile({ profilePicture:url });
      updateUser({ profilePicture:url }); toast.success('Profile picture updated!');
    } catch { toast.error('Upload failed. Setup Cloudinary first.'); }
    finally { setUploadingAvatar(false); e.target.value=''; }
  };

  /* ── Search users ── */
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const { data } = await userAPI.search(q);
      setSearchResults((Array.isArray(data)?data:[]).filter(u=>u._id!==user._id));
    } catch { setSearchResults([]); }
  };

  /* ── Search messages in chat ── */
  const handleChatSearch = async (q) => {
    setChatSearchQuery(q);
    if (!q.trim()) { setChatSearchResults([]); return; }
    try {
      const id = activeChat?.data?._id;
      const isGroup = activeChat?.type === 'group';
      const { data } = await (isGroup ? groupAPI.searchMessages(q, id) : convAPI.searchMessages(q, id));
      setChatSearchResults(Array.isArray(data)?data:[]);
    } catch { setChatSearchResults([]); }
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior:'smooth', block:'center' });
      el.classList.add('msg-highlight');
      setTimeout(()=>el.classList.remove('msg-highlight'),1500);
    }
    setShowChatSearch(false); setChatSearchQuery(''); setChatSearchResults([]);
  };

  /* ── Status ── */
  const createStatus = async () => {
    if (!newStatus.content.trim()) return toast.error('Status content required.');
    try {
      const { data } = await statusAPI.create(newStatus);
      setStatuses(p=>[data,...p]);
      if (socket) socket.emit('newStatus', data);
      setShowStatusCreate(false); setNewStatus({ type:'text', content:'', backgroundColor:'#005c4b' });
      toast.success('Status posted!');
    } catch { toast.error('Failed to post status.'); }
  };

  const openStatusViewer = async (su, items, startIndex=0) => {
    setViewingStatusUser({ user:su, items, index:startIndex });
    const s = items[startIndex];
    if (s && (s.userId?._id||s.userId) !== user._id) {
      try { const { data } = await statusAPI.view(s._id); setStatuses(p=>p.map(st=>st._id===s._id?{...st,viewers:data.viewers||st.viewers}:st)); } catch {}
    }
  };

  const navStatus = (dir) => {
    if (!viewingStatusUser) return;
    const { items, index } = viewingStatusUser;
    const next = index + dir;
    if (next >= 0 && next < items.length) openStatusViewer(viewingStatusUser.user, items, next);
    else setViewingStatusUser(null);
  };

  /* ── Group create ── */
  const createGroup = async () => {
    if (!groupForm.name.trim()) return toast.error('Group name required.');
    if (selectedGroupMembers.length < 1) return toast.error('Add at least one member.');
    try {
      const { data } = await groupAPI.create({ name:groupForm.name, description:groupForm.description, members:selectedGroupMembers });
      setGroups(p=>[data,...p]);
      setShowCreateGroup(false); setGroupForm({name:'',description:''}); setSelectedGroupMembers([]); setGroupSearch(''); setGroupSearchResults([]);
      toast.success('Group created!'); openGroup(data);
    } catch { toast.error('Failed to create group.'); }
  };

  /* ── Pin / Mute / Delete chat ── */
  const pinChat = async (chatId) => {
    try {
      const { data } = await userAPI.pinChat(chatId);
      updateUser({ pinnedChats: data.pinnedChats });
      toast.success(user.pinnedChats?.includes(chatId) ? 'Chat unpinned' : 'Chat pinned 📌');
    } catch(e) { toast.error(e?.response?.data?.message || 'Failed.'); }
    setChatCtxMenu(null);
  };

  const muteChat = async (chatId, duration) => {
    try {
      await userAPI.muteChat(chatId, duration);
      toast.success(duration==='unmute' ? 'Chat unmuted' : 'Chat muted 🔇');
    } catch { toast.error('Failed.'); }
    setMuteModal(null); setChatCtxMenu(null);
  };

  const deleteChatForMe = async (chatId) => {
    try {
      await userAPI.deleteChat(chatId);
      // Remove from local state
      setConversations(p=>p.filter(c=>c._id!==chatId));
      setGroups(p=>p.filter(g=>g._id!==chatId));
      if (activeChat?.data?._id===chatId) { setActiveChat(null); setMessages([]); setMobileView('list'); }
      toast.success('Chat deleted');
    } catch { toast.error('Failed.'); }
    setChatCtxMenu(null);
  };

  /* ── Clear chat history ── */
  const clearChatHistory = async () => {
    if (!activeChat) return;
    const isGroup = activeChat.type==='group';
    try {
      await (isGroup ? groupAPI.clearHistory(activeChat.data._id) : convAPI.clearHistory(activeChat.data._id));
      setMessages([]);
      toast.success('Chat history cleared');
    } catch { toast.error('Failed.'); }
    setShowGroupSettings(false);
  };

  /* ── Group delete / leave ── */
  const deleteGroup = async (groupId) => {
    try {
      await groupAPI.delete(groupId);
      setGroups(p=>p.filter(g=>g._id!==groupId));
      if (activeChat?.data?._id===groupId) { setActiveChat(null); setMessages([]); setMobileView('list'); }
      toast.success('Group deleted');
    } catch(e) { toast.error(e?.response?.data?.message || 'Failed.'); }
    setShowGroupSettings(false);
  };

  const leaveGroup = async (groupId) => {
    try {
      await groupAPI.leave(groupId);
      setGroups(p=>p.filter(g=>g._id!==groupId));
      if (activeChat?.data?._id===groupId) { setActiveChat(null); setMessages([]); setMobileView('list'); }
      toast.success('Left group');
    } catch(e) { toast.error(e?.response?.data?.message || 'Failed.'); }
    setShowGroupSettings(false);
  };

  /* ── Change password ── */
  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.new) return toast.error('All fields required.');
    if (pwForm.new !== pwForm.confirm) return toast.error('New passwords do not match.');
    if (pwForm.new.length < 6) return toast.error('Password must be at least 6 characters.');
    setPwLoading(true);
    try {
      await authAPI.changePassword({ currentPassword: pwForm.current, newPassword: pwForm.new });
      toast.success('Password changed! 🔒');
      setPwForm({ current:'', new:'', confirm:'' });
      setShowSettings(false);
    } catch(e) { toast.error(e?.response?.data?.message || 'Failed.'); }
    finally { setPwLoading(false); }
  };

  /* ── Delete account ── */
  const handleDeleteAccount = async () => {
    if (!deleteForm.password) return toast.error('Enter your password to confirm.');
    setDeleteLoading(true);
    try {
      await authAPI.deleteAccount({ password: deleteForm.password });
      toast.success('Account deleted.');
      logout();
    } catch(e) { toast.error(e?.response?.data?.message || 'Failed.'); }
    finally { setDeleteLoading(false); }
  };

  /* ── Helpers ── */
  const goBack = () => {
    if (activeChat?.data?._id && messageText) saveDraft(activeChat.data._id, messageText);
    setMobileView('list'); setActiveChat(null); setMessages([]);
    setReplyingTo(null); setEditingMsg(null); setShowChatSearch(false);
  };
  const getOther = (conv) => conv?.participants?.find(p=>p._id!==user._id);
  const isOnline = (uid) => onlineUsers[uid]?.isOnline||false;
  const getTypingText = () => {
    const t=Object.values(typingUsers).filter(v=>v.isTyping);
    if (!t.length) return null;
    if (activeChat?.type==='group') return `${t.map(v=>v.username).join(', ')} typing...`;
    return 'typing...';
  };
  const getContactName = (uid, fallbackUsername) => {
    const c = contacts.find(c=>(c.user?._id||c.user)===uid);
    return c?.nickname || fallbackUsername;
  };
  const isPinned = (chatId) => user?.pinnedChats?.includes(chatId);
  const isMuted = (chatId) => {
    const m = user?.mutedChats?.[chatId];
    if (!m) return false;
    if (m.unmuteAt === null) return true; // always
    return new Date(m.unmuteAt) > new Date();
  };

  const activeChatUser = activeChat?.type==='dm' ? getOther(activeChat.data) : null;
  const activeChatName = activeChat?.type==='dm'
    ? getContactName(activeChatUser?._id, activeChatUser?.username)
    : activeChat?.data?.name;
  const activeChatOnline = activeChatUser && isOnline(activeChatUser._id);
  const typingText = getTypingText();

  /* ── Status helpers ── */
  const statusByUser = statuses.reduce((acc,s) => {
    const uid = s.userId?._id||s.userId;
    if (!acc[uid]) acc[uid] = { user:s.userId, items:[] };
    acc[uid].items.push(s);
    return acc;
  }, {});
  const myStatuses = statusByUser[user._id];
  const othersStatuses = Object.entries(statusByUser).filter(([uid])=>uid!==user._id);
  const hasUnseenStatus = (uid) => {
    const entry = statusByUser[uid]; if (!entry) return false;
    return entry.items.some(s => !s.viewers?.some(v=>(v._id||v)===user._id));
  };
  const hasAnyStatus = (uid) => !!statusByUser[uid];

  /* ── Chat list with pinned sorting ── */
  const allChatItems = conversations.map(c=>({...c,_chatType:'dm'}))
    .sort((a,b) => {
      const aPin = isPinned(a._id) ? 1 : 0;
      const bPin = isPinned(b._id) ? 1 : 0;
      if (bPin !== aPin) return bPin - aPin;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  const allGroupItems = groups.map(g=>({...g,_chatType:'group'}))
    .sort((a,b) => new Date(b.updatedAt)-new Date(a.updatedAt));

  /* ── Context menu for msg ── */
  const isAdmin = activeChat?.type==='group' &&
    (activeChat.data.admins?.some(a=>(a._id||a)===user._id) || (activeChat.data.admin?._id||activeChat.data.admin)===user._id);

  /* ══════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <>
    <style>{`
      .msg-highlight{animation:msgPulse 1.5s ease}
      @keyframes msgPulse{0%,100%{background:transparent}30%,70%{background:rgba(0,168,132,0.25)}}
      .scrollbar-hide::-webkit-scrollbar{display:none}
      .scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}
    `}</style>

    {/* Media Viewer */}
    {mediaViewer && <MediaViewer url={mediaViewer.url} type={mediaViewer.type} onClose={()=>setMediaViewer(null)}/>}

    <div className="flex h-screen overflow-hidden bg-[#111b21]" style={{height:'100dvh'}}
      onClick={()=>{setCtxMenu(null);setEmojiPicker(null);setChatCtxMenu(null);}}>

      {/* ══════ LEFT PANEL ══════ */}
      <div className={`${mobileView==='chat'?'hidden md:flex':'flex'} flex-col w-full md:w-[380px] lg:w-[400px] xl:w-[420px] border-r border-[#2a3942] bg-[#111b21] flex-shrink-0`}>

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 bg-[#202c33] flex-shrink-0">
          <button onClick={()=>{setShowProfile(true);setProfileUser(null);}} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="relative">
              <Avatar user={user} size="md"/>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#202c33]"/>
            </div>
            <span className="text-white font-semibold text-sm truncate max-w-[120px]">{user?.username}</span>
          </button>
          <div className="flex items-center gap-1">
            <button onClick={()=>setShowCreateGroup(true)} title="New group"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            </button>
            <button onClick={()=>setShowSettings(true)} title="Settings"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
            </button>
            <button onClick={logout} title="Logout"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
            </button>
          </div>
        </div>

        {/* PC Tab Bar */}
        <div className="hidden md:flex items-center border-b border-[#2a3942] flex-shrink-0">
          {[{id:'chats',label:'Chats'},{id:'groups',label:'Groups'},{id:'status',label:'Status'},{id:'contacts',label:'Contacts'}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab===t.id?'text-[#00a884] border-[#00a884]':'text-[#8696a0] border-transparent hover:text-[#e9edef]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search bar (chats tab) */}
        {activeTab==='chats' && (
          <div className="px-3 py-2 flex-shrink-0">
            <div className="flex items-center bg-[#202c33] rounded-full px-3 py-2 gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#8696a0] flex-shrink-0"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.208 5.208 5.185 5.185 0 003.386-1.255l.221.22v.635l4.004 3.999 1.195-1.195-3.998-4.007zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/></svg>
              <input value={searchQuery} onChange={e=>handleSearch(e.target.value)} placeholder="Search or start new chat"
                className="bg-transparent text-[#e9edef] placeholder-[#8696a0] text-sm flex-1 outline-none"/>
              {searchQuery && <button onClick={()=>{setSearchQuery('');setSearchResults([]);}} className="text-[#8696a0] hover:text-white text-lg">×</button>}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length>0 && activeTab==='chats' && (
          <div className="border-b border-[#2a3942] flex-shrink-0 max-h-48 overflow-y-auto scrollbar-hide">
            <p className="text-[#8696a0] text-xs px-4 py-1 uppercase tracking-wider">People</p>
            {searchResults.map(u=>(
              <button key={u._id} onClick={()=>startDM(u)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#2a3942] transition-colors">
                <div className="relative"><Avatar user={u} size="md"/>{isOnline(u._id)&&<span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#111b21]"/>}</div>
                <div className="text-left min-w-0">
                  <p className="text-[#e9edef] text-sm font-medium truncate">{getContactName(u._id, u.username)}</p>
                  <p className="text-[#8696a0] text-xs truncate">{u.bio}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── STATUS TAB ── */}
        {activeTab==='status' && (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="flex gap-4 px-4 py-3 overflow-x-auto border-b border-[#2a3942] scrollbar-hide">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <button onClick={()=>setShowStatusCreate(true)} className="relative">
                  <div className={`p-0.5 rounded-full ${myStatuses ? 'bg-gradient-to-tr from-[#00a884] to-[#005c4b]' : 'bg-[#2a3942]'}`}>
                    <div className="bg-[#111b21] p-0.5 rounded-full"><Avatar user={user} size="lg"/></div>
                  </div>
                  <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#00a884] rounded-full border-2 border-[#111b21] flex items-center justify-center">
                    <span className="text-white text-xs font-bold leading-none">+</span>
                  </div>
                </button>
                <span className="text-[#e9edef] text-xs">My Status</span>
              </div>
              {othersStatuses.map(([uid,{user:su,items}])=>(
                <div key={uid} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <button onClick={()=>openStatusViewer(su,items,0)}
                    className={`p-0.5 rounded-full ${items.every(s=>s.viewers?.some(v=>(v._id||v)===user._id))?'bg-[#8696a0]':'bg-gradient-to-tr from-[#00a884] to-[#005c4b]'}`}>
                    <div className="bg-[#111b21] p-0.5 rounded-full"><Avatar user={su} size="lg"/></div>
                  </button>
                  <span className="text-[#e9edef] text-xs truncate max-w-[60px] text-center">{su?.username}</span>
                </div>
              ))}
            </div>
            {myStatuses && (
              <div>
                <p className="text-[#8696a0] text-xs px-4 py-2 uppercase tracking-wider">My Updates</p>
                {myStatuses.items.map((s,i)=>(
                  <button key={s._id} onClick={()=>openStatusViewer(user, myStatuses.items, i)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] transition-colors">
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{backgroundColor:s.backgroundColor}}>
                      {s.type==='image'?<img src={s.content} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center p-1"><p className="text-white text-xs text-center line-clamp-2">{s.content}</p></div>}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-[#e9edef] text-sm">{fmtTime(s.createdAt)}</p>
                      <p className="text-[#8696a0] text-xs">👁️ {s.viewers?.length||0} view{s.viewers?.length!==1?'s':''}</p>
                    </div>
                    <button onClick={e=>{e.stopPropagation();statusAPI.delete(s._id).then(()=>{setStatuses(p=>p.filter(st=>st._id!==s._id));toast.success('Deleted.');}).catch(()=>toast.error('Failed.'));}} className="text-[#8696a0] hover:text-red-400 p-2">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                  </button>
                ))}
              </div>
            )}
            {othersStatuses.length>0 && <p className="text-[#8696a0] text-xs px-4 py-2 uppercase tracking-wider">Recent Updates</p>}
            {othersStatuses.map(([uid,{user:su,items}])=>(
              <button key={uid} onClick={()=>openStatusViewer(su,items,0)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] transition-colors">
                <div className={`p-0.5 rounded-full flex-shrink-0 ${items.every(s=>s.viewers?.some(v=>(v._id||v)===user._id))?'bg-[#8696a0]':'bg-gradient-to-tr from-[#00a884] to-[#005c4b]'}`}>
                  <div className="bg-[#111b21] p-0.5 rounded-full"><Avatar user={su} size="md"/></div>
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[#e9edef] text-sm font-medium">{getContactName(su._id, su.username)}</p>
                  <p className="text-[#8696a0] text-xs">{fmtTime(items[0].createdAt)} · {items.length} update{items.length>1?'s':''}</p>
                </div>
              </button>
            ))}
            {statuses.length===0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <p className="text-[#e9edef] text-sm">No status updates</p>
                <p className="text-[#8696a0] text-xs">Tap + to add yours</p>
              </div>
            )}
          </div>
        )}

        {/* ── CONTACTS TAB ── */}
        {activeTab==='contacts' && (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {contacts.filter(c=>c.user&&!c.user.isDeleted).length===0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2 px-8 text-center">
                <p className="text-[#e9edef] font-medium text-sm">No contacts yet</p>
                <p className="text-[#8696a0] text-xs">Search for someone → open their profile → Save Contact</p>
              </div>
            ) : contacts.filter(c=>c.user&&!c.user.isDeleted).map(c=>(
              <button key={c.user._id||c.user} onClick={()=>startDM(c.user)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] transition-colors border-b border-[#2a3942]/30">
                <div className="relative"><Avatar user={c.user} size="md"/>{isOnline(c.user._id)&&<span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#111b21]"/>}</div>
                <div className="text-left min-w-0">
                  <p className="text-[#e9edef] text-sm font-medium truncate">{c.nickname||c.user.username}</p>
                  {c.nickname && <p className="text-[#8696a0] text-xs truncate">@{c.user.username}</p>}
                  {!c.nickname && <p className="text-[#8696a0] text-xs truncate">{c.user.bio}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── GROUPS TAB ── */}
        {activeTab==='groups' && (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-[#8696a0] text-xs uppercase tracking-wider font-semibold">Your Groups</p>
              <button onClick={()=>setShowCreateGroup(true)} className="flex items-center gap-1 text-[#00a884] text-xs font-semibold hover:opacity-80">
                <span className="text-lg leading-none">+</span> New Group
              </button>
            </div>
            {allGroupItems.length===0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 px-8 text-center">
                <div className="w-14 h-14 bg-[#202c33] rounded-full flex items-center justify-center text-3xl">👥</div>
                <p className="text-[#e9edef] font-medium text-sm">No groups yet</p>
                <button onClick={()=>setShowCreateGroup(true)} className="mt-1 px-4 py-2 bg-[#00a884] hover:bg-[#00c79a] text-white rounded-xl text-sm font-bold">Create Group</button>
              </div>
            ) : allGroupItems.map(group => {
              const lm = group.lastMessage;
              const isActive = activeChat?.data?._id===group._id;
              const unread = unreadCounts[group._id]||0;
              return (
                <div key={group._id}
                  className={`w-full flex items-center gap-3 px-3 py-3 border-b border-[#2a3942]/20 ${isActive?'bg-[#2a3942]':'hover:bg-[#202c33]'} transition-colors`}
                  onContextMenu={e=>{e.preventDefault();setChatCtxMenu({x:e.clientX,y:e.clientY,item:group,isDM:false});}}
                  onTouchStart={e=>handleChatLongPressStart(e,group,false)}
                  onTouchEnd={handleChatLongPressEnd}
                  onTouchMove={handleChatLongPressEnd}>
                  <button onClick={()=>openGroup(group)} className="relative flex-shrink-0">
                    <div className="w-12 h-12 bg-[#2a3942] rounded-full flex items-center justify-center text-2xl overflow-hidden">
                      {group.groupPicture?<img src={group.groupPicture} className="w-12 h-12 rounded-full object-cover"/>:'👥'}
                    </div>
                    {unread>0 && <span className="absolute -top-1 -right-1 bg-[#00a884] text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1">{unread>99?'99+':unread}</span>}
                  </button>
                  <button onClick={()=>openGroup(group)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        {isMuted(group._id) && <span className="text-[#8696a0] text-xs flex-shrink-0">🔇</span>}
                        <span className={`text-sm truncate ${unread>0?'text-[#e9edef] font-semibold':'text-[#e9edef] font-medium'}`}>{group.name}</span>
                      </div>
                      <span className={`text-xs flex-shrink-0 ${unread>0?'text-[#00a884]':'text-[#8696a0]'}`}>{fmtConvTime(group.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-[#8696a0] truncate flex-1">
                        {convTypingMap[group._id]?<span className="text-[#00a884]">typing...</span>
                          :unread>1?`${unread} new messages`
                          :lm?.isDeleted?'🚫 Deleted':lm?.messageType==='image'?'📷 Photo':lm?.messageType==='video'?'🎥 Video':lm?.messageType==='voice'?'🎤 Voice':lm?.messageType==='file'?`📎 ${lm.fileName||'File'}`:lm?.messageText||'No messages yet'}
                      </span>
                    </div>
                  </button>
                  <button onClick={(e)=>{e.stopPropagation();setViewingGroupMembers(group);}}
                    className="flex-shrink-0 flex flex-col items-center gap-0.5 text-[#8696a0] hover:text-[#00a884] transition-colors px-1" title="View members">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                    <span className="text-xs">{group.members?.length||0}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CHATS LIST ── */}
        {activeTab==='chats' && (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {loading && [1,2,3,4,5].map(i=><SkeletonChat key={i}/>)}
            {!loading && allChatItems.length===0 && !searchQuery && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 px-8 text-center">
                <div className="w-14 h-14 bg-[#202c33] rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-[#8696a0]"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                </div>
                <p className="text-[#e9edef] font-medium text-sm">No chats yet</p>
                <p className="text-[#8696a0] text-xs">Search for someone to start chatting!</p>
              </div>
            )}
            {!loading && allChatItems.map(item => {
              const isDM = item._chatType==='dm';
              const other = isDM ? getOther(item) : null;
              const lm = item.lastMessage;
              const isMine = (lm?.senderId?._id||lm?.senderId)===user._id;
              const isActive = activeChat?.data?._id===item._id;
              const unread = unreadCounts[item._id]||0;
              const displayName = isDM ? getContactName(other?._id, other?.username) : item.name;
              const pinned = isPinned(item._id);
              const muted = isMuted(item._id);
              const hasDraft = drafts[item._id] && !isActive;
              return (
                <button key={item._id}
                  onClick={()=>isDM?openDM(item):openGroup(item)}
                  onContextMenu={e=>{e.preventDefault();e.stopPropagation();setChatCtxMenu({x:e.clientX,y:e.clientY,item,isDM});}}
                  onTouchStart={e=>handleChatLongPressStart(e,item,isDM)}
                  onTouchEnd={handleChatLongPressEnd}
                  onTouchMove={handleChatLongPressEnd}
                  className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-[#2a3942] transition-colors border-b border-[#2a3942]/20 ${isActive?'bg-[#2a3942]':''} text-left`}>
                  <div className="relative flex-shrink-0">
                    {isDM
                      ? <>{hasAnyStatus(other?._id) ? (
                          <div onClick={e=>{e.stopPropagation();const en=statusByUser[other._id];if(en)openStatusViewer(other,en.items,0);}}
                            className={`p-0.5 rounded-full cursor-pointer ${hasUnseenStatus(other?._id)?'bg-gradient-to-tr from-[#00a884] to-[#005c4b]':'bg-[#8696a0]'}`}>
                            <div className="bg-[#111b21] p-0.5 rounded-full"><Avatar user={other} size="md"/></div>
                          </div>
                        ) : <Avatar user={other} size="md"/>}
                        {isOnline(other?._id)&&<span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#111b21]"/>}</>
                      : <div className="w-10 h-10 bg-[#2a3942] rounded-full flex items-center justify-center text-lg overflow-hidden">
                          {item.groupPicture?<img src={item.groupPicture} className="w-10 h-10 rounded-full object-cover"/>:'👥'}
                        </div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        {pinned && <span className="text-[#00a884] text-xs flex-shrink-0">📌</span>}
                        {muted && <span className="text-[#8696a0] text-xs flex-shrink-0">🔇</span>}
                        <span className={`text-sm truncate ${unread>0?'text-[#e9edef] font-semibold':'text-[#e9edef] font-medium'}`}>{displayName}</span>
                      </div>
                      <span className={`text-xs flex-shrink-0 ${unread>0?'text-[#00a884]':'text-[#8696a0]'}`}>{fmtConvTime(item.updatedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        {!convTypingMap[item._id] && isMine && <Ticks status={lm?.status||'sent'}/>}
                        {convTypingMap[item._id]
                          ? <span className="text-xs text-[#00a884] font-medium flex-1 truncate">typing...</span>
                          : hasDraft
                          ? <span className="text-xs flex-1 truncate"><span className="text-red-400 font-medium">Draft: </span><span className="text-[#8696a0]">{drafts[item._id]}</span></span>
                          : <span className={`text-xs truncate flex-1 ${unread>0?'text-[#e9edef] font-medium':'text-[#8696a0]'}`}>
                              {unread>1?`${unread} new messages`
                                :lm?.isDeleted?'🚫 Deleted'
                                :lm?.messageType==='image'?'📷 Photo'
                                :lm?.messageType==='video'?'🎥 Video'
                                :lm?.messageType==='voice'?'🎤 Voice'
                                :lm?.messageType==='file'?`📎 ${lm.fileName||'File'}`
                                :lm?.messageText||'Tap to chat'}
                            </span>
                        }
                      </div>
                      {unread>0&&<span className="bg-[#00a884] text-white text-xs rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center flex-shrink-0 font-bold">{unread>99?'99+':unread}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Mobile Bottom Nav */}
        <div className="flex md:hidden items-center justify-around py-2 bg-[#202c33] border-t border-[#2a3942] flex-shrink-0">
          {[{id:'chats',icon:'💬',label:'Chats'},{id:'groups',icon:'👥',label:'Groups'},{id:'status',icon:'🔵',label:'Status'},{id:'contacts',icon:'🙍',label:'Contacts'}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${activeTab===t.id?'text-[#00a884]':'text-[#8696a0]'}`}>
              <span className="text-lg">{t.icon}</span>
              <span className="text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════ RIGHT PANEL: CHAT ══════ */}
      <div className={`${mobileView==='list'?'hidden md:flex':'flex'} flex-col flex-1 relative overflow-hidden`}
        style={{backgroundColor:'#0b141a',backgroundImage:"url(\"data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M50 50h20v20H50zM100 50h20v20h-20zM150 50h20v20h-20zM200 50h20v20h-20zM250 50h20v20h-20zM25 100h20v20H25zM75 100h20v20H75zM125 100h20v20h-20zM175 100h20v20h-20zM225 100h20v20h-20z'/%3E%3C/g%3E%3C/svg%3E\")"}}>

        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-5">
            <div className="w-28 h-28 bg-[#00a884]/10 rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-16 h-16 fill-[#00a884]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.121 1.535 5.856L.057 23.882a.75.75 0 00.961.961l6.026-1.478A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.92 0-3.722-.511-5.27-1.402l-.38-.22-3.927.963.963-3.928-.22-.379A9.951 9.951 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            </div>
            <div>
              <h2 className="text-[#e9edef] text-2xl font-light mb-2">NumberFree</h2>
              <p className="text-[#8696a0] text-sm">Select a chat or search for someone to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-[#2a3942] flex-shrink-0">
              <button onClick={goBack} className="md:hidden text-[#8696a0] hover:text-white p-1 -ml-1">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
              </button>
              <button onClick={()=>{setProfileUser(activeChatUser||activeChat.data);setShowProfile(true);}} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left">
                {activeChat.type==='dm'
                  ? <div className="relative flex-shrink-0"><Avatar user={activeChatUser} size="md"/>{activeChatOnline&&<span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#202c33]"/>}</div>
                  : <div className="w-10 h-10 bg-[#2a3942] rounded-full flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">{activeChat.data.groupPicture?<img src={activeChat.data.groupPicture} className="w-10 h-10 rounded-full object-cover"/>:'👥'}</div>}
                <div className="min-w-0">
                  <p className="text-[#e9edef] font-semibold text-sm leading-tight truncate">{activeChatName}</p>
                  <p className="text-xs leading-tight">
                    {typingText ? <span className="text-[#00a884]">{typingText}</span>
                     : activeChat.type==='dm'
                       ? iBlockedUsers[activeChatUser?._id] ? <span className="text-[#8696a0]">blocked</span>
                         : activeChatOnline ? <span className="text-[#00a884]">online</span>
                         : <span className="text-[#8696a0]">{onlineUsers[activeChatUser?._id]?.lastSeen ? `last seen ${fmtLastSeen(onlineUsers[activeChatUser?._id]?.lastSeen)}` : activeChatUser?.lastSeen ? `last seen ${fmtLastSeen(activeChatUser.lastSeen)}` : ''}</span>
                       : <span className="text-[#8696a0]">{activeChat.data.members?.length} members</span>}
                  </p>
                </div>
              </button>
              {/* Header actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Chat search */}
                <button onClick={()=>{setShowChatSearch(p=>!p);if(showChatSearch){setChatSearchQuery('');setChatSearchResults([]);}}}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.208 5.208 5.185 5.185 0 003.386-1.255l.221.22v.635l4.004 3.999 1.195-1.195-3.998-4.007z"/></svg>
                </button>
                {/* Group settings (admin only) */}
                {activeChat.type==='group' && (
                  <button onClick={()=>{setGroupSettingsForm({name:activeChat.data.name||'',description:activeChat.data.description||''});setShowGroupSettings(true);}}
                    className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                  </button>
                )}
                {/* DM options */}
                {activeChat.type==='dm' && (
                  <button onClick={()=>blockUser(activeChatUser?._id)} title={iBlockedUsers[activeChatUser?._id]?'Unblock':'Block'}
                    className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#2a3942] transition-colors ${iBlockedUsers[activeChatUser?._id]?'text-red-400':'text-[#8696a0]'}`}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.68L5.68 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.68L18.32 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Chat search bar */}
            {showChatSearch && (
              <div className="px-3 py-2 bg-[#202c33] border-b border-[#2a3942] flex-shrink-0">
                <div className="flex items-center bg-[#2a3942] rounded-full px-3 py-2 gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#8696a0] flex-shrink-0"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.208 5.208 5.185 5.185 0 003.386-1.255l.221.22v.635l4.004 3.999 1.195-1.195-3.998-4.007z"/></svg>
                  <input value={chatSearchQuery} onChange={e=>handleChatSearch(e.target.value)} placeholder="Search in conversation..." autoFocus
                    className="bg-transparent text-[#e9edef] placeholder-[#8696a0] text-sm flex-1 outline-none"/>
                  {chatSearchQuery && <button onClick={()=>{setChatSearchQuery('');setChatSearchResults([]);}} className="text-[#8696a0] hover:text-white">×</button>}
                </div>
                {chatSearchResults.length>0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto scrollbar-hide">
                    {chatSearchResults.map(m=>(
                      <button key={m._id} onClick={()=>scrollToMessage(m._id)} className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-[#2a3942] rounded-lg text-left">
                        <Avatar user={m.senderId} size="xs"/>
                        <div className="min-w-0">
                          <p className="text-[#e9edef] text-xs truncate">{m.messageText}</p>
                          <p className="text-[#8696a0] text-xs">{fmtTime(m.createdAt)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {chatSearchQuery && chatSearchResults.length===0 && <p className="text-[#8696a0] text-xs text-center py-2">No messages found</p>}
              </div>
            )}

            {/* Multi-select toolbar */}
            {selectedMsgs.length>0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-[#202c33] border-b border-[#2a3942] flex-shrink-0">
                <button onClick={()=>setSelectedMsgs([])} className="text-[#8696a0] hover:text-white">✕</button>
                <span className="text-[#e9edef] text-sm font-medium flex-1">{selectedMsgs.length} selected</span>
                <button onClick={()=>{
                  if (window.confirm(`Delete ${selectedMsgs.length} messages?`)) {
                    Promise.all(selectedMsgs.map(id => {
                      const msg = messages.find(m=>m._id===id);
                      return msg ? convAPI.deleteMessage(id, false) : Promise.resolve();
                    })).then(()=>{
                      setMessages(p=>p.filter(m=>!selectedMsgs.includes(m._id)));
                      setSelectedMsgs([]);
                      toast.success('Messages deleted');
                    }).catch(()=>toast.error('Some failed.'));
                  }
                }} className="text-red-400 hover:text-red-300 text-sm font-medium">
                  🗑️ Delete
                </button>
                <button onClick={()=>{
                  const msgsToFwd = messages.filter(m=>selectedMsgs.includes(m._id));
                  if (msgsToFwd.length===1) setForwardModal(msgsToFwd[0]);
                  else toast('Select one message to forward');
                  setSelectedMsgs([]);
                }} className="text-[#00a884] hover:text-[#00c79a] text-sm font-medium">
                  ↗️ Forward
                </button>
              </div>
            )}

            {/* Messages area */}
            <div ref={messagesContainerRef} onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-2 md:px-4 py-3 space-y-0.5 scrollbar-hide"
              onClick={()=>{setCtxMenu(null);setEmojiPicker(null);}}>
              {messages.map((msg,i) => {
                const isMine = (msg.senderId?._id||msg.senderId)===user._id;
                const senderInfo = typeof msg.senderId==='object' ? msg.senderId : null;
                const senderId = msg.senderId?._id||msg.senderId;
                const showDate = i===0 || !isSameDay(messages[i-1]?.createdAt, msg.createdAt);
                const showAvatar = !isMine && (i===messages.length-1||(messages[i+1]?.senderId?._id||messages[i+1]?.senderId)!==senderId);
                const isStarred = msg.starredBy?.some(id=>(id._id||id)===user._id);
                const swipeX = swipeState[msg._id]||0;
                const isSelected = selectedMsgs.includes(msg._id);

                const replySenderName = () => {
                  if (!msg.replyTo) return '';
                  const rSender = msg.replyTo.senderId;
                  const rSenderId = rSender?._id?.toString() || rSender?.toString?.() || rSender;
                  const rUsername = typeof rSender==='object'&&rSender!==null ? rSender.username : null;
                  if (rSenderId===user._id?.toString()||rSenderId===user._id) return 'You';
                  return getContactName(rSenderId, rUsername||'User');
                };

                return (
                  <div key={msg._id||i}>
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="bg-[#182229] text-[#8696a0] text-xs px-3 py-1 rounded-full shadow">{fmtDate(msg.createdAt)}</span>
                      </div>
                    )}
                    <div
                      id={`msg-${msg._id}`}
                      className={`flex ${isMine?'justify-end':'justify-start'} items-end gap-1 mb-0.5 group ${isSelected?'bg-[#00a884]/10 rounded-lg':''}`}
                      style={{transform:`translateX(${swipeX}px)`,transition:swipeX===0?'transform 0.2s':'none'}}
                      onTouchStart={e=>!msg.isDeleted&&handleTouchStartSwipe(e,msg)}
                      onTouchMove={e=>!msg.isDeleted&&handleTouchMoveSwipe(e,msg)}
                      onTouchEnd={e=>!msg.isDeleted&&handleTouchEndSwipe(e,msg)}
                      onClick={e=>{if(selectedMsgs.length>0&&!msg.isDeleted){e.stopPropagation();setSelectedMsgs(p=>p.includes(msg._id)?p.filter(id=>id!==msg._id):[...p,msg._id]);}}}>

                      {/* Multi-select checkbox */}
                      {selectedMsgs.length>0 && !msg.isDeleted && (
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center cursor-pointer ${isSelected?'bg-[#00a884] border-[#00a884]':'border-[#8696a0]'}`}>
                          {isSelected&&<span className="text-white text-xs font-bold">✓</span>}
                        </div>
                      )}

                      {!isMine && activeChat.type==='group' && (
                        <div className="w-7 flex-shrink-0">{showAvatar&&<Avatar user={senderInfo} size="xs"/>}</div>
                      )}
                      {swipeX>20 && (
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#00a884]/20 text-[#00a884] flex-shrink-0">
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                        </div>
                      )}

                      <div className={`max-w-[78%] md:max-w-[60%] relative ${isMine?'order-2':'order-1'}`}>
                        {/* Emoji picker */}
                        {emojiPicker===msg._id && (
                          <div className={`absolute bottom-full mb-1 ${isMine?'right-0':'left-0'} flex gap-1 bg-[#233138] rounded-full px-2 py-1.5 shadow-xl z-20`} onClick={e=>e.stopPropagation()}>
                            {EMOJIS.map(e=>(
                              <button key={e} onClick={()=>reactToMessage(msg._id,e)} className="text-lg hover:scale-125 transition-transform leading-none">{e}</button>
                            ))}
                          </div>
                        )}

                        {/* Reply preview */}
                        {msg.replyTo && !msg.isDeleted && (
                          <div onClick={e=>{e.stopPropagation();const el=document.getElementById(`msg-${msg.replyTo._id}`);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('msg-highlight');setTimeout(()=>el.classList.remove('msg-highlight'),1500);}}}
                            className={`mb-0.5 px-3 py-1.5 rounded-t-lg border-l-4 border-[#00a884] cursor-pointer hover:opacity-80 transition-opacity ${isMine?'bg-[#004a3d]':'bg-[#182229]'}`}>
                            <p className="text-[#00a884] font-semibold text-xs mb-0.5">{replySenderName()}</p>
                            <p className="text-[#8696a0] text-xs truncate">
                              {msg.replyTo.messageType==='image'?'📷 Photo':msg.replyTo.messageType==='video'?'🎥 Video':msg.replyTo.messageType==='voice'?'🎤 Voice':msg.replyTo.messageType==='file'?`📎 ${msg.replyTo.fileName||'File'}`:msg.replyTo.messageText||'Message'}
                            </p>
                          </div>
                        )}

                        {/* Forwarded label */}
                        {msg.isForwarded && !msg.isDeleted && (
                          <p className={`text-xs text-[#8696a0] italic mb-0.5 ${isMine?'text-right':'text-left'}`}>↗️ Forwarded</p>
                        )}

                        {/* Group sender name */}
                        {!isMine && activeChat.type==='group' && !msg.isDeleted && (
                          <p className="text-xs font-semibold mb-0.5 ml-1" style={{color:'#00a884'}}>{getContactName(senderId, senderInfo?.username)}</p>
                        )}

                        <div
                          onContextMenu={e=>{e.preventDefault();e.stopPropagation();if(!msg.isDeleted&&selectedMsgs.length===0)setCtxMenu({x:e.clientX,y:e.clientY,msg,isMine});}}
                          onTouchStart={e=>{if(!msg.isDeleted&&selectedMsgs.length===0){const t=setTimeout(()=>{const tc=e.touches[0];setCtxMenu({x:tc.clientX,y:tc.clientY,msg,isMine});},600);e.currentTarget._lt=t;}}}
                          onTouchEnd={e=>{clearTimeout(e.currentTarget._lt);}}
                          onDoubleClick={()=>!msg.isDeleted&&setEmojiPicker(msg._id)}
                          className={`px-3 py-2 rounded-xl shadow-sm select-none relative cursor-pointer
                            ${isMine?'bg-[#005c4b] rounded-tr-none':'bg-[#202c33] rounded-tl-none'}
                            ${msg.isDeleted?'opacity-60':''}`}>
                          {isStarred&&!msg.isDeleted&&<span className="absolute -top-1 -right-1 text-xs">⭐</span>}

                          {msg.isDeleted ? (
                            <p className="text-sm italic text-[#8696a0]">🚫 This message was deleted</p>
                          ) : msg.messageType==='image'&&msg.fileUrl ? (
                            <div>
                              <img src={msg.fileUrl} alt="img" onClick={e=>{e.stopPropagation();setMediaViewer({url:msg.fileUrl,type:'image'});}}
                                className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity" loading="lazy"/>
                              {msg.messageText&&<p className="text-sm text-[#e9edef] mt-1 break-words">{msg.messageText}</p>}
                            </div>
                          ) : msg.messageType==='video'&&msg.fileUrl ? (
                            <div>
                              <div onClick={e=>{e.stopPropagation();setMediaViewer({url:msg.fileUrl,type:'video'});}}
                                className="relative cursor-pointer hover:opacity-90 transition-opacity">
                                <video src={msg.fileUrl} className="rounded-lg max-w-full max-h-48 object-cover"/>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M8 5v14l11-7z"/></svg>
                                  </div>
                                </div>
                              </div>
                              {msg.messageText&&<p className="text-sm text-[#e9edef] mt-1 break-words">{msg.messageText}</p>}
                            </div>
                          ) : msg.messageType==='voice' ? (
                            <div className="flex items-center gap-2 min-w-[160px]">
                              <button onClick={e=>{e.stopPropagation();const a=document.getElementById(`audio-${msg._id}`);a&&(a.paused?a.play():a.pause());}} className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0">
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M8 5v14l11-7z"/></svg>
                              </button>
                              <audio id={`audio-${msg._id}`} src={msg.fileUrl} className="hidden"/>
                              <div className="flex-1 h-1 bg-[#8696a0]/40 rounded-full overflow-hidden">
                                <div className="h-full bg-[#00a884] w-0 rounded-full"/>
                              </div>
                              <span className="text-[#8696a0] text-xs">{msg.duration?`${Math.floor(msg.duration/60)}:${String(msg.duration%60).padStart(2,'0')}`:'0:00'}</span>
                            </div>
                          ) : msg.messageType==='file'&&msg.fileUrl ? (
                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                              className="flex items-center gap-2 min-w-[160px] hover:opacity-80 transition-opacity">
                              <div className="w-10 h-10 bg-[#00a884]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#00a884]"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[#e9edef] text-sm font-medium truncate">{msg.fileName||'File'}</p>
                                <p className="text-[#8696a0] text-xs">{fmtFileSize(msg.fileSize)}</p>
                              </div>
                            </a>
                          ) : (
                            <p className="text-sm text-[#e9edef] leading-relaxed break-words whitespace-pre-wrap">
                              {msg.isEdited&&<span className="text-[#8696a0] text-xs italic mr-1">edited </span>}
                              {msg.messageText}
                            </p>
                          )}

                          {/* Scheduled label */}
                          {msg.isScheduled && (
                            <p className="text-[#f59e0b] text-xs mt-1">🕐 Scheduled</p>
                          )}

                          {!msg.isDeleted && (
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[#8696a0] text-xs">{fmtTime(msg.createdAt)}</span>
                              {isMine&&<Ticks status={msg.status||'sent'}/>}
                            </div>
                          )}
                        </div>

                        {/* Reactions */}
                        {msg.reactions?.length>0&&!msg.isDeleted&&(
                          <div className={`flex flex-wrap gap-0.5 mt-0.5 ${isMine?'justify-end':'justify-start'}`}>
                            {Object.entries(msg.reactions.reduce((a,r)=>{a[r.emoji]=(a[r.emoji]||0)+1;return a},{})).map(([e,c])=>(
                              <button key={e} onClick={()=>reactToMessage(msg._id,e)} className="bg-[#202c33] hover:bg-[#2a3942] rounded-full px-1.5 py-0.5 text-xs border border-[#2a3942] transition-colors">
                                {e}{c>1&&<span className="text-[#8696a0] ml-0.5">{c}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quick react button */}
                      {!msg.isDeleted&&selectedMsgs.length===0 && (
                        <button onClick={e=>{e.stopPropagation();setEmojiPicker(p=>p===msg._id?null:msg._id);}}
                          className={`hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 items-center justify-center rounded-full hover:bg-[#2a3942] text-[#8696a0] flex-shrink-0 ${isMine?'order-1':'order-2'}`}>
                          <span className="text-sm">😊</span>
                        </button>
                      )}
                      {/* Desktop reply button */}
                      {!msg.isDeleted&&selectedMsgs.length===0 && (
                        <button onClick={e=>{e.stopPropagation();setReplyingTo(msg);setTimeout(()=>textareaRef.current?.focus(),50);}}
                          className={`hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 items-center justify-center rounded-full hover:bg-[#2a3942] text-[#8696a0] flex-shrink-0 ${isMine?'order-1 mr-1':'order-2 ml-1'}`}>
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef}/>
            </div>

            {/* Scroll to bottom button */}
            {showScrollBtn && (
              <button onClick={scrollToBottom}
                className="absolute right-4 bottom-24 w-10 h-10 bg-[#202c33] hover:bg-[#2a3942] rounded-full shadow-lg flex items-center justify-center text-[#8696a0] hover:text-white transition-all border border-[#2a3942]">
                {newMsgCount>0 && (
                  <span className="absolute -top-2 -right-1 bg-[#00a884] text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">{newMsgCount}</span>
                )}
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M7 10l5 5 5-5z"/></svg>
              </button>
            )}

            {/* Context Menu */}
            {ctxMenu && (
              <div className="fixed bg-[#233138] rounded-2xl shadow-2xl overflow-hidden z-50 min-w-[200px] py-1"
                style={{left:Math.min(ctxMenu.x,window.innerWidth-220),top:Math.min(ctxMenu.y,window.innerHeight-380)}}
                onClick={e=>e.stopPropagation()}>
                <button onClick={()=>{setReplyingTo(ctxMenu.msg);setCtxMenu(null);textareaRef.current?.focus();}} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-3">↩️ Reply</button>
                <button onClick={()=>{setForwardModal(ctxMenu.msg);setCtxMenu(null);}} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-3">↗️ Forward</button>
                {ctxMenu.msg.messageType==='text'&&<button onClick={()=>{navigator.clipboard?.writeText(ctxMenu.msg.messageText||'');toast.success('Copied!');setCtxMenu(null);}} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-3">📋 Copy</button>}
                <button onClick={()=>{setEmojiPicker(ctxMenu.msg._id);setCtxMenu(null);}} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-3">😊 React</button>
                {ctxMenu.isMine&&ctxMenu.msg.messageType==='text'&&<button onClick={()=>{setEditingMsg(ctxMenu.msg);setMessageText(ctxMenu.msg.messageText||'');setCtxMenu(null);setTimeout(()=>textareaRef.current?.focus(),50);}} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-3">✏️ Edit</button>}
                <button onClick={()=>starMessage(ctxMenu.msg)} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-3">⭐ {ctxMenu.msg.starredBy?.some(id=>(id._id||id)===user._id)?'Unstar':'Star'}</button>
                <button onClick={()=>{setMsgInfoModal(ctxMenu.msg);setCtxMenu(null);}} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-3">ℹ️ Info</button>
                <button onClick={()=>{setSelectedMsgs([ctxMenu.msg._id]);setCtxMenu(null);}} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-3">☑️ Select</button>
                <div className="border-t border-[#2a3942] my-1"/>
                <button onClick={()=>deleteMessage(ctxMenu.msg, false)} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-3">🗑️ Delete for me</button>
                {ctxMenu.isMine&&<button onClick={()=>deleteMessage(ctxMenu.msg, true)} className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-[#2a3942] flex items-center gap-3">🗑️ Delete for everyone</button>}
              </div>
            )}

            {/* Chat list right-click menu */}
            {chatCtxMenu && (
              <div className="fixed bg-[#233138] rounded-2xl shadow-2xl overflow-hidden z-50 min-w-[180px] py-1"
                style={{left:Math.min(chatCtxMenu.x,window.innerWidth-200),top:Math.min(chatCtxMenu.y,window.innerHeight-260)}}
                onClick={e=>e.stopPropagation()}>
                <button onClick={()=>pinChat(chatCtxMenu.item._id)} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942]">
                  {isPinned(chatCtxMenu.item._id)?'📌 Unpin':'📌 Pin'}
                </button>
                <button onClick={()=>{setMuteModal(chatCtxMenu.item._id);setChatCtxMenu(null);}} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942]">
                  {isMuted(chatCtxMenu.item._id)?'🔊 Unmute':'🔇 Mute'}
                </button>
                <button onClick={()=>deleteChatForMe(chatCtxMenu.item._id)} className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-[#2a3942]">
                  🗑️ Delete chat
                </button>
              </div>
            )}

            {/* Reply bar */}
            {replyingTo && (
              <div className="flex items-center gap-3 px-4 py-2 bg-[#182229] border-t border-[#2a3942] flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#00a884] flex-shrink-0"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                <div className="flex-1 border-l-4 border-[#00a884] pl-2 min-w-0">
                  <p className="text-[#00a884] text-xs font-semibold">
                    {(()=>{const sid=replyingTo.senderId?._id?.toString()||replyingTo.senderId?.toString?.();const uname=typeof replyingTo.senderId==='object'?replyingTo.senderId?.username:null;return sid===user._id?.toString()?'You':getContactName(sid,uname||'User');})()}
                  </p>
                  <p className="text-[#8696a0] text-xs truncate">{replyingTo.messageType==='image'?'📷 Photo':replyingTo.messageType==='video'?'🎥 Video':replyingTo.messageType==='voice'?'🎤 Voice':replyingTo.messageType==='file'?`📎 ${replyingTo.fileName||'File'}`:replyingTo.messageText}</p>
                </div>
                <button onClick={()=>setReplyingTo(null)} className="text-[#8696a0] hover:text-white text-xl p-1 flex-shrink-0">×</button>
              </div>
            )}

            {/* Edit bar */}
            {editingMsg && (
              <div className="flex items-center gap-3 px-4 py-2 bg-[#182229] border-t border-[#2a3942] flex-shrink-0">
                <span className="text-[#f59e0b] text-lg flex-shrink-0">✏️</span>
                <div className="flex-1 border-l-4 border-[#f59e0b] pl-2 min-w-0">
                  <p className="text-[#f59e0b] text-xs font-semibold">Editing message</p>
                  <p className="text-[#8696a0] text-xs truncate">{editingMsg.messageText}</p>
                </div>
                <button onClick={()=>{setEditingMsg(null);setMessageText('');}} className="text-[#8696a0] hover:text-white text-xl p-1 flex-shrink-0">×</button>
              </div>
            )}

            {/* File preview bar */}
            {filePreview && (
              <div className="flex items-center gap-3 px-4 py-2 bg-[#182229] border-t border-[#2a3942] flex-shrink-0">
                {filePreview.type==='image' && <img src={filePreview.url} alt="preview" className="w-12 h-12 rounded-lg object-cover flex-shrink-0"/>}
                {filePreview.type==='video' && (
                  <div className="w-12 h-12 rounded-lg bg-[#2a3942] flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🎥</span>
                  </div>
                )}
                {filePreview.type==='file' && (
                  <div className="w-12 h-12 rounded-lg bg-[#2a3942] flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">📎</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[#e9edef] text-xs font-medium truncate">{filePreview.name}</p>
                  <p className="text-[#8696a0] text-xs">{fmtFileSize(filePreview.size)}</p>
                  {uploadProgress!==null && (
                    <div className="mt-1 w-full h-1.5 bg-[#2a3942] rounded-full overflow-hidden">
                      <div className="h-full bg-[#00a884] rounded-full transition-all" style={{width:`${uploadProgress}%`}}/>
                    </div>
                  )}
                </div>
                <button onClick={()=>setFilePreview(null)} className="text-[#8696a0] hover:text-white text-xl p-1 flex-shrink-0">×</button>
              </div>
            )}

            {/* Blocked by them */}
            {activeChat.type==='dm' && blockedByUsers[activeChatUser?._id] && (
              <div className="flex items-center justify-center py-4 bg-[#202c33] border-t border-[#2a3942] flex-shrink-0">
                <p className="text-[#8696a0] text-sm">🚫 You can't send messages to this person</p>
              </div>
            )}

            {/* I blocked them */}
            {activeChat.type==='dm' && iBlockedUsers[activeChatUser?._id] && (
              <div className="flex items-center justify-center gap-3 py-3 bg-[#202c33] border-t border-[#2a3942] flex-shrink-0">
                <p className="text-[#8696a0] text-sm">You blocked this contact.</p>
                <button onClick={()=>blockUser(activeChatUser?._id)} className="text-[#00a884] text-sm font-semibold hover:underline">Unblock</button>
              </div>
            )}

            {/* Input bar */}
            {(activeChat.type!=='dm' || (!blockedByUsers[activeChatUser?._id] && !iBlockedUsers[activeChatUser?._id])) && (
              <div className="flex items-end gap-2 px-3 py-3 bg-[#202c33] flex-shrink-0">
                {/* File inputs (hidden) */}
                <input type="file" ref={fileInputRef} accept="image/*" onChange={e=>handleFileSelect(e,'image')} className="hidden"/>
                <input type="file" ref={videoInputRef} accept="video/*" onChange={e=>handleFileSelect(e,'video')} className="hidden"/>
                <input type="file" ref={docInputRef} onChange={e=>handleFileSelect(e,'file')} className="hidden"/>

                {/* Attach button */}
                <div className="relative group/attach">
                  <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M21.586 10.461l-10.05 10.075a6.5 6.5 0 01-9.2-9.186l10.05-10.075a4.333 4.333 0 016.13 6.131L8.48 17.48a2.167 2.167 0 01-3.066-3.065l9.021-9.038-1.414-1.414-9.021 9.038a4.333 4.333 0 006.13 6.131l10.038-10.064a6.5 6.5 0 00-9.2-9.186l-10.05 10.075 1.414 1.415z"/></svg>
                  </button>
                  {/* Attach dropdown */}
                  <div className="absolute bottom-full left-0 mb-2 bg-[#233138] rounded-2xl shadow-xl overflow-hidden hidden group-hover/attach:block min-w-[140px] z-20">
                    <button onClick={()=>fileInputRef.current?.click()} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-2">📷 Image</button>
                    <button onClick={()=>videoInputRef.current?.click()} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-2">🎥 Video</button>
                    <button onClick={()=>docInputRef.current?.click()} className="w-full px-4 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-2">📎 File</button>
                  </div>
                </div>

                {/* Text input */}
                <div className="flex-1 bg-[#2a3942] rounded-3xl flex items-end px-4 py-2 gap-2 min-h-[44px]">
                  <textarea ref={textareaRef} value={messageText} onChange={handleInput}
                    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                    placeholder={editingMsg?"Edit message...":"Type a message"} rows={1}
                    className="flex-1 bg-transparent text-[#e9edef] placeholder-[#8696a0] text-sm outline-none resize-none leading-relaxed py-1"
                    style={{maxHeight:'120px',scrollbarWidth:'none'}}/>
                </div>

                {/* Send / Record button */}
                {recording ? (
                  <button onClick={stopRecording} className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500 animate-pulse flex-shrink-0 text-white text-xs font-bold">
                    {Math.floor(recordingTime/60)}:{String(recordingTime%60).padStart(2,'0')}
                  </button>
                ) : messageText.trim()||filePreview ? (
                  <button onClick={sendMessage} disabled={sending}
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 shadow-md ${sending?'bg-[#2a3942]':'bg-[#00a884] hover:bg-[#00c79a]'}`}>
                    {sending?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>}
                  </button>
                ) : (
                  <button onClick={startRecording} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════ MODALS ══════ */}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setShowSettings(false)}>
          <div className="bg-[#111b21] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#202c33] px-4 py-4 flex items-center justify-between">
              <h2 className="text-[#e9edef] font-semibold">Settings</h2>
              <button onClick={()=>setShowSettings(false)} className="text-[#8696a0] hover:text-white text-2xl">×</button>
            </div>
            {/* Settings tabs */}
            <div className="flex border-b border-[#2a3942]">
              {[{id:'profile',label:'Profile'},{id:'password',label:'Password'},{id:'delete',label:'Delete Account'}].map(t=>(
                <button key={t.id} onClick={()=>setSettingsTab(t.id)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${settingsTab===t.id?'text-[#00a884] border-[#00a884]':'text-[#8696a0] border-transparent'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto scrollbar-hide">
              {settingsTab==='profile' && (
                <>
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      <Avatar user={user} size="xl"/>
                      <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#00a884] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#00c79a]">
                        {uploadingAvatar?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>}
                        <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
                      </label>
                    </div>
                  </div>
                  <input value={profileForm.displayName} onChange={e=>setProfileForm(p=>({...p,displayName:e.target.value}))} placeholder="Display name"
                    className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm"/>
                  <textarea value={profileForm.bio} onChange={e=>setProfileForm(p=>({...p,bio:e.target.value}))} maxLength={150} placeholder="Bio" rows={2}
                    className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm resize-none"/>
                  <input value={profileForm.customStatus} onChange={e=>setProfileForm(p=>({...p,customStatus:e.target.value}))} placeholder="Custom status (e.g. Busy, At work...)"
                    className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm"/>
                  <button onClick={async()=>{
                    try {
                      await authAPI.updateProfile({ bio:profileForm.bio, displayName:profileForm.displayName, customStatus:profileForm.customStatus });
                      updateUser({ bio:profileForm.bio, displayName:profileForm.displayName, customStatus:profileForm.customStatus });
                      toast.success('Profile updated!'); setShowSettings(false);
                    } catch { toast.error('Failed.'); }
                  }} className="w-full py-3 bg-[#00a884] hover:bg-[#00c79a] text-white rounded-xl font-bold text-sm">Save Changes</button>
                  <button onClick={()=>{setShowSettings(false);setShowProfile(true);setProfileUser(null);}} className="w-full py-2.5 bg-[#2a3942] hover:bg-[#364a52] text-[#e9edef] rounded-xl text-sm">View Profile</button>
                </>
              )}
              {settingsTab==='password' && (
                <>
                  <p className="text-[#8696a0] text-xs">Change your account password</p>
                  {[{k:'current',p:'Current password',t:'password'},{k:'new',p:'New password',t:'password'},{k:'confirm',p:'Confirm new password',t:'password'}].map(f=>(
                    <input key={f.k} type={f.t} value={pwForm[f.k]} onChange={e=>setPwForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p}
                      className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm"/>
                  ))}
                  <button onClick={handleChangePassword} disabled={pwLoading}
                    className="w-full py-3 bg-[#00a884] hover:bg-[#00c79a] disabled:opacity-50 text-white rounded-xl font-bold text-sm">
                    {pwLoading?'Changing...':'Change Password'}
                  </button>
                </>
              )}
              {settingsTab==='delete' && (
                <>
                  <div className="text-center py-4">
                    <p className="text-3xl mb-3">⚠️</p>
                    <p className="text-[#e9edef] font-semibold mb-1">Delete Account</p>
                    <p className="text-[#8696a0] text-xs mb-4">This will permanently delete your account. Your messages will remain but show as "Deleted Account".</p>
                  </div>
                  <input type="password" value={deleteForm.password} onChange={e=>setDeleteForm({password:e.target.value})} placeholder="Enter your password to confirm"
                    className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-red-500 text-sm"/>
                  <button onClick={handleDeleteAccount} disabled={deleteLoading||!deleteForm.password}
                    className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm">
                    {deleteLoading?'Deleting...':'Delete My Account'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>{setShowProfile(false);setEditingProfile(false);}}>
          <div className="bg-[#111b21] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#202c33] px-4 py-4 flex items-center justify-between">
              <h2 className="text-[#e9edef] font-semibold">{profileUser?`${profileUser.username}'s Profile`:'My Profile'}</h2>
              <button onClick={()=>{setShowProfile(false);setEditingProfile(false);}} className="text-[#8696a0] hover:text-white text-2xl">×</button>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
              <div className="relative">
                {profileUser
                  ? <Avatar user={profileUser} size="xxl"/>
                  : <>
                    <Avatar user={user} size="xxl"/>
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#00a884] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#00c79a]">
                      {uploadingAvatar?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>}
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
                    </label>
                  </>
                }
              </div>
              {editingProfile ? (
                <div className="w-full space-y-3">
                  <input value={profileForm.displayName} onChange={e=>setProfileForm(p=>({...p,displayName:e.target.value}))} placeholder="Display name"
                    className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm"/>
                  <textarea value={profileForm.bio} onChange={e=>setProfileForm(p=>({...p,bio:e.target.value}))} maxLength={150} placeholder="Bio" rows={3}
                    className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm resize-none"/>
                  <div className="flex gap-2">
                    <button onClick={async()=>{try{await authAPI.updateProfile(profileForm);updateUser(profileForm);setEditingProfile(false);toast.success('Profile updated!');}catch{toast.error('Failed.');}}} className="flex-1 py-2 bg-[#00a884] text-white rounded-xl font-semibold text-sm">Save</button>
                    <button onClick={()=>setEditingProfile(false)} className="flex-1 py-2 bg-[#2a3942] text-[#e9edef] rounded-xl font-semibold text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-[#e9edef] font-bold text-lg">{(profileUser||user)?.displayName || (profileUser||user)?.username}</p>
                    <p className="text-[#8696a0] text-sm">@{(profileUser||user)?.username}</p>
                    {(profileUser||user)?.customStatus && <p className="text-[#00a884] text-sm mt-1">{(profileUser||user).customStatus}</p>}
                    <p className="text-[#8696a0] text-sm mt-1">{(profileUser||user)?.bio||'No bio set'}</p>
                  </div>
                  <div className="w-full space-y-2">
                    {!profileUser && (
                      <div className="flex items-center gap-3 px-3 py-2 bg-[#202c33] rounded-xl">
                        <span className="text-[#8696a0] text-lg">📧</span>
                        <div><p className="text-[#8696a0] text-xs">Email</p><p className="text-[#e9edef] text-sm">{user?.email}</p></div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 px-3 py-2 bg-[#202c33] rounded-xl">
                      <span className="text-[#8696a0] text-lg">📅</span>
                      <div><p className="text-[#8696a0] text-xs">Joined</p><p className="text-[#e9edef] text-sm">{new Date((profileUser||user)?.createdAt).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</p></div>
                    </div>
                  </div>
                  {!profileUser ? (
                    <button onClick={()=>{setEditingProfile(true);setProfileForm({bio:user.bio||'',displayName:user.displayName||user.username,customStatus:user.customStatus||''});}} className="w-full py-2.5 bg-[#2a3942] hover:bg-[#364a52] text-[#e9edef] rounded-xl font-semibold text-sm">✏️ Edit Profile</button>
                  ) : (
                    <div className="space-y-2 w-full">
                      <div className="flex gap-2">
                        <button onClick={()=>{startDM(profileUser);setShowProfile(false);}} className="flex-1 py-2.5 bg-[#00a884] hover:bg-[#00c79a] text-white rounded-xl font-semibold text-sm">💬 Message</button>
                        <button onClick={()=>blockUser(profileUser._id)} className="flex-1 py-2.5 bg-[#2a3942] hover:bg-red-500/20 text-red-400 rounded-xl font-semibold text-sm">
                          {iBlockedUsers[profileUser._id]?'🔓 Unblock':'🚫 Block'}
                        </button>
                      </div>
                      <SaveContactButton userId={profileUser._id} username={profileUser.username} contacts={contacts} setContacts={setContacts}/>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group Settings / Options Modal */}
      {showGroupSettings && activeChat?.type==='group' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setShowGroupSettings(false)}>
          <div className="bg-[#111b21] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#202c33] px-4 py-4 flex items-center justify-between">
              <h2 className="text-[#e9edef] font-semibold">Group Options</h2>
              <button onClick={()=>setShowGroupSettings(false)} className="text-[#8696a0] hover:text-white text-2xl">×</button>
            </div>
            <div className="p-4 space-y-2">
              {isAdmin && (
                <>
                  <p className="text-[#8696a0] text-xs uppercase tracking-wider mb-2">Admin Actions</p>
                  <button onClick={()=>setShowAddMember(true)} className="w-full py-3 bg-[#2a3942] hover:bg-[#364a52] text-[#e9edef] rounded-xl text-sm text-left px-4 flex items-center gap-3">
                    <span>👤</span> Add Member
                  </button>
                  <div className="border-t border-[#2a3942] py-2">
                    <p className="text-[#8696a0] text-xs uppercase tracking-wider mb-2">Edit Group</p>
                    <input value={groupSettingsForm.name} onChange={e=>setGroupSettingsForm(p=>({...p,name:e.target.value}))} placeholder="Group name"
                      className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm mb-2"/>
                    <input value={groupSettingsForm.description} onChange={e=>setGroupSettingsForm(p=>({...p,description:e.target.value}))} placeholder="Description"
                      className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm mb-2"/>
                    <button onClick={async()=>{
                      try {
                        const {data} = await groupAPI.update(activeChat.data._id, groupSettingsForm);
                        setGroups(p=>p.map(g=>g._id===data._id?data:g));
                        setActiveChat(p=>({...p,data}));
                        toast.success('Group updated!'); setShowGroupSettings(false);
                      } catch { toast.error('Failed.'); }
                    }} className="w-full py-2.5 bg-[#00a884] hover:bg-[#00c79a] text-white rounded-xl text-sm font-bold">Save</button>
                  </div>
                </>
              )}
              <div className="border-t border-[#2a3942] pt-2 space-y-2">
                <button onClick={clearChatHistory} className="w-full py-3 bg-[#2a3942] hover:bg-[#364a52] text-[#e9edef] rounded-xl text-sm text-left px-4 flex items-center gap-3">
                  <span>🧹</span> Clear Chat History (for me)
                </button>
                <button onClick={()=>leaveGroup(activeChat.data._id)} className="w-full py-3 bg-[#2a3942] hover:bg-orange-500/20 text-orange-400 rounded-xl text-sm text-left px-4 flex items-center gap-3">
                  <span>🚪</span> Leave Group
                </button>
                {(activeChat.data.admin?._id||activeChat.data.admin)===user._id && (
                  <button onClick={()=>{if(window.confirm('Delete this group for everyone?'))deleteGroup(activeChat.data._id);}} className="w-full py-3 bg-[#2a3942] hover:bg-red-500/20 text-red-400 rounded-xl text-sm text-left px-4 flex items-center gap-3">
                    <span>🗑️</span> Delete Group
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mute Modal */}
      {muteModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setMuteModal(null)}>
          <div className="bg-[#111b21] rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#202c33] px-4 py-4">
              <h2 className="text-[#e9edef] font-semibold">Mute Notifications</h2>
            </div>
            <div className="p-4 space-y-2">
              {[{d:'8h',l:'8 Hours'},{d:'1w',l:'1 Week'},{d:'always',l:'Always'}].map(o=>(
                <button key={o.d} onClick={()=>muteChat(muteModal,o.d)}
                  className="w-full py-3 text-left px-4 bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef] rounded-xl text-sm">
                  🔇 {o.l}
                </button>
              ))}
              {isMuted(muteModal) && (
                <button onClick={()=>muteChat(muteModal,'unmute')}
                  className="w-full py-3 text-left px-4 bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] rounded-xl text-sm">
                  🔊 Unmute
                </button>
              )}
              <button onClick={()=>setMuteModal(null)} className="w-full py-3 text-center bg-[#2a3942] text-[#8696a0] rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {forwardModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setForwardModal(null)}>
          <div className="bg-[#111b21] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl max-h-[80vh] flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#202c33] px-4 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-[#e9edef] font-semibold">Forward Message</h2>
              <button onClick={()=>setForwardModal(null)} className="text-[#8696a0] hover:text-white text-2xl">×</button>
            </div>
            <div className="p-3 bg-[#202c33] border-b border-[#2a3942] flex-shrink-0">
              <p className="text-[#8696a0] text-xs mb-2">Forwarding to:</p>
              <p className="text-[#e9edef] text-sm bg-[#2a3942] rounded-xl px-3 py-2 truncate">
                {forwardModal.messageType==='image'?'📷 Photo':forwardModal.messageType==='video'?'🎥 Video':forwardModal.messageType==='file'?'📎 File':forwardModal.messageText?.slice(0,60)||'Message'}
              </p>
            </div>
            <div className="overflow-y-auto flex-1 scrollbar-hide">
              <p className="text-[#8696a0] text-xs px-4 py-2 uppercase tracking-wider">Chats</p>
              {conversations.map(c=>{
                const other = getOther(c);
                return (
                  <button key={c._id} onClick={()=>forwardMessage(forwardModal,c._id,null)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] transition-colors">
                    <Avatar user={other} size="md"/>
                    <span className="text-[#e9edef] text-sm">{getContactName(other?._id, other?.username)}</span>
                  </button>
                );
              })}
              {groups.length>0 && <p className="text-[#8696a0] text-xs px-4 py-2 uppercase tracking-wider">Groups</p>}
              {groups.map(g=>(
                <button key={g._id} onClick={()=>forwardMessage(forwardModal,null,g._id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] transition-colors">
                  <div className="w-10 h-10 bg-[#2a3942] rounded-full flex items-center justify-center text-lg">{g.groupPicture?<img src={g.groupPicture} className="w-10 h-10 rounded-full object-cover"/>:'👥'}</div>
                  <span className="text-[#e9edef] text-sm">{g.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Message Info Modal */}
      {msgInfoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setMsgInfoModal(null)}>
          <div className="bg-[#111b21] rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#202c33] px-4 py-4 flex items-center justify-between">
              <h2 className="text-[#e9edef] font-semibold">Message Info</h2>
              <button onClick={()=>setMsgInfoModal(null)} className="text-[#8696a0] hover:text-white text-2xl">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-[#202c33] rounded-xl px-4 py-3">
                <p className="text-[#8696a0] text-xs mb-1">Sent</p>
                <p className="text-[#e9edef] text-sm">{new Date(msgInfoModal.createdAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}</p>
              </div>
              {msgInfoModal.seenAt && (
                <div className="bg-[#202c33] rounded-xl px-4 py-3">
                  <p className="text-[#8696a0] text-xs mb-1">Read</p>
                  <p className="text-[#e9edef] text-sm">{new Date(msgInfoModal.seenAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}</p>
                </div>
              )}
              <div className="bg-[#202c33] rounded-xl px-4 py-3">
                <p className="text-[#8696a0] text-xs mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <Ticks status={msgInfoModal.status||'sent'}/>
                  <p className="text-[#e9edef] text-sm capitalize">{msgInfoModal.status||'sent'}</p>
                </div>
              </div>
              {msgInfoModal.reactions?.length>0 && (
                <div className="bg-[#202c33] rounded-xl px-4 py-3">
                  <p className="text-[#8696a0] text-xs mb-2">Reactions</p>
                  <div className="flex flex-wrap gap-2">
                    {msgInfoModal.reactions.map((r,i)=>(
                      <span key={i} className="text-sm">{r.emoji} {r.username}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Create */}
      {showStatusCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setShowStatusCreate(false)}>
          <div className="bg-[#111b21] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#202c33] px-4 py-4 flex items-center justify-between">
              <h2 className="text-[#e9edef] font-semibold">New Status</h2>
              <button onClick={()=>setShowStatusCreate(false)} className="text-[#8696a0] hover:text-white text-2xl">×</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="rounded-xl p-4 text-center min-h-24 flex items-center justify-center" style={{backgroundColor:newStatus.backgroundColor}}>
                <p className="text-white font-medium text-base break-words">{newStatus.content||'Type your status...'}</p>
              </div>
              <textarea value={newStatus.content} onChange={e=>setNewStatus(p=>({...p,content:e.target.value}))} placeholder="What's on your mind?" maxLength={200} rows={3}
                className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm resize-none" autoFocus/>
              <div className="flex gap-2 flex-wrap">
                {BG_COLORS.map(c=>(
                  <button key={c} onClick={()=>setNewStatus(p=>({...p,backgroundColor:c}))}
                    className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${newStatus.backgroundColor===c?'ring-2 ring-white scale-110':''}`} style={{backgroundColor:c}}/>
                ))}
              </div>
              <button onClick={createStatus} className="w-full py-3 bg-[#00a884] hover:bg-[#00c79a] text-white rounded-xl font-bold text-sm">Post Status</button>
            </div>
          </div>
        </div>
      )}

      {/* Status Viewer */}
      {viewingStatusUser && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col" onClick={()=>setViewingStatusUser(null)}>
          {(()=>{
            const { user:su, items, index } = viewingStatusUser;
            const s = items[index];
            const isMine = (su._id||su)===user._id;
            const viewers = s?.viewers||[];
            return (
              <>
                <div className="flex gap-1 px-3 pt-3 pb-2 flex-shrink-0 z-10">
                  {items.map((_,i)=>(
                    <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/30">
                      <div className={`h-full rounded-full ${i<index?'bg-white w-full':i===index?'bg-white w-1/2':'w-0'}`}/>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0 z-10" onClick={e=>e.stopPropagation()}>
                  <Avatar user={su} size="sm"/>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{getContactName(su._id, su.username)}</p>
                    <p className="text-white/70 text-xs">{fmtTime(s?.createdAt)}</p>
                  </div>
                  {isMine && <button onClick={()=>{statusAPI.delete(s._id).then(()=>{const ni=items.filter((_,i)=>i!==index);if(!ni.length)setViewingStatusUser(null);else setViewingStatusUser(p=>({...p,items:ni,index:Math.min(index,ni.length-1)}));setStatuses(p=>p.filter(st=>st._id!==s._id));toast.success('Deleted.');}).catch(()=>toast.error('Failed.'));}} className="text-white/70 hover:text-white p-1">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  </button>}
                  <button onClick={(e)=>{e.stopPropagation();setViewingStatusUser(null);}} className="text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20">×</button>
                </div>
                <div className="flex-1 flex items-center justify-center relative" onClick={e=>e.stopPropagation()}>
                  {s?.type==='image'
                    ? <img src={s.content} alt="status" className="max-w-full max-h-full object-contain"/>
                    : <div className="w-full h-full flex items-center justify-center p-8" style={{backgroundColor:s?.backgroundColor||'#005c4b'}}>
                        <p className="text-white text-2xl font-semibold text-center break-words leading-relaxed">{s?.content}</p>
                      </div>}
                  <button onClick={()=>navStatus(-1)} className="absolute left-0 top-0 w-1/3 h-full opacity-0"/>
                  <button onClick={()=>navStatus(1)} className="absolute right-0 top-0 w-1/3 h-full opacity-0"/>
                </div>
                {isMine && viewers.length>0 && (
                  <div className="px-4 py-3 bg-black/50 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                    <p className="text-white/60 text-xs mb-2">👁️ {viewers.length} view{viewers.length!==1?'s':''}</p>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                      {viewers.map(v=>{
                        const vu = typeof v==='object'?v:{_id:v,username:'User'};
                        const cn = contacts.find(c=>(c.user?._id||c.user)===vu._id);
                        return (
                          <div key={vu._id||v} className="flex flex-col items-center gap-1 flex-shrink-0">
                            <Avatar user={vu} size="sm"/>
                            <span className="text-white/80 text-xs">{cn?.nickname||vu.username}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Group Members Modal */}
      {viewingGroupMembers && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setViewingGroupMembers(null)}>
          <div className="bg-[#202c33] rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-4 border-b border-[#2a3942]">
              <div className="w-12 h-12 bg-[#2a3942] rounded-full flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                {viewingGroupMembers.groupPicture?<img src={viewingGroupMembers.groupPicture} className="w-12 h-12 rounded-full object-cover"/>:'👥'}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[#e9edef] font-semibold truncate">{viewingGroupMembers.name}</h2>
                {viewingGroupMembers.description&&<p className="text-[#8696a0] text-xs truncate">{viewingGroupMembers.description}</p>}
                <p className="text-[#00a884] text-xs font-medium">{viewingGroupMembers.members?.length||0} members</p>
              </div>
              <button onClick={()=>setViewingGroupMembers(null)} className="text-[#8696a0] hover:text-white text-2xl flex-shrink-0">×</button>
            </div>
            <div className="overflow-y-auto flex-1 py-2 scrollbar-hide">
              {(viewingGroupMembers.members||[]).map(m=>{
                const mu = m.user||m;
                const isGroupAdmin = viewingGroupMembers.admins?.some(a=>(a._id||a)?.toString()===(mu?._id||mu)?.toString()) || (viewingGroupMembers.admin?._id||viewingGroupMembers.admin)?.toString()===(mu?._id||mu)?.toString();
                const online = isOnline(mu?._id);
                return (
                  <div key={mu?._id||m} className="flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] transition-colors">
                    <div className="relative flex-shrink-0">
                      <Avatar user={mu} size="md"/>
                      {online&&<span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#202c33]"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[#e9edef] text-sm font-medium truncate">{getContactName(mu?._id, mu?.username)}</p>
                        {isGroupAdmin&&<span className="text-xs bg-[#00a884]/20 text-[#00a884] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Admin</span>}
                      </div>
                      <p className="text-[#8696a0] text-xs truncate">
                        {(mu?._id||mu)?.toString()===user?._id?.toString()?'You':online?'Online':mu?.lastSeen?`last seen ${fmtLastSeen(mu.lastSeen)}`:`@${mu?.username||''}`}
                      </p>
                    </div>
                    {(mu?._id||mu)?.toString()!==user?._id?.toString() && (
                      <button onClick={()=>{setViewingGroupMembers(null);startDM(mu);}} className="text-[#8696a0] hover:text-[#00a884] transition-colors p-2" title="Message">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-[#2a3942]">
              <button onClick={()=>{openGroup(viewingGroupMembers);setViewingGroupMembers(null);}}
                className="w-full py-2.5 bg-[#00a884] hover:bg-[#00c79a] text-white rounded-xl font-bold text-sm">Open Group Chat</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setShowCreateGroup(false)}>
          <div className="bg-[#111b21] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#202c33] px-4 py-4 flex items-center justify-between">
              <h2 className="text-[#e9edef] font-semibold">Create Group</h2>
              <button onClick={()=>setShowCreateGroup(false)} className="text-[#8696a0] hover:text-white text-2xl">×</button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-hide">
              <input value={groupForm.name} onChange={e=>setGroupForm(p=>({...p,name:e.target.value}))} placeholder="Group name *" maxLength={50} autoFocus
                className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm"/>
              <input value={groupForm.description} onChange={e=>setGroupForm(p=>({...p,description:e.target.value}))} placeholder="Description (optional)"
                className="w-full px-4 py-3 bg-[#202c33] rounded-xl text-[#e9edef] placeholder-[#8696a0] outline-none focus:ring-2 ring-[#00a884] text-sm"/>
              <p className="text-[#8696a0] text-xs uppercase tracking-wider">Add Members</p>
              <div className="flex items-center bg-[#202c33] rounded-full px-3 py-2 gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#8696a0]"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.208 5.208 5.185 5.185 0 003.386-1.255l.221.22v.635l4.004 3.999 1.195-1.195-3.998-4.007z"/></svg>
                <input value={groupSearch} onChange={async e=>{setGroupSearch(e.target.value);if(e.target.value.trim()){try{const {data}=await userAPI.search(e.target.value);setGroupSearchResults((Array.isArray(data)?data:[]).filter(u=>u._id!==user._id));}catch{}}else setGroupSearchResults([]);}} placeholder="Search users..."
                  className="bg-transparent text-[#e9edef] placeholder-[#8696a0] text-sm flex-1 outline-none"/>
              </div>
              {groupSearchResults.map(u=>(
                <button key={u._id} onClick={()=>setSelectedGroupMembers(p=>p.includes(u._id)?p.filter(id=>id!==u._id):[...p,u._id])}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl mb-1 transition-colors ${selectedGroupMembers.includes(u._id)?'bg-[#005c4b]':'hover:bg-[#2a3942]'}`}>
                  <Avatar user={u} size="sm"/>
                  <span className="text-[#e9edef] text-sm flex-1 text-left">{getContactName(u._id, u.username)}</span>
                  {selectedGroupMembers.includes(u._id)&&<span className="text-[#00a884] font-bold">✓</span>}
                </button>
              ))}
              {selectedGroupMembers.length>0&&<p className="text-[#00a884] text-xs">{selectedGroupMembers.length} member(s) selected</p>}
              <button onClick={createGroup} disabled={!groupForm.name.trim()||selectedGroupMembers.length<1}
                className="w-full py-3 bg-[#00a884] hover:bg-[#00c79a] disabled:opacity-50 text-white rounded-xl font-bold text-sm">Create Group</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setShowAddMember(false)}>
          <div className="bg-[#111b21] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#202c33] px-4 py-4 flex items-center justify-between">
              <h2 className="text-[#e9edef] font-semibold">Add Member</h2>
              <button onClick={()=>setShowAddMember(false)} className="text-[#8696a0] hover:text-white text-2xl">×</button>
            </div>
            <div className="p-4">
              <div className="flex items-center bg-[#202c33] rounded-full px-3 py-2 gap-2 mb-3">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#8696a0]"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.208 5.208 5.185 5.185 0 003.386-1.255l.221.22v.635l4.004 3.999 1.195-1.195-3.998-4.007z"/></svg>
                <input value={addMemberSearch} autoFocus onChange={async e=>{setAddMemberSearch(e.target.value);if(e.target.value.trim()){try{const {data}=await userAPI.search(e.target.value);setAddMemberResults((Array.isArray(data)?data:[]).filter(u=>!activeChat?.data?.members?.some(m=>(m._id||m)===u._id)));}catch{}}else setAddMemberResults([]);}} placeholder="Search to add..."
                  className="bg-transparent text-[#e9edef] placeholder-[#8696a0] text-sm flex-1 outline-none"/>
              </div>
              {addMemberResults.map(u=>(
                <button key={u._id} onClick={async()=>{try{const {data}=await groupAPI.addMember(activeChat.data._id,u._id);setGroups(p=>p.map(g=>g._id===data._id?data:g));setActiveChat(p=>({...p,data}));toast.success(`${u.username} added!`);setShowAddMember(false);}catch{toast.error('Failed.');}}}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#2a3942] transition-colors">
                  <Avatar user={u} size="sm"/>
                  <span className="text-[#e9edef] text-sm flex-1 text-left">{getContactName(u._id, u.username)}</span>
                  <span className="text-[#00a884] text-sm font-medium">+ Add</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
