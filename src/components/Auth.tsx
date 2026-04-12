import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@components/ui/card"
import { Label } from "@components/ui/label"
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, ArrowRight, CheckCircle2, Globe } from 'lucide-react';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  // Bootstrap Admin Account
  React.useEffect(() => {
    const bootstrapAdmin = async () => {
      const adminEmail = usernameToEmail('admin');
      try {
        // Try to create admin if not exists
        const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, 'admin123');
        const user = userCredential.user;
        await updateProfile(user, { displayName: 'Administrator' });
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          username: 'admin',
          displayName: 'Administrator',
          bio: 'Akun resmi admin JB KDI',
          photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
          createdAt: new Date().toISOString(),
          role: 'admin',
          isVerified: true
        });
        console.log('Admin account bootstrapped');
      } catch (e: any) {
        // If already exists, ensure it has the verified flag and admin role
        if (e.code === 'auth/email-already-in-use') {
          console.log('Admin account already exists');
        } else {
          console.error('Admin bootstrap error:', e);
        }
      }
    };
    bootstrapAdmin();
  }, []);

  // Helper to format username to a fake email for Firebase Auth
  const usernameToEmail = (user: string) => `${user.toLowerCase().trim()}@jbkdi.app`;

  const handleRegister = async () => {
    if (!username || !displayName || password.length < 6) {
      toast.error('Semua field harus diisi dan password minimal 6 karakter');
      return;
    }

    if (username.toLowerCase().includes('admin')) {
      toast.error('Username tidak boleh mengandung kata "admin"');
      return;
    }

    if (password.toLowerCase().includes('admin')) {
      toast.error('Password tidak boleh mengandung kata "admin"');
      return;
    }

    setLoading(true);
    try {
      // Check if username already exists in Firestore
      const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        toast.error('Username sudah digunakan. Silakan pilih yang lain.');
        setLoading(false);
        return;
      }

      const email = usernameToEmail(username);
      
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Update Auth Profile
      await updateProfile(user, { displayName });

      // 3. Create Firestore Doc
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: username.toLowerCase(),
        displayName,
        bio: '',
        kecamatan: '',
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        createdAt: new Date().toISOString(),
      });

      toast.success('Pendaftaran berhasil! Selamat datang.');
    } catch (error: any) {
      toast.error('Gagal mendaftar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username || password.length < 6) {
      toast.error('Username dan password harus diisi');
      return;
    }

    setLoading(true);
    try {
      const email = username.toLowerCase() === 'admin' ? usernameToEmail('admin') : usernameToEmail(username);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if user is banned
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists() && userDoc.data().status === 'banned') {
        await auth.signOut();
        toast.error('Akun Anda telah di-ban karena melanggar aturan komunitas.');
        setLoading(false);
        return;
      }
      
      toast.success('Selamat datang kembali!');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Password salah. Silakan coba lagi.');
      } else if (error.code === 'auth/user-not-found') {
        toast.error('Username tidak ditemukan');
      } else {
        toast.error('Login gagal: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 text-white mb-4 shadow-xl shadow-zinc-200">
            <Globe className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">JB KDI</h1>
          <p className="text-zinc-500 font-medium text-sm uppercase tracking-widest">Portal Jual Beli Lokal</p>
        </div>

        <Card className="border-zinc-200 shadow-2xl shadow-zinc-200/50 overflow-hidden">
          <CardHeader className="space-y-1 bg-zinc-50/50 border-b border-zinc-100 pb-6">
            <CardTitle className="text-xl font-bold">
              {mode === 'login' ? 'Masuk ke Akun' : 'Daftar Akun Baru'}
            </CardTitle>
            <CardDescription>
              {mode === 'login' 
                ? 'Masukkan username dan password Anda' 
                : 'Lengkapi data di bawah untuk mulai berjualan'}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                <Input
                  id="username"
                  placeholder=""
                  className="pl-10 h-12 rounded-xl border-zinc-200"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="display-name">Nama Lengkap</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input
                    id="display-name"
                    placeholder=""
                    className="pl-10 h-12 rounded-xl border-zinc-200"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder=""
                  className="pl-10 h-12 rounded-xl border-zinc-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button 
              className="w-full h-12 rounded-xl font-bold text-base bg-zinc-900 hover:bg-zinc-800 transition-all mt-2" 
              onClick={mode === 'login' ? handleLogin : handleRegister} 
              disabled={loading}
            >
              {loading ? 'Memproses...' : (mode === 'login' ? 'Masuk' : 'Daftar Sekarang')}
              {mode === 'login' ? <ArrowRight className="ml-2 h-5 w-5" /> : <CheckCircle2 className="ml-2 h-5 w-5" />}
            </Button>
          </CardContent>
          
          <CardFooter className="bg-zinc-50/30 border-t border-zinc-100 py-4 flex flex-col gap-2">
            <button 
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium"
            >
              {mode === 'login' ? 'Belum punya akun? Daftar di sini' : 'Sudah punya akun? Masuk di sini'}
            </button>
            {mode === 'login' && (
              <button 
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                }}
                className="text-[10px] text-zinc-400 hover:text-zinc-600 font-bold uppercase tracking-widest mt-1"
              >
                Login Admin (admin / admin123)
              </button>
            )}
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-2">
              JB KDI &copy; 2026
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
