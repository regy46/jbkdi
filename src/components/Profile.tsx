import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, collection, query, where, orderBy, onSnapshot, getDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card"
import { Label } from "@components/ui/label"
import { toast } from 'sonner';
import { User, Camera, Mail, Phone, MapPin, ShieldCheck, LayoutGrid, ArrowLeft, CheckCircle2, Users, Flag, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from "@components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter
} from "@components/ui/dialog"

import { ListingCard } from './Marketplace';

export default function Profile({ userData: currentUserData, viewUserId, onBack }: { userData: any, viewUserId?: string | null, onBack?: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [userListings, setUserListings] = useState<any[]>([]);
  const [profileData, setProfileData] = useState<any>(currentUserData);
  const [loading, setLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);

  const isOwnProfile = !viewUserId || viewUserId === auth.currentUser?.uid;
  const isAdmin = currentUserData?.role === 'admin';

  useEffect(() => {
    if (isOwnProfile) {
      setProfileData(currentUserData);
    } else if (viewUserId) {
      const fetchUser = async () => {
        const docRef = doc(db, 'users', viewUserId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfileData(docSnap.data());
          setIsFollowing(docSnap.data().followers?.includes(auth.currentUser?.uid));
        }
      };
      fetchUser();
    }
  }, [viewUserId, currentUserData, isOwnProfile]);

  useEffect(() => {
    const targetUserId = viewUserId || auth.currentUser?.uid;
    if (targetUserId) {
      const q = query(
        collection(db, 'listings'),
        where('authorId', '==', targetUserId)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setUserListings(docs);
      });
      return () => unsubscribe();
    }
  }, [viewUserId]);

  const [formData, setFormData] = useState({
    displayName: profileData?.displayName || '',
    bio: profileData?.bio || '',
    photoURL: profileData?.photoURL || '',
    kecamatan: profileData?.kecamatan || ''
  });

  useEffect(() => {
    if (profileData) {
      setFormData({
        displayName: profileData.displayName || '',
        bio: profileData.bio || '',
        photoURL: profileData.photoURL || '',
        kecamatan: profileData.kecamatan || ''
      });
    }
  }, [profileData]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(doc(db, 'users', user.uid), {
        displayName: formData.displayName,
        bio: formData.bio,
        photoURL: formData.photoURL,
        kecamatan: formData.kecamatan
      });

      toast.success('Profil berhasil diperbarui');
      setIsEditing(false);
    } catch (error) {
      toast.error('Gagal memperbarui profil');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoURL: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFollowToggle = async () => {
    const user = auth.currentUser;
    if (!user || !viewUserId) return;

    try {
      const targetUserRef = doc(db, 'users', viewUserId);
      const currentUserRef = doc(db, 'users', user.uid);

      if (isFollowing) {
        await updateDoc(targetUserRef, { followers: arrayRemove(user.uid) });
        await updateDoc(currentUserRef, { following: arrayRemove(viewUserId) });
        setIsFollowing(false);
        setProfileData((prev: any) => ({
          ...prev,
          followers: (prev.followers || []).filter((id: string) => id !== user.uid)
        }));
        toast.success('Berhenti mengikuti');
      } else {
        await updateDoc(targetUserRef, { followers: arrayUnion(user.uid) });
        await updateDoc(currentUserRef, { following: arrayUnion(viewUserId) });
        setIsFollowing(true);
        setProfileData((prev: any) => ({
          ...prev,
          followers: [...(prev.followers || []), user.uid]
        }));
        toast.success('Mulai mengikuti');
      }
    } catch (error) {
      toast.error('Gagal memproses');
    }
  };

  const handleVerifyToggle = async () => {
    if (!isAdmin || !viewUserId) return;
    try {
      const targetUserRef = doc(db, 'users', viewUserId);
      const newStatus = !profileData.isVerified;
      await updateDoc(targetUserRef, { isVerified: newStatus });
      setProfileData((prev: any) => ({ ...prev, isVerified: newStatus }));
      toast.success(newStatus ? 'Pengguna diverifikasi' : 'Verifikasi dicabut');
    } catch (error) {
      toast.error('Gagal mengubah status verifikasi');
    }
  };

  const handleReportUser = async () => {
    if (!reportReason) {
      toast.error('Silakan pilih alasan laporan');
      return;
    }
    const user = auth.currentUser;
    if (!user || !viewUserId) return;

    setIsReporting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reporterName: currentUserData?.displayName || 'Anonim',
        targetId: viewUserId,
        targetType: 'user',
        targetTitle: profileData.displayName,
        reason: reportReason,
        details: reportDetails,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast.success('Laporan pengguna berhasil dikirim');
      setIsReportDialogOpen(false);
      setReportReason('');
      setReportDetails('');
    } catch (error) {
      toast.error('Gagal mengirim laporan');
    } finally {
      setIsReporting(false);
    }
  };

  const handleBanUser = async () => {
    if (!isAdmin || !viewUserId) return;
    try {
      await updateDoc(doc(db, 'users', viewUserId), {
        status: 'banned'
      });
      toast.success('Pengguna berhasil di-ban');
      setIsBanDialogOpen(false);
    } catch (error) {
      toast.error('Gagal mem-ban pengguna');
    }
  };

  if (!profileData) return <div className="p-8 text-center text-zinc-500">Memuat profil...</div>;

  if (profileData.status === 'banned') {
    return (
      <div className="space-y-6">
        {!isOwnProfile && (
          <Button variant="ghost" onClick={onBack} className="mb-2 -ml-2 text-zinc-500">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
        )}
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-2 max-w-xs">
            <h2 className="text-xl font-bold text-zinc-900">Akun Dibekukan</h2>
            <p className="text-sm text-zinc-500">Profil ini tidak tersedia karena telah melanggar pedoman komunitas kami.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isOwnProfile && (
        <Button variant="ghost" onClick={onBack} className="mb-2 -ml-2 text-zinc-500">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
      )}

      <div className="flex flex-col items-center text-center space-y-4 py-6">
        <div className="relative group">
          <Avatar className="w-28 h-28 border-4 border-white shadow-xl">
            <AvatarImage src={profileData.photoURL} />
            <AvatarFallback className="text-3xl bg-zinc-100 text-zinc-400">
              {profileData.displayName?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          {isOwnProfile && (
            <label className="absolute bottom-1 right-1 bg-zinc-900 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer">
              <Camera className="w-4 h-4" />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = reader.result as string;
                      try {
                        await updateDoc(doc(db, 'users', auth.currentUser!.uid), {
                          photoURL: base64
                        });
                        toast.success('Foto profil diperbarui');
                      } catch (err) {
                        toast.error('Gagal memperbarui foto');
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-2xl font-bold text-zinc-900">{profileData.displayName || 'Pengguna'}</h2>
            {(profileData.isVerified || profileData.role === 'admin') && (
              <CheckCircle2 className="w-5 h-5 text-blue-500 fill-blue-50" />
            )}
          </div>
          <p className="text-sm text-zinc-500 font-medium">@{profileData.username}</p>
        </div>
        
        <div className="flex gap-6 text-sm">
          <div className="flex flex-col items-center">
            <span className="font-bold text-zinc-900">{profileData.followers?.length || 0}</span>
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Pengikut</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-zinc-900">{profileData.following?.length || 0}</span>
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Mengikuti</span>
          </div>
        </div>

        {!isOwnProfile && (
          <div className="flex gap-2 mt-2">
            <Button 
              variant={isFollowing ? "outline" : "default"} 
              className="rounded-full px-8"
              onClick={handleFollowToggle}
            >
              {isFollowing ? 'Mengikuti' : 'Ikuti'}
            </Button>
            {isAdmin && (
              <>
                <Button 
                  variant={profileData.isVerified ? "destructive" : "secondary"} 
                  className="rounded-full px-4"
                  onClick={handleVerifyToggle}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {profileData.isVerified ? 'Cabut Verifikasi' : 'Verifikasi'}
                </Button>
                <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-full px-4 border-red-200 text-red-500 hover:bg-red-50">
                      <ShieldAlert className="w-4 h-4 mr-2" />
                      Ban Akun
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ban Pengguna?</DialogTitle>
                      <DialogDescription>
                        Pengguna ini tidak akan bisa masuk atau memposting lagi.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsBanDialogOpen(false)}>Batal</Button>
                      <Button variant="destructive" onClick={handleBanUser}>Ya, Ban Akun</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full px-4 border-orange-200 text-orange-500 hover:bg-orange-50">
                  <Flag className="w-4 h-4 mr-2" />
                  Lapor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Laporkan Pengguna</DialogTitle>
                  <DialogDescription>
                    Bantu kami menjaga komunitas tetap aman dari penipuan.
                  </DialogDescription>
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
                      <option value="penipuan">Penipuan / Tidak Amanah</option>
                      <option value="palsu">Akun Palsu / Kloning</option>
                      <option value="kasar">Perilaku Kasar</option>
                      <option value="lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Detail Tambahan</Label>
                    <Textarea 
                      placeholder="Jelaskan pengalaman Anda dengan pengguna ini..."
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>Batal</Button>
                  <Button variant="destructive" onClick={handleReportUser} disabled={isReporting}>
                    {isReporting ? 'Mengirim...' : 'Kirim Laporan'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Card className="border-zinc-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-500">Informasi Profil</CardTitle>
            {isOwnProfile && !isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                Edit Profil
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {isEditing && isOwnProfile ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input 
                  value={formData.displayName} 
                  onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea 
                  value={formData.bio} 
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  placeholder="Ceritakan sedikit tentang Anda..."
                />
              </div>
              <div className="space-y-2">
                <Label>Foto Profil</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border">
                    <AvatarImage src={formData.photoURL} />
                    <AvatarFallback>{formData.displayName?.[0]}</AvatarFallback>
                  </Avatar>
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Kecamatan</Label>
                <Input 
                  value={formData.kecamatan} 
                  onChange={(e) => setFormData({...formData, kecamatan: e.target.value})}
                  placeholder="Contoh: Kadia, Puuwatu, dll."
                />
                <p className="text-[10px] text-zinc-400 italic">*Kota otomatis diatur ke Kota Kendari</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={handleUpdate} disabled={loading}>
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Batal</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-zinc-100 p-2.5 rounded-xl">
                  <User className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Bio</p>
                  <p className="text-sm text-zinc-700 leading-relaxed">{profileData.bio || 'Belum ada bio.'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-zinc-100 p-2.5 rounded-xl">
                  <MapPin className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Lokasi</p>
                  <p className="text-sm text-zinc-700 leading-relaxed">
                    {profileData.kecamatan ? `${profileData.kecamatan}, ` : ''}Kota Kendari
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pt-4 space-y-4">
        <div className="flex items-center gap-2 px-1">
          <LayoutGrid className="w-5 h-5 text-zinc-900" />
          <h3 className="font-bold text-zinc-900">Postingan {isOwnProfile ? 'Saya' : profileData.displayName}</h3>
        </div>
        
        <div className="grid gap-4">
          {userListings.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-zinc-200 text-zinc-400 text-sm">
              Belum ada postingan.
            </div>
          ) : (
            userListings.map(listing => (
              <ListingCard key={listing.id} listing={listing} hideActions={true} />
            ))
          )}
        </div>

        {isOwnProfile && (
          <Button 
            variant="destructive" 
            className="w-full rounded-xl h-12 font-bold uppercase tracking-wider shadow-lg shadow-red-100 mt-8"
            onClick={() => auth.signOut()}
          >
            Keluar dari Akun
          </Button>
        )}
      </div>
    </div>
  );
}
