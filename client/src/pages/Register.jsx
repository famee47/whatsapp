import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ALLOWED = ['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','protonmail.com','live.com','msn.com','ymail.com','me.com','mac.com'];

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ email:'', password:'', username:'' });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const { email, password, username } = form;
    if (!email||!password||!username) return toast.error('All fields are required.');
    const domain = email.split('@')[1]?.toLowerCase();
    if (!ALLOWED.includes(domain)) return toast.error('Use a real email: Gmail, Yahoo, Outlook, etc.');
    if (username.length < 3) return toast.error('Username must be at least 3 characters.');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return toast.error('Username: letters, numbers, underscores only.');
    if (password.length < 6) return toast.error('Password must be at least 6 characters.');
    setLoading(true);
    try { await register(email.trim(), password, username.trim().toLowerCase()); toast.success('Welcome to NumberFree! 🎉'); navigate('/'); }
    catch (err) { toast.error(err.response?.data?.message || 'Registration failed. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111b21] px-4" style={{minHeight:'100dvh'}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#00a884] rounded-full flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-[#00a884]/30">
            <svg viewBox="0 0 24 24" className="w-12 h-12 fill-white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.121 1.535 5.856L.057 23.882a.75.75 0 00.961.961l6.026-1.478A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.92 0-3.722-.511-5.27-1.402l-.38-.22-3.927.963.963-3.928-.22-.379A9.951 9.951 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
          </div>
          <h1 className="text-[#e9edef] text-3xl font-bold tracking-tight">NumberFree</h1>
          <p className="text-[#8696a0] text-sm mt-2">Create your free account</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <input type="text" value={form.username}
              onChange={e=>setForm(p=>({...p,username:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,20)}))}
              placeholder="Username (e.g. john_doe)" autoComplete="username"
              className="w-full px-4 py-4 rounded-xl bg-[#202c33] text-[#e9edef] placeholder-[#8696a0] border-2 border-transparent focus:border-[#00a884] outline-none transition-all text-sm" required />
            <p className="text-[#8696a0] text-xs mt-1 ml-1">Letters, numbers, underscores. 3-20 characters.</p>
          </div>
          <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}
            placeholder="Email (Gmail, Yahoo, Outlook...)" autoComplete="email"
            className="w-full px-4 py-4 rounded-xl bg-[#202c33] text-[#e9edef] placeholder-[#8696a0] border-2 border-transparent focus:border-[#00a884] outline-none transition-all text-sm" required />
          <div className="relative">
            <input type={showPwd?'text':'password'} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))}
              placeholder="Password (min. 6 characters)" autoComplete="new-password"
              className="w-full px-4 py-4 rounded-xl bg-[#202c33] text-[#e9edef] placeholder-[#8696a0] border-2 border-transparent focus:border-[#00a884] outline-none transition-all text-sm pr-12" required />
            <button type="button" onClick={()=>setShowPwd(p=>!p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-[#00a884] transition-colors text-lg">
              {showPwd?'🙈':'👁️'}
            </button>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-4 bg-[#00a884] hover:bg-[#00c79a] active:scale-[0.98] disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg mt-2">
            {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Creating account...</> : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-[#8696a0] text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#00a884] hover:text-[#00c79a] font-semibold transition-colors">Log in</Link>
        </p>
      </div>
    </div>
  );
}
