import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#111b21] flex items-center justify-center" style={{minHeight:'100dvh'}}><div className="w-12 h-12 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin"/></div>;
  return user ? children : <Navigate to="/login" replace/>;
};

const Public = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#111b21] flex items-center justify-center" style={{minHeight:'100dvh'}}><div className="w-12 h-12 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin"/></div>;
  return !user ? children : <Navigate to="/" replace/>;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          <Toaster position="top-center" toastOptions={{
            duration: 3500,
            style: { background:'#202c33', color:'#e9edef', border:'1px solid #2a3942', borderRadius:'12px', fontSize:'14px' },
            success: { iconTheme: { primary:'#00a884', secondary:'#fff' } },
            error: { iconTheme: { primary:'#ef4444', secondary:'#fff' } }
          }}/>
          <Routes>
            <Route path="/login" element={<Public><Login/></Public>}/>
            <Route path="/register" element={<Public><Register/></Public>}/>
            <Route path="/" element={<Protected><Home/></Protected>}/>
            <Route path="*" element={<Navigate to="/" replace/>}/>
          </Routes>
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
