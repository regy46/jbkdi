import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where,
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  deleteDoc,
  arrayUnion, 
  arrayRemove,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { Button } from "@components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@components/ui/card"
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Badge } from "@components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { Label } from "@components/ui/label"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@components/ui/dialog"
import { Heart, MessageCircle, Send, Plus, Search, Image as ImageIcon, X, Trash2, ShieldAlert, CheckCircle2, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

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

export default function Marketplace({ onViewProfile, onNavigateToChats }: { onViewProfile?: (userId: string) => void, onNavigateToChats?: () => void }) {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sale' | 'request'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newListing, setNewListing] = useState({
    title: '',
    description: '',
    price: '',
    type: 'sale' as 'sale' | 'request',
    images: [] as string[]
  });

  useEffect(() => {
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`File ${file.name} terlalu besar (maks 2MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewListing(prev => ({
          ...prev,
          images: [...prev.images, reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCreateListing = async () => {
    if (!newListing.title || !newListing.description) {
      toast.error('Judul dan deskripsi harus diisi');
      return;
    }

    if (isSubmitting) return; // Prevent spam

    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      await addDoc(collection(db, 'listings'), {
        authorId: user.uid,
        authorName: userData?.displayName || 'Anonim',
        authorPhoto: userData?.photoURL || '',
        title: newListing.title,
        description: newListing.description,
        price: parseFloat(newListing.price) || 0,
        type: newListing.type,
        images: newListing.images,
        likes: [],
        commentCount: 0,
        createdAt: serverTimestamp(),
        status: 'active'
      });

      toast.success('Postingan berhasil dibuat!');
      setIsCreateOpen(false);
      setNewListing({ title: '', description: '', price: '', type: 'sale', images: [] });
    } catch (error: any) {
      toast.error('Gagal membuat postingan: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLike = async (listingId: string, likes: string[]) => {
    const user = auth.currentUser;
    if (!user) return;

    const isLiked = likes.includes(user.uid);
    const listingRef = doc(db, 'listings', listingId);

    try {
      await updateDoc(listingRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      toast.error('Gagal menyukai postingan');
    }
  };

  const filteredListings = listings.filter(l => {
    if (l.status === 'banned') return false;
    const matchesFilter = filter === 'all' || l.type === filter;
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         l.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Cari barang atau kebutuhan..." 
            className="pl-10 bg-white border-zinc-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-fit">
            <TabsList className="bg-zinc-100">
              <TabsTrigger value="all">Semua</TabsTrigger>
              <TabsTrigger value="sale">Dijual</TabsTrigger>
              <TabsTrigger value="request">Dicari</TabsTrigger>
            </TabsList>
          </Tabs>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger render={<Button className="rounded-full shadow-lg shadow-zinc-200" />}>
              <Plus className="w-4 h-4 mr-2" />
              Posting
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Buat Postingan Baru</DialogTitle>
                <DialogDescription>
                  Bagikan barang yang ingin Anda jual atau cari.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex gap-2 p-1 bg-zinc-100 rounded-lg">
                  <button
                    onClick={() => setNewListing({ ...newListing, type: 'sale' })}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${newListing.type === 'sale' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                  >
                    Jual Barang
                  </button>
                  <button
                    onClick={() => setNewListing({ ...newListing, type: 'request' })}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${newListing.type === 'request' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                  >
                    Cari Barang
                  </button>
                </div>
                <div className="space-y-2">
                  <Input 
                    placeholder="Judul postingan" 
                    value={newListing.title}
                    onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Textarea 
                    placeholder="Deskripsi barang..." 
                    value={newListing.description}
                    onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                  />
                </div>
                {newListing.type === 'sale' && (
                  <div className="space-y-2">
                    <Input 
                      type="number" 
                      placeholder="Harga (Rp)" 
                      value={newListing.price}
                      onChange={(e) => setNewListing({ ...newListing, price: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Foto Barang</Label>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <Button 
                    variant="outline" 
                    className="w-full border-dashed border-2 h-20 flex flex-col gap-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-6 h-6 text-zinc-400" />
                    <span className="text-xs text-zinc-500">Klik untuk upload foto/album</span>
                  </Button>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newListing.images.map((img, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border">
                        {img.startsWith('data:application/pdf') ? (
                          <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold">PDF</div>
                        ) : (
                          <img src={img} className="w-full h-full object-cover" />
                        )}
                        <button 
                          onClick={() => setNewListing({ ...newListing, images: newListing.images.filter((_, idx) => idx !== i) })}
                          className="absolute top-0 right-0 bg-black/50 p-0.5"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateListing} disabled={isSubmitting}>
                  {isSubmitting ? 'Memproses...' : 'Posting Sekarang'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6">
        {loading ? (
          <div className="text-center py-10 text-zinc-400">Memuat postingan...</div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-10 text-zinc-400">Tidak ada postingan ditemukan.</div>
        ) : (
          filteredListings.map((listing) => (
            <ListingCard 
              key={listing.id} 
              listing={listing} 
              onLike={() => toggleLike(listing.id, listing.likes)} 
              onViewProfile={onViewProfile}
              onNavigateToChats={onNavigateToChats}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function ListingCard({ listing, onLike, hideActions = false, onViewProfile, onNavigateToChats }: any) {
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const user = auth.currentUser;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const [authorData, setAuthorData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => setUserData(snap.data()));
    }
    if (listing.authorId) {
      getDoc(doc(db, 'users', listing.authorId)).then(snap => setAuthorData(snap.data()));
    }
  }, [user, listing.authorId]);

  useEffect(() => {
    if (isCommentOpen) {
      const q = query(collection(db, 'listings', listing.id, 'comments'), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [isCommentOpen, listing.id]);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'listings', listing.id));
      toast.success('Postingan dihapus');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Gagal menghapus');
    }
  };

  const handleBan = async () => {
    try {
      await updateDoc(doc(db, 'listings', listing.id), { status: 'banned' });
      toast.success('Postingan di-ban');
      setIsBanDialogOpen(false);
    } catch (error) {
      toast.error('Gagal memproses');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      await addDoc(collection(db, 'listings', listing.id, 'comments'), {
        authorId: user.uid,
        authorName: userData?.displayName || 'Anonim',
        authorPhoto: userData?.photoURL || '',
        text: newComment,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'listings', listing.id), {
        commentCount: (listing.commentCount || 0) + 1
      });

      setNewComment('');
    } catch (error) {
      toast.error('Gagal menambah komentar');
    }
  };

  const startChat = async () => {
    if (!user) {
      toast.error('Silakan login untuk memulai chat');
      return;
    }
    if (user.uid === listing.authorId) {
      toast.error('Anda tidak bisa chat dengan diri sendiri');
      return;
    }
    
    try {
      const chatId = [user.uid, listing.authorId].sort().join('_');
      const chatRef = doc(db, 'chats', chatId);
      
      let chatSnap;
      try {
        chatSnap = await getDoc(chatRef);
      } catch (error) {
        // If getDoc fails, we try to create it anyway (rules will handle)
        console.warn('getDoc failed, proceeding with creation attempt');
      }

      if (!chatSnap?.exists()) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        await setDoc(chatRef, {
          id: chatId,
          participants: [user.uid, listing.authorId],
          lastMessage: 'Halo, saya tertarik dengan postingan Anda!',
          lastMessageAt: serverTimestamp(),
          lastSenderId: user.uid,
          lastSenderName: userData?.displayName || 'User'
        });

        // Also send the actual message document
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: user.uid,
          text: 'Halo, saya tertarik dengan postingan Anda!',
          createdAt: serverTimestamp()
        });
      }
      
      toast.success('Membuka percakapan...');
      onNavigateToChats?.();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${[user.uid, listing.authorId].sort().join('_')}`);
    }
  };

  const handleReport = async () => {
    if (!reportReason) {
      toast.error('Silakan pilih alasan laporan');
      return;
    }
    if (!user) return;

    setIsReporting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reporterName: userData?.displayName || 'Anonim',
        targetId: listing.id,
        targetType: 'listing',
        targetTitle: listing.title,
        authorId: listing.authorId,
        reason: reportReason,
        details: reportDetails,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast.success('Laporan berhasil dikirim');
      setIsReportDialogOpen(false);
      setReportReason('');
      setReportDetails('');
    } catch (error) {
      toast.error('Gagal mengirim laporan');
    } finally {
      setIsReporting(false);
    }
  };

  const isAdmin = userData?.role === 'admin';
  const isOwner = user?.uid === listing.authorId;

  return (
    <Card className="overflow-hidden border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onViewProfile?.(listing.authorId)}
        >
          <Avatar className="w-10 h-10 border border-zinc-100">
            <AvatarImage src={authorData?.photoURL || listing.authorPhoto} />
            <AvatarFallback>{(authorData?.displayName || listing.authorName)?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1">
              <p className="text-sm font-semibold text-zinc-900">{authorData?.displayName || listing.authorName}</p>
              {(authorData?.isVerified || authorData?.role === 'admin' || listing.authorId === 'admin_uid_placeholder') && (
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-50" />
              )}
            </div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
              {listing.createdAt?.seconds ? formatDistanceToNow(new Date(listing.createdAt.seconds * 1000), { addSuffix: true, locale: id }) : 'Baru saja'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOwner && !hideActions && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs font-bold gap-1.5 rounded-full border-zinc-200"
              onClick={(e) => {
                e.stopPropagation();
                startChat();
              }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Chat
            </Button>
          )}
          {isAdmin && (
            <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                  <ShieldAlert className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ban Postingan</DialogTitle>
                  <DialogDescription>Apakah Anda yakin ingin mem-ban postingan ini?</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBanDialogOpen(false)}>Batal</Button>
                  <Button variant="destructive" onClick={handleBan}>Ban</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {(isOwner || isAdmin) && (
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Hapus Postingan</DialogTitle>
                  <DialogDescription>Apakah Anda yakin ingin menghapus postingan ini? Tindakan ini tidak dapat dibatalkan.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
                  <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {!isOwner && (
            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-orange-500 hover:bg-orange-50">
                  <Flag className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Laporkan Postingan</DialogTitle>
                  <DialogDescription>Bantu kami menjaga komunitas tetap aman.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Alasan Laporan</Label>
                    <select 
                      className="w-full h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                    >
                      <option value="">Pilih alasan...</option>
                      <option value="penipuan">Penipuan / Scam</option>
                      <option value="ilegal">Barang Ilegal</option>
                      <option value="spam">Spam / Iklan Berulang</option>
                      <option value="tidak_sopan">Konten Tidak Sopan</option>
                      <option value="lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Detail Tambahan</Label>
                    <Textarea 
                      placeholder="Jelaskan lebih lanjut..."
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>Batal</Button>
                  <Button variant="destructive" onClick={handleReport} disabled={isReporting}>
                    {isReporting ? 'Mengirim...' : 'Kirim Laporan'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Badge variant={listing.type === 'sale' ? 'default' : 'secondary'} className="rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest">
            {listing.type === 'sale' ? 'Dijual' : 'Dicari'}
          </Badge>
        </div>
      </CardHeader>

      {listing.images && listing.images.length > 0 && (
        <div className="aspect-square w-full bg-zinc-100 relative group">
          {listing.images[0].startsWith('data:application/pdf') ? (
            <div className="w-full h-full flex items-center justify-center bg-zinc-200 text-zinc-500 font-bold">DOKUMEN PDF</div>
          ) : (
            <img 
              src={listing.images[0]} 
              alt={listing.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          {listing.type === 'sale' && (
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-lg">
              <p className="text-sm font-bold text-zinc-900">Rp {listing.price.toLocaleString('id-ID')}</p>
            </div>
          )}
        </div>
      )}

      <CardContent className="p-4 space-y-2">
        <h3 className="text-lg font-bold text-zinc-900 leading-tight">{listing.title}</h3>
        <p className="text-sm text-zinc-600 line-clamp-3 leading-relaxed">{listing.description}</p>
      </CardContent>

      {!hideActions && (
        <CardFooter className="p-4 pt-0 flex items-center justify-between border-t border-zinc-50 mt-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={onLike}
              className={`flex items-center gap-1.5 transition-colors ${listing.likes?.includes(user?.uid) ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Heart className={`w-5 h-5 ${listing.likes?.includes(user?.uid) ? 'fill-current' : ''}`} />
              <span className="text-xs font-semibold">{listing.likes?.length || 0}</span>
            </button>
            <button 
              onClick={() => setIsCommentOpen(!isCommentOpen)}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-semibold">{listing.commentCount || 0}</span>
            </button>
          </div>
          
          {user?.uid !== listing.authorId && (
            <Button 
              size="sm" 
              variant="outline" 
              className="rounded-full h-8 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer z-10" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startChat();
              }}
            >
              Tanya Penjual
            </Button>
          )}
        </CardFooter>
      )}

      <AnimatePresence>
        {isCommentOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-zinc-100 bg-zinc-50/50"
          >
            <div className="p-4 space-y-4">
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarImage src={comment.authorPhoto} />
                      <AvatarFallback>{comment.authorName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="bg-white p-2.5 rounded-2xl rounded-tl-none border border-zinc-100 shadow-sm">
                      <p className="text-[10px] font-bold text-zinc-900 mb-0.5">{comment.authorName}</p>
                      <p className="text-xs text-zinc-600 leading-normal">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="Tulis komentar..." 
                  className="bg-white border-zinc-200 h-9 text-sm rounded-full px-4"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <Button size="icon" className="rounded-full w-9 h-9 shrink-0" onClick={handleAddComment}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
