/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import Auth from './components/Auth';
import Marketplace from './components/Marketplace';
import ChatList from './components/ChatList';
import Profile from './components/Profile';
import AdminDashboard from './components/AdminDashboard';
import { Button } from "@components/ui/button"
import { ShoppingBag, MessageSquare, User as UserIcon, LogOut, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'chats' | 'profile' | 'admin'>('home');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showCreateListing, setShowCreateListing] = useState(false);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // If user is banned or deleted, sign them out immediately
            if (data.status === 'banned' || data.status === 'deleted') {
              auth.signOut();
              toast.error(data.status === 'banned' ? 'Akun Anda telah di-ban karena melanggar aturan.' : 'Akun Anda telah dihapus oleh admin.');
              return;
            }

            // Auto-promote egimmm12 and admin to admin role
            const isAdminAccount = firebaseUser.email === 'egimmm12@gmail.com' || data.username === 'egimmm12' || data.username === 'admin';
            if (isAdminAccount && (data.role !== 'admin' || !data.isVerified)) {
              updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin', isVerified: true }).catch(console.error);
              data.role = 'admin';
              data.isVerified = true;
            }
            setUserData(data);
          } else {
            // Check if we should create a new user (only if not recently deleted/banned)
            // To prevent recreation of deleted accounts, we could use a flag or just let it be.
            // However, the user's issue is likely that "banned" status is being overwritten or ignored.
            
            const defaultUserData = {
              uid: firebaseUser.uid,
              username: firebaseUser.email?.split('@')[0] || 'user',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              bio: '',
              kecamatan: '',
              photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
              createdAt: new Date().toISOString(),
              status: 'active',
              role: 'user'
            };
            setUserData(defaultUserData);
            setDoc(doc(db, 'users', firebaseUser.uid), defaultUserData).catch(console.error);
          }
          setLoading(false);
        }, (error) => {
          console.error('Error in user snapshot listener:', error);
          setLoading(false);
        });
      } else {
        setUserData(null);
        setLoading(false);
        if (unsubscribeDoc) unsubscribeDoc();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastActive: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    // Update immediately on mount
    updatePresence();

    // Then update every minute
    const interval = setInterval(updatePresence, 60000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Track the initial load to avoid notifying for old messages
    let isInitialLoad = true;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const chatData = change.doc.data();
          // Only notify if the last message was sent by someone else
          // and it's a new message (lastMessageAt is recent)
          if (chatData.lastSenderId && chatData.lastSenderId !== user.uid) {
            toast.info(`Pesan baru dari ${chatData.lastSenderName}`, {
              description: chatData.lastMessage,
              action: {
                label: 'Lihat',
                onClick: () => setActiveTab('chats')
              }
            });
          }
        }
      });
    }, (error) => {
      console.error('Error in chats notification listener:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleViewProfile = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('profile');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-zinc-200 border-t-zinc-800 rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Auth />
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">JB KDI</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => auth.signOut().then(() => toast.success('Berhasil keluar'))}
            >
              <LogOut className="w-5 h-5 text-zinc-500" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Marketplace 
                onViewProfile={handleViewProfile} 
                onNavigateToChats={() => setActiveTab('chats')} 
                userData={userData}
              />
            </motion.div>
          )}
          {activeTab === 'chats' && (
            <motion.div
              key="chats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ChatList onViewProfile={handleViewProfile} userData={userData} />
            </motion.div>
          )}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Profile 
                userData={userData} 
                viewUserId={selectedUserId} 
                onBack={() => {
                  setSelectedUserId(null);
                  setActiveTab('home');
                }} 
              />
            </motion.div>
          )}
          {activeTab === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminDashboard onViewProfile={handleViewProfile} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 px-6 py-3">
        <div className="container mx-auto max-w-2xl flex items-center justify-between">
          <NavButton 
            active={activeTab === 'home'} 
            onClick={() => setActiveTab('home')} 
            icon={<ShoppingBag />} 
            label="Beranda" 
          />
          <NavButton 
            active={activeTab === 'chats'} 
            onClick={() => setActiveTab('chats')} 
            icon={<MessageSquare />} 
            label="Chat" 
          />
          <NavButton 
            active={activeTab === 'profile' && !selectedUserId} 
            onClick={() => {
              setSelectedUserId(null);
              setActiveTab('profile');
            }} 
            icon={<UserIcon />} 
            label="Profil" 
          />
          {userData?.role === 'admin' && (
            <NavButton 
              active={activeTab === 'admin'} 
              onClick={() => setActiveTab('admin')} 
              icon={<ShieldAlert />} 
              label="Admin" 
            />
          )}
        </div>
      </nav>

      <Toaster position="top-center" />
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
    >
      {active ? (
        <motion.div layoutId="nav-active" className="absolute -top-1 w-1 h-1 bg-zinc-900 rounded-full" />
      ) : null}
      <div className="w-6 h-6">
        {icon}
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </button>
  );
}
