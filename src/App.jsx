import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where, getDocs, increment, addDoc, updateDoc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, BellRing, Plus, Edit2, Trash2, X, AlertCircle, LogOut, Users, Copy, FileText, Settings, ShieldAlert, CheckCircle2, Circle } from 'lucide-react';
import * as XLSX from 'xlsx'; // Mengaktifkan kembali pustaka Excel

export default function App() {
  const [events, setEvents] = useState([]);
  const [logs, setLogs] = useState([]); // State baru untuk menyimpan data Log
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewCount, setViewCount] = useState(0);
  const [filterSeksi, setFilterSeksi] = useState('Semua Seksi');
  const [viewMode, setViewMode] = useState('active'); // Mode Tampilan: 'active' (Jatuh Tempo), 'riwayat' (Riwayat Space), 'log' (Log Tabel)

  const [allUsers, setAllUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showManageUserModal, setShowManageUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', seksi: 'Pelayanan' });

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportText, setExportText] = useState('');

  const DAFTAR_SEKSI = [
    'Semua Seksi', 'SUKI', 'Pelayanan', 'PKD', 'P3', 
    'Was 1', 'Was 2', 'Was 3', 'Was 4', 'Was 5', 'Was 6', 'FPP'
  ];

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState([]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [formData, setFormData] = useState({ name: '', dueDate: '', dueTime: '', location: '', description: '' });
  const [editData, setEditData] = useState(null);

  // --- AMBIL DATA JADWAL (EVENTS) ---
  useEffect(() => {
    const q = collection(db, 'events');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- AMBIL DATA LOG (RIWAYAT TERARSIP) ---
  useEffect(() => {
    const q = collection(db, 'logs');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // --- AMBIL DATA AKUN (KHUSUS SUPERADMIN) ---
  useEffect(() => {
    if (currentUser?.role === 'superadmin') {
      const q = collection(db, 'users');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  // --- SISTEM OTOMASI CLEANUP & AUTO-ARCHIVE (CLIENT-SIDE CRON) ---
  useEffect(() => {
    if (events.length === 0) return;

    const processAutoArchive = async () => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      for (const event of events) {
        const [year, month, day] = event.dueDate.split('-');
        const due = new Date(year, month - 1, day);
        due.setHours(0, 0, 0, 0);
        
        // Hitung berapa hari terlewat dari hari ini
        const daysPassed = Math.floor((now - due) / (1000 * 60 * 60 * 24));

        // Jika melewati 30 hari (1 bulan), pindahkan ke Log dan hapus dari kartu aktif
        if (daysPassed > 30) {
          try {
            await addDoc(collection(db, 'logs'), {
              agenda: event.name,
              description: event.description || '-',
              ownerSeksi: event.ownerSeksi || 'Umum',
              dueDate: event.dueDate,
              createdAt: event.createdAt || new Date().toISOString(), // Tanggal Input
              archivedAt: new Date().toISOString()
            });
            await deleteDoc(doc(db, 'events', event.id));
          } catch (err) {
            console.error("Gagal melakukan auto-arsip agenda:", err);
          }
        }
      }
    };
    processAutoArchive();
  }, [events]);

  // --- OTOMASI HAPUS LOG YANG SUDAH MELEWATI 1 TAHUN ---
  useEffect(() => {
    if (logs.length === 0) return;
    const cleanOldLogs = async () => {
      const now = new Date();
      for (const log of logs) {
        if (log.archivedAt) {
          const archivedDate = new Date(log.archivedAt);
          const ageInDays = Math.floor((now - archivedDate) / (1000 * 60 * 60 * 24));
          // Jika data log sudah lebih dari 365 hari (1 tahun), hapus permanen
          if (ageInDays > 365) {
            await deleteDoc(doc(db, 'logs', log.id));
          }
        }
      }
    };
    cleanOldLogs();
  }, [logs]);

  // --- STATISTIK VIEWER COUNTER ---
  useEffect(() => {
    const recordVisit = async () => {
      if (!sessionStorage.getItem('sudah_berkunjung')) {
        try {
          await setDoc(doc(db, 'statistik', 'pengunjung'), { jumlah: increment(1) }, { merge: true });
          sessionStorage.setItem('sudah_berkunjung', 'true');
        } catch (error) { console.error(error); }
      }
    };
    recordVisit();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(doc(db, 'statistik', 'pengunjung'), (docSnap) => {
      if (docSnap.exists()) setViewCount(docSnap.data().jumlah || 0);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const parseDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return new Date(0);
    const [year, month, day] = dateStr.split('-');
    const [hours, minutes] = timeStr.split(':');
    return new Date(year, month - 1, day, hours, minutes);
  };

  // --- LOGIKA TAMPILAN URGENSI WARNA KARTU ---
  const getStatusInfo = (dueDate, dueTime, isDone) => {
    if (isDone) return { text: "Selesai", color: "bg-green-100 text-green-800", level: 'done' };
    
    const now = new Date();
    const eventDate = parseDateTime(dueDate, dueTime);
    const diffTime = eventDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffTime < 0) {
      const daysPassed = Math.floor((now - eventDate) / (1000 * 60 * 60 * 24));
      if (daysPassed >= 5) return { text: "RIWAYAT", color: "bg-purple-100 text-purple-800", level: 'archive' };
      return { text: "TERLEWAT", color: "bg-red-900 text-white", level: 'overdue' };
    }
    if (diffDays === 0) return { text: "HARI INI", color: "bg-red-500 text-white animate-pulse", level: 'critical' };
    if (diffDays <= 3) return { text: "MENDESAK", color: "bg-orange-100 text-orange-800", level: 'urgent' };
    if (diffDays <= 7) return { text: "ATENSI", color: "bg-yellow-100 text-yellow-800", level: 'warning' };
    return { text: "AMAN", color: "bg-blue-100 text-blue-800", level: 'safe' };
  };

  // --- UNDUH EXCEL UNTUK DATA LOG ---
  const exportLogsToExcel = () => {
    if (sortedLogs.length === 0) return;
    const excelData = sortedLogs.map((log, index) => ({
      "Nomor": index + 1,
      "Tanggal Input": log.createdAt ? new Date(log.createdAt).toLocaleDateString('id-ID') : '-',
      "Seksi": log.ownerSeksi,
      "Agenda": log.agenda,
      "Keterangan": log.description,
      "Tanggal JT": log.dueDate.split('-').reverse().join('/')
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Log Arsip");
    XLSX.writeFile(workbook, `Log_Riwayat_SUKI_${filterSeksi}.xlsx`);
    showToast("Tabel Log Berhasil Diunduh!");
  };

  const toggleEventStatus = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'events', id), { isDone: !currentStatus });
      showToast("Status agenda berhasil diubah");
    } catch (error) { alert("Gagal update status"); }
  };

  const handleExportAll = () => {
    if (sortedEvents.length === 0) return;
    const namaSeksi = filterSeksi === 'Semua Seksi' ? 'DJP' : filterSeksi;
    let text = `Izin mengingatkan agenda Seksi ${namaSeksi} (${viewMode === 'active' ? 'Jatuh Tempo' : 'Riwayat'}):\n\n`;
    sortedEvents.forEach((event, index) => {
      const tgl = event.dueDate.split('-').reverse().join('/');
      text += `${index + 1}. *${event.name}* [${tgl} ${event.dueTime} WIB]\n`;
    });
    text += `\nDetail: s.kemenkeu.go.id/ReminderSUKI\n\nTim ${namaSeksi}`;
    setExportText(text);
    setShowExportModal(true);
  };

  // --- PENYARINGAN KARTU SESUAI SPACE DAN MODE ---
  const sortedEvents = useMemo(() => {
    let filtered = events;
    if (filterSeksi !== 'Semua Seksi') filtered = filtered.filter(e => e.ownerSeksi === filterSeksi);
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return [...filtered].filter(event => {
      const [year, month, day] = event.dueDate.split('-');
      const due = new Date(year, month - 1, day);
      due.setHours(0, 0, 0, 0);
      const daysPassed = Math.floor((now - due) / (1000 * 60 * 60 * 24));

      if (viewMode === 'active') {
        // Jatuh tempo: Belum lewat 5 hari
        return daysPassed < 5;
      } else if (viewMode === 'riwayat') {
        // Riwayat Space: Sudah lewat 5 hari sampai maksimal 30 hari
        return daysPassed >= 5 && daysPassed <= 30;
      }
      return false;
    }).sort((a, b) => parseDateTime(a.dueDate, a.dueTime) - parseDateTime(b.dueDate, b.dueTime));
  }, [events, filterSeksi, viewMode]);

  // --- FILTER DAN SORTING LOG ---
  const sortedLogs = useMemo(() => {
    let filtered = logs;
    if (filterSeksi !== 'Semua Seksi') filtered = filtered.filter(l => l.ownerSeksi === filterSeksi);
    return [...filtered].sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  }, [logs, filterSeksi]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const q = query(collection(db, "users"), where("username", "==", username), where("password", "==", password));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        setCurrentUser({ username: userData.username, role: userData.role, seksi: userData.seksi });
        setShowLoginModal(false); setUsername(''); setPassword('');
        showToast(`Selamat datang, ${userData.username}`);
      } else { setLoginError('Username/Password salah.'); }
    } catch (error) { setLoginError('Koneksi bermasalah.'); }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const newId = Math.random().toString(36).substr(2, 9);
    const newEvent = { 
      ...formData, 
      id: newId, 
      isDone: false, 
      ownerSeksi: currentUser?.seksi || 'Umum',
      createdAt: new Date().toISOString() // Pencatatan tanggal input agenda asli
    };
    try {
      await setDoc(doc(db, 'events', newId), newEvent);
      setShowAddModal(false); setFormData({ name: '', dueDate: '', dueTime: '', location: '', description: '' });
      showToast("Agenda berhasil disimpan");
    } catch (error) { console.error(error); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'events', editData.id), editData, { merge: true });
      setShowEditModal(false); showToast("Agenda berhasil diubah");
    } catch (error) { console.error(error); }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteDoc(doc(db, 'events', eventToDelete));
      setEventToDelete(null); showToast("Agenda berhasil dihapus");
    } catch (error) { console.error(error); }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-indigo-600 sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><Calendar size={24} /></div>
            <div><h1 className="text-xl font-bold">Reminder SUKI</h1><p className="text-xs text-indigo-100 tracking-wider">Kepatuhan Internal DJP</p></div>
          </div>
          {currentUser ? (
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold mr-2"><Users size={14} className="mr-1.5"/>{viewCount} Views</div>
              {currentUser.role === 'superadmin' && (
                <button onClick={() => setShowManageUserModal(true)} className="bg-orange-500 p-2 rounded-lg shadow-md hover:bg-orange-600"><Settings size={18}/></button>
              )}
              <button onClick={() => {setCurrentUser(null); showToast("Berhasil Logout");}} className="bg-white/10 p-2 rounded-lg"><LogOut size={18}/></button>
            </div>
          ) : ( <button onClick={() => setShowLoginModal(true)} className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm shadow-md">Login</button> )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* --- PANEL NAVIGASI BARU (SESUAI ATURAN POIN 4) --- */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><BellRing size={20} /></div>
            <h2 className="font-bold text-gray-700">Akses Ruang Monitoring</h2>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center w-full md:w-auto justify-end">
            {/* Tombol Rekap Teks */}
            {sortedEvents.length > 0 && viewMode !== 'log' && (
              <button onClick={handleExportAll} className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
                <FileText size={14} /> Rekap
              </button>
            )}

            {/* Tombol Navigasi Space Samping Rekap */}
            <button onClick={() => setViewMode('active')} className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all ${viewMode === 'active' ? 'bg-indigo-600 text-white border-b-4 border-indigo-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Jatuh Tempo</button>
            <button onClick={() => setViewMode('riwayat')} className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all ${viewMode === 'riwayat' ? 'bg-purple-600 text-white border-b-4 border-purple-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Space Riwayat</button>
            <button onClick={() => setViewMode('log')} className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all ${viewMode === 'log' ? 'bg-orange-500 text-white border-b-4 border-orange-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Log Riwayat</button>

            {/* Filter Seksi */}
            <select value={filterSeksi} onChange={(e) => setFilterSeksi(e.target.value)} className="bg-gray-100 px-3 py-2 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
              {DAFTAR_SEKSI.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* --- KONDISI TAMPILAN: TABEL LOG RIWAYAT (POIN 3) --- */}
        {viewMode === 'log' ? (
          <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 overflow-x-auto transform transition-all duration-300">
            <div className="flex justify-between items-center mb-4 bg-gray-50 p-3 rounded-xl border">
              <div>
                <h3 className="font-black text-gray-800 text-md">Tabel Log Arsip Agenda (&gt; 1 Bulan)</h3>
                <p className="text-xs text-gray-400 font-medium">Data tersimpan otomatis untuk siklus masa 1 tahun.</p>
              </div>
              {sortedLogs.length > 0 && (
                <button onClick={exportLogsToExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all">
                  <FileText size={14} /> Unduh Excel
                </button>
              )}
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-100 text-gray-600 font-black uppercase tracking-wider">
                  <th className="py-3 px-4 rounded-l-lg">Nomor</th>
                  <th className="py-3 px-4">Tanggal Input</th>
                  <th className="py-3 px-4">Seksi</th>
                  <th className="py-3 px-4">Agenda</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4 rounded-r-lg">Tanggal JT</th>
                </tr>
              </thead>
              <tbody>
                {sortedLogs.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-10 text-gray-400 font-bold">Belum ada data arsip log otomatis.</td></tr>
                ) : (
                  sortedLogs.map((log, index) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 font-bold text-gray-700 transition-colors">
                      <td className="py-3 px-4 text-gray-400">{index + 1}</td>
                      <td className="py-3 px-4">{log.createdAt ? new Date(log.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[10px] font-black text-indigo-700">{log.ownerSeksi}</span></td>
                      <td className="py-3 px-4 text-gray-900 font-black">{log.agenda}</td>
                      <td className="py-3 px-4 max-w-xs truncate" title={log.description}>{log.description}</td>
                      <td className="py-3 px-4 text-indigo-600 font-black">{log.dueDate.split('-').reverse().join('/')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* --- KONDISI TAMPILAN KARTU (JATUH TEMPO & RIWAYAT SPACE) --- */
          isLoading ? ( <div className="text-center py-10 font-bold text-gray-400">Sinkronisasi data...</div> ) : sortedEvents.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 font-black"><AlertCircle size={48} className="mx-auto mb-4 opacity-20"/>Tidak ada agenda aktif di ruang monitor ini.</div>
          ) : (
            <div className="space-y-4">
              {sortedEvents.map((event) => {
                const status = getStatusInfo(event.dueDate, event.dueTime, event.isDone);
                let cardStyle = status.level === 'overdue' ? 'border-red-900 bg-red-50/50' : 
                                status.level === 'critical' ? 'border-red-500 bg-red-50/50' : 
                                status.level === 'archive' ? 'border-purple-400 bg-purple-50/30' :
                                status.level === 'done' ? 'border-green-400 bg-gray-50 opacity-75' : 'border-gray-200 bg-white';
                
                return (
                  <div key={event.id} className={`group border-l-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border ${cardStyle} transform hover:-translate-y-1`}>
                    <div className="p-5 flex flex-col md:flex-row gap-5 items-start">
                      <div className="mt-1">
                        {currentUser && (currentUser.role === 'superadmin' || currentUser.seksi === event.ownerSeksi) ? (
                          <button onClick={() => toggleEventStatus(event.id, event.isDone)} className={`transition-colors ${event.isDone ? 'text-green-500' : 'text-gray-300 hover:text-indigo-400'}`}>
                            {event.isDone ? <CheckCircle2 size={26} /> : <Circle size={26} />}
                          </button>
                        ) : (
                          <div className={event.isDone ? 'text-green-500' : 'text-gray-200'}><CheckCircle2 size={26} /></div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-tighter shadow-sm ${status.color}`}>{status.text}</span>
                          <span className="px-2 py-1 bg-white border rounded-md text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tim: {event.ownerSeksi}</span>
                        </div>
                        <h3 className={`text-lg font-black leading-tight mb-3 ${event.isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{event.name}</h3>
                        <div className="flex flex-wrap gap-3 text-xs font-bold text-gray-500">
                          <div className="flex items-center px-2 py-1 bg-white border rounded-md shadow-sm"><Clock size={14} className="mr-1.5 text-indigo-500"/>{event.dueDate.split('-').reverse().join('/')} • {event.dueTime} WIB</div>
                          {event.location && <div className="flex items-center px-2 py-1 bg-white border rounded-md shadow-sm"><MapPin size={14} className="mr-1.5 text-red-500"/>{event.location}</div>}
                        </div>
                      </div>

                      <div className="flex md:flex-col gap-2 w-full md:w-auto">
                        <button onClick={() => {setExportText(formatSingleEvent(event)); setShowExportModal(true);}} className="flex-1 p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"><FileText size={18}/></button>
                        {currentUser && (currentUser.role === 'superadmin' || currentUser.seksi === event.ownerSeksi) && (
                          <>
                            <button onClick={() => {setEditData(event); setShowEditModal(true);}} className="flex-1 p-2.5 bg-blue-500 text-white rounded-xl shadow-md hover:bg-blue-600"><Edit2 size={18}/></button>
                            <button onClick={() => setEventToDelete(event.id)} className="flex-1 p-2.5 bg-red-500 text-white rounded-xl shadow-md hover:bg-red-600"><Trash2 size={18}/></button>
                          </>
                        )}
                      </div>
                    </div>
                    {event.description && (
                      <div className="mt-2 px-5 pb-4 border-t border-gray-100 pt-3">
                        <p className={`text-sm text-gray-700 font-medium ${!expandedEvents.includes(event.id) && 'line-clamp-2'}`}>{event.description}</p>
                        <button onClick={() => setExpandedEvents(prev => prev.includes(event.id) ? prev.filter(e => e !== event.id) : [...prev, event.id])} className="text-xs font-bold text-indigo-600 mt-2 bg-white px-2.5 py-1 rounded shadow-sm border">{expandedEvents.includes(event.id) ? 'Tutup' : 'Selengkapnya'}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </main>

      {currentUser && <button onClick={() => setShowAddModal(true)} className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"><Plus size={32}/></button>}

      {/* --- MODAL EKSPOR POP-UP --- */}
      {showExportModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl border-t-8 border-indigo-600">
            <h3 className="text-2xl font-black text-gray-800 mb-2">Salin Pengingat</h3>
            <div className="bg-gray-50 border rounded-2xl p-5 mb-6 max-h-64 overflow-y-auto"><pre className="whitespace-pre-wrap text-sm font-sans font-bold text-gray-700 leading-relaxed">{exportText}</pre></div>
            <div className="flex gap-3">
              <button onClick={() => setShowExportModal(false)} className="flex-1 py-4 bg-gray-100 font-bold rounded-2xl">Batal</button>
              <button onClick={() => {navigator.clipboard.writeText(exportText); showToast("Berhasil Disalin!"); setShowExportModal(false);}} className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2"><Copy size={20} /> Salin Teks</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL LOGIN --- */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-2xl font-black mb-6 text-indigo-600">Admin Area</h3>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 outline-none font-bold" />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 outline-none font-bold" />
              {loginError && <p className="text-red-500 text-xs font-bold text-center italic">{loginError}</p>}
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl">MASUK SISTEM</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL MANAGE USER (SUPERADMIN CONTROL PANEL) --- */}
      {showManageUserModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl max-h-[80vh] flex flex-col border-t-8 border-orange-500">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">Kontrol Akun Seksi</h3>
              <button onClick={() => setShowManageUserModal(false)} className="bg-gray-100 p-2 rounded-full"><X/></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3 pr-2">
              <button onClick={() => setShowUserModal(true)} className="w-full p-4 border-2 border-dashed border-green-300 rounded-2xl text-green-600 font-black flex items-center justify-center gap-2 hover:bg-green-50"><Plus size={20}/> BUAT AKUN BARU</button>
              {allUsers.map((user) => (
                <div key={user.id} className="bg-gray-50 p-4 rounded-2xl border-2 border-gray-100 flex justify-between items-center">
                  <div><p className="font-black text-gray-900">{user.username}</p><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Seksi: {user.seksi}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => {const np = prompt("Ketik Password Baru:"); if(np) updateDoc(doc(db,'users',user.id),{password:np}); showToast("Password diupdate!");}} className="p-2 bg-white border shadow-sm rounded-lg text-blue-500" title="Ubah Password"><Edit2 size={16}/></button>
                    {user.username !== 'superadmin' && (
                      <button onClick={() => {if(window.confirm("Hapus akun ini?")) { deleteDoc(doc(db,'users',user.id)); showToast("Akun dihapus!"); } }} className="p-2 bg-white border shadow-sm rounded-lg text-red-500" title="Hapus Akun"><Trash2 size={16}/></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DAFTAR USER --- */}
      {showUserModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-6">Pendaftaran Akun</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <select value={newUserForm.seksi} onChange={(e) => setNewUserForm({...newUserForm, seksi: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold">
                {DAFTAR_SEKSI.filter(s => s !== 'Semua Seksi').map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" placeholder="Username" value={newUserForm.username} onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value.toLowerCase()})} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold" required />
              <input type="text" placeholder="Password" value={newUserForm.password} onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold" required />
              <button type="submit" className="w-full py-4 bg-green-500 text-white font-black rounded-2xl shadow-lg">SIMPAN AKUN</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL TAMBAH JADWAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black mb-6">Agenda Baru</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <input type="text" placeholder="Nama Kegiatan/Agenda" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold" required />
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-2 rounded-2xl"><label className="text-[10px] font-black text-gray-400 ml-2 uppercase">Jatuh Tempo</label><input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full bg-transparent p-2 font-bold outline-none" required /></div>
                <div className="bg-gray-50 p-2 rounded-2xl"><label className="text-[10px] font-black text-gray-400 ml-2 uppercase">Waktu WIB</label><input type="time" value={formData.dueTime} onChange={(e) => setFormData({...formData, dueTime: e.target.value})} className="w-full bg-transparent p-2 font-bold outline-none" required /></div>
              </div>
              <input type="text" placeholder="Lokasi/Tautan Dokumen" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold" />
              <textarea placeholder="Keterangan Tambahan..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="3" className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold resize-none"></textarea>
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl">SIMPAN KE KALENDER</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT JADWAL --- */}
      {showEditModal && editData && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black mb-6">Ubah Agenda</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input type="text" value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold" required />
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-2 rounded-2xl font-bold"><input type="date" value={editData.dueDate} onChange={(e) => setEditData({...editData, dueDate: e.target.value})} className="w-full bg-transparent" /></div>
                <div className="bg-gray-50 p-2 rounded-2xl font-bold"><input type="time" value={editData.dueTime} onChange={(e) => setEditData({...editData, dueTime: e.target.value})} className="w-full bg-transparent" /></div>
              </div>
              <input type="text" value={editData.location} onChange={(e) => setEditData({...editData, location: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold" />
              <textarea value={editData.description} onChange={(e) => setEditData({...editData, description: e.target.value})} rows="3" className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold resize-none"></textarea>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl">UPDATE DATA</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL HAPUS FIX (BUG #1 SOLVED) --- */}
      {eventToDelete && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl border-t-8 border-red-500">
            <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-black mb-2">Hapus dari Sistem?</h3>
            <p className="text-sm text-gray-500 mb-6">Data tidak dapat dikembalikan setelah dihapus.</p>
            <div className="flex gap-3">
              <button onClick={() => setEventToDelete(null)} className="flex-1 py-3 bg-gray-100 font-black rounded-xl">BATAL</button>
              <button onClick={handleDeleteConfirm} className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl shadow-lg">YA, HAPUS</button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 px-8 py-4 bg-gray-900 text-white rounded-2xl shadow-2xl font-black text-sm tracking-tighter uppercase animate-in fade-in slide-in-from-bottom-5">
          {toast.message}
        </div>
      )}
    </div>
  );
}
