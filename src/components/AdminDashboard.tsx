import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Badge } from "@components/ui/badge"
import { ScrollArea } from "@components/ui/scroll-area"
import { ShieldAlert, Trash2, CheckCircle2, XCircle, Flag, ExternalLink, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { auth } from '../firebase';

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
  throw new Error(JSON.stringify(errInfo));
}

export default function AdminDashboard({ onViewProfile }: { onViewProfile: (userId: string) => void }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleResolve = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status });
      toast.success(`Laporan ${status === 'resolved' ? 'diselesaikan' : 'diabaikan'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const handleAction = async (report: any, action: 'ban_listing' | 'ban_user' | 'delete_listing' | 'delete_user') => {
    try {
      if (action === 'ban_listing') {
        await updateDoc(doc(db, 'listings', report.targetId), { status: 'banned' });
        toast.success('Postingan berhasil di-ban');
      } else if (action === 'ban_user') {
        await updateDoc(doc(db, 'users', report.targetId), { status: 'banned' });
        toast.success('Pengguna berhasil di-ban');
      } else if (action === 'delete_listing') {
        await deleteDoc(doc(db, 'listings', report.targetId));
        toast.success('Postingan berhasil dihapus');
      } else if (action === 'delete_user') {
        await updateDoc(doc(db, 'users', report.targetId), { status: 'deleted' });
        toast.success('Pengguna berhasil dihapus');
      }
      await updateDoc(doc(db, 'reports', report.id), { status: 'resolved' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `admin_action/${action}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Dashboard Admin</h2>
          <p className="text-sm text-zinc-500">Kelola laporan komunitas</p>
        </div>
        <div className="bg-zinc-100 p-2 rounded-full">
          <ShieldAlert className="w-5 h-5 text-zinc-500" />
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-400">Memuat laporan...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-zinc-200 text-zinc-400">
            Tidak ada laporan masuk.
          </div>
        ) : (
          reports.map((report) => (
            <Card key={report.id} className={`border-zinc-200 shadow-sm overflow-hidden ${report.status !== 'pending' ? 'opacity-60' : ''}`}>
              <CardHeader className="p-4 bg-zinc-50/50 border-b border-zinc-100 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Badge variant={report.targetType === 'listing' ? 'outline' : 'secondary'} className="text-[10px] font-bold uppercase tracking-widest">
                    {report.targetType === 'listing' ? 'Postingan' : 'Pengguna'}
                  </Badge>
                  <span className="text-[10px] text-zinc-400 font-medium uppercase">
                    {report.createdAt?.seconds ? formatDistanceToNow(new Date(report.createdAt.seconds * 1000), { addSuffix: true, locale: id }) : ''}
                  </span>
                </div>
                <Badge variant={report.status === 'pending' ? 'destructive' : 'outline'} className="text-[10px] font-bold uppercase">
                  {report.status === 'pending' ? 'Menunggu' : report.status === 'resolved' ? 'Selesai' : 'Diabaikan'}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-zinc-900">Target: {report.targetTitle}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] font-bold uppercase tracking-wider"
                      onClick={() => onViewProfile(report.targetType === 'user' ? report.targetId : report.authorId)}
                    >
                      Lihat Profil <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500">Pelapor: {report.reporterName}</p>
                </div>

                <div className="bg-orange-50/50 border border-orange-100 p-3 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1">
                    <Flag className="w-3 h-3" /> Alasan: {report.reason}
                  </p>
                  <p className="text-sm text-zinc-700">{report.details || 'Tidak ada detail tambahan.'}</p>
                </div>

                {report.status === 'pending' && (
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex gap-2">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="flex-1 h-9 text-xs font-bold uppercase tracking-wider"
                        onClick={() => handleAction(report, report.targetType === 'listing' ? 'ban_listing' : 'ban_user')}
                      >
                        Ban {report.targetType === 'listing' ? 'Post' : 'User'}
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="flex-1 h-9 text-xs font-bold uppercase tracking-wider bg-red-800 hover:bg-red-900"
                        onClick={() => handleAction(report, report.targetType === 'listing' ? 'delete_listing' : 'delete_user')}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Hapus
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-9 text-xs font-bold uppercase tracking-wider"
                      onClick={() => handleResolve(report.id, 'dismissed')}
                    >
                      Abaikan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
