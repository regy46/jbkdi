import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  getDoc,
  updateDoc,
  addDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Card } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { ScrollArea } from "@components/ui/scroll-area"
import { MessageSquare, Send, ArrowLeft, MoreVertical, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error(`Kesalahan sistem (${operationType}): ${errInfo.error}`);
  throw new Error(JSON.stringify(errInfo));
}

const userCache: { [key: string]: any } = {};

export default function ChatList({ onViewProfile, userData, initialChatId, onChatClosed }: { onViewProfile: (userId: string) => void, userData?: any, initialChatId?: string | null, onChatClosed?: () => void }) {
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialChatId || null);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    if (initialChatId !== undefined) {
      setSelectedChatId(initialChatId);
    }
  }, [initialChatId]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const chatData = await Promise.all(snapshot.docs.map(async (chatDoc) => {
          const data = chatDoc.data() as any;
          const otherUserId = data.participants?.find((p: string) => p !== user.uid);
          
          let otherUserData = otherUserId ? userCache[otherUserId] : null;
          if (!otherUserData && otherUserId) {
            try {
              const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
              otherUserData = otherUserDoc.data();
              if (otherUserData) {
                userCache[otherUserId] = otherUserData;
              }
            } catch (err) {
              console.error('Error fetching other user:', err);
            }
          }

          return {
            id: chatDoc.id,
            ...data,
            otherUser: {
              uid: otherUserId || 'unknown',
              displayName: otherUserData?.displayName || 'User',
              photoURL: otherUserData?.photoURL || '',
              isVerified: otherUserData?.isVerified || false,
              role: otherUserData?.role || 'user',
              status: otherUserData?.status || 'active',
              lastActive: otherUserData?.lastActive
            }
          };
        }));

        // Sort client-side to avoid composite index requirement
        chatData.sort((a: any, b: any) => {
          const timeA = a.lastMessageAt?.seconds || Infinity;
          const timeB = b.lastMessageAt?.seconds || Infinity;
          return timeB - timeA;
        });

        setChats(chatData);
      } catch (err) {
        console.error('Error processing chats:', err);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('Error fetching chats:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (selectedChatId) {
    const selectedChat = chats.find(c => c.id === selectedChatId);
    if (selectedChat) {
      return <ChatRoom chat={selectedChat} onBack={() => {
        setSelectedChatId(null);
        onChatClosed?.();
      }} onViewProfile={onViewProfile} currentUserData={userData} />;
    } else {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
          <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium">Membuka percakapan...</p>
        </div>
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-bold text-zinc-900">Pesan</h2>
        <div className="bg-zinc-100 p-2 rounded-full">
          <MessageSquare className="w-5 h-5 text-zinc-500" />
        </div>
      </div>

      <div className="grid gap-2">
        {loading ? (
          <div className="text-center py-10 text-zinc-400">Memuat pesan...</div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-zinc-300" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-zinc-900">Belum ada pesan</p>
              <p className="text-sm text-zinc-500">Mulai percakapan dengan penjual di beranda.</p>
            </div>
          </div>
        ) : (
          chats.map((chat) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedChatId(chat.id)}
              className="group cursor-pointer"
            >
              <Card className="p-4 border-zinc-100 hover:bg-zinc-50 transition-colors shadow-none border flex items-center gap-4">
                <Avatar className="w-12 h-12 border border-zinc-100">
                  <AvatarImage src={chat.otherUser.photoURL} />
                  <AvatarFallback>{chat.otherUser.displayName[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1">
                      <p className="font-bold text-zinc-900 truncate">{chat.otherUser.displayName}</p>
                      {(chat.otherUser.isVerified || chat.otherUser.role === 'admin') && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-50 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 uppercase font-medium">
                      {chat.lastMessageAt?.seconds ? formatDistanceToNow(new Date(chat.lastMessageAt.seconds * 1000), { locale: id }) : ''}
                    </p>
                  </div>
                  <p className="text-sm text-zinc-500 truncate leading-tight">
                    {chat.lastMessage || 'Mulai percakapan...'}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function ChatRoom({ chat, onBack, onViewProfile, currentUserData }: { chat: any, onBack: () => void, onViewProfile?: (userId: string) => void, currentUserData?: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [otherUserStatus, setOtherUserStatus] = useState<any>(chat.otherUser);
  const user = auth.currentUser;
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUserData?.role === 'admin';
  const isOtherBanned = otherUserStatus.status === 'banned' || otherUserStatus.status === 'deleted';

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setMessages(prev => {
        // Keep optimistic messages that haven't been synced yet
        const optimistic = prev.filter(m => m.isOptimistic && !newMessages.find(nm => nm.text === m.text && nm.senderId === m.senderId));
        return [...newMessages, ...optimistic].sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds || Infinity;
          const timeB = b.createdAt?.seconds || Infinity;
          return timeA - timeB;
        });
      });
    }, (error) => {
      console.error('Error fetching messages:', error);
    });

    return () => unsubscribe();
  }, [chat.id]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', chat.otherUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setOtherUserStatus(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, [chat.otherUser.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const isOnline = () => {
    if (!otherUserStatus.lastActive) return false;
    const lastActive = otherUserStatus.lastActive.toDate ? otherUserStatus.lastActive.toDate() : new Date(otherUserStatus.lastActive);
    const now = new Date();
    const diff = (now.getTime() - lastActive.getTime()) / 1000 / 60; // diff in minutes
    return diff < 3; // consider online if active in last 3 minutes
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || isSending) return;

    const messageText = newMessage;
    setIsSending(true);
    setNewMessage('');

    // Optimistic update
    const tempId = Date.now().toString();
    const optimisticMessage = {
      id: tempId,
      senderId: user.uid,
      text: messageText,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }, // Temporary timestamp
      isOptimistic: true
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      await addDoc(collection(db, 'chats', chat.id, 'messages'), {
        senderId: user.uid,
        text: messageText,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chat.id), {
        lastMessage: messageText,
        lastMessageAt: serverTimestamp(),
        lastSenderId: user.uid,
        lastSenderName: currentUserData?.displayName || 'User'
      });
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageText); // Restore message on failure
      handleFirestoreError(error, OperationType.WRITE, `chats/${chat.id}/messages`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="fixed inset-0 z-50 bg-white flex flex-col h-[100dvh] w-full"
    >
      <header className="h-16 border-b flex items-center px-4 gap-4 bg-white/90 backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div 
          className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            onBack();
            onViewProfile?.(chat.otherUser.uid);
          }}
        >
          <Avatar className="w-9 h-9">
            <AvatarImage src={otherUserStatus.photoURL} />
            <AvatarFallback>{otherUserStatus.displayName?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1">
              <p className="text-sm font-bold text-zinc-900">{otherUserStatus.displayName}</p>
              {(otherUserStatus.isVerified || otherUserStatus.role === 'admin') && (
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-50 shrink-0" />
              )}
            </div>
            {isOnline() ? (
              <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Online</p>
            ) : (
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                {otherUserStatus.lastActive 
                  ? `Aktif ${formatDistanceToNow(otherUserStatus.lastActive.toDate ? otherUserStatus.lastActive.toDate() : new Date(otherUserStatus.lastActive), { locale: id })} yang lalu`
                  : 'Offline'}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-5 h-5 text-zinc-400" />
        </Button>
      </header>

      <ScrollArea ref={scrollRef} className="flex-1 p-4 bg-zinc-50/50">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm border ${
                msg.senderId === user?.uid 
                  ? 'bg-zinc-900 text-white border-zinc-800 rounded-tr-none' 
                  : 'bg-white text-zinc-900 border-zinc-100 rounded-tl-none'
              }`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <div className="flex items-center justify-end gap-1.5 mt-1.5">
                  <p className={`text-[9px] font-medium uppercase tracking-wider ${
                    msg.senderId === user?.uid ? 'text-zinc-400' : 'text-zinc-400'
                  }`}>
                    {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Mengirim...'}
                  </p>
                  {msg.isOptimistic && (
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
        {isOtherBanned && !isAdmin ? (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl text-center font-medium flex items-center justify-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Akun ini sudah di-ban atau dihapus karena melanggar aturan
          </div>
        ) : (
          <div className="flex gap-2 max-w-2xl mx-auto w-full">
            <Input 
              placeholder={isOtherBanned ? "Ketik pesan (Admin Mode)..." : "Ketik pesan..."}
              className="rounded-full bg-zinc-100 border-none px-6 h-11"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button size="icon" className="rounded-full h-11 w-11 shrink-0 shadow-lg" onClick={handleSendMessage}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
