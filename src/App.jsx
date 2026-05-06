import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where, getDocs, increment, addDoc, updateDoc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, BellRing, Plus, Edit2, Trash2, X, AlertCircle, LogOut, Users, Copy, FileText, Settings, ShieldAlert } from 'lucide-react';

export default function App() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewCount, setViewCount] = useState(0);
  const [filterSeksi, setFilterSeksi] = useState('Semua Seksi');
  
  // --- STATE MANAJEMEN USER ---
  const [allUsers, setAllUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showManageUserModal, setShowManageUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', seksi: 'Pelayanan' });
  const [editUserPass, setEditUserPass] = useState({ id: '', password: '' });

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

  // --- AMBIL DATA EVENT ---
  useEffect(() => {
    const q = collection(db, 'events');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- AMBIL DATA USER (KHUSUS SUPERADMIN) ---
  useEffect(() => {
    if (currentUser?.role === 'superadmin') {
      const q = collection(db, 'users');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllUsers(userData);
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  // --- STATISTIK PENGUNJUNG ---
  useEffect(() => {
    const recordVisit = async () => {
      if (!sessionStorage.getItem('sudah_berkunjung')) {
        try {
          await setDoc(doc(db, 'statistik', 'pengunjung'), { jumlah: increment(1) }, { merge: true });
          sessionStorage.setItem('sudah_berkunjung', 'true');
        } catch (error) { console.error("Gagal hitung pengunjung", error); }
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

  const getStatusInfo = (dueDate, dueTime) => {
    const now = new Date();
    const eventDate = parseDateTime(dueDate, dueTime);
    const diffTime = eventDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffTime < 0) return { text: "Selesai/Terlewat", color: "bg-gray-100 text-gray-800", isUrgent: false };
    if (diffDays === 0) return { text: "Hari Ini", color: "bg-red-100 text-red-800", isUrgent: true };
    if (diffDays <= 2) return { text: `${diffDays} Hari Lagi`, color: "bg-orange-100 text-orange-800", isUrgent: true };
    if (diffDays <= 7) return { text: `${diffDays} Hari Lagi`, color: "bg-yellow-100 text-yellow-800", isUrgent: false };
    return { text: `${diffDays} Hari Lagi`, color: "bg-green-100 text-green-800", isUrgent: false };
  };

  // --- LOGIKA EKSPOR ---
  const formatSingleEvent = (event) => {
    const tgl = event.dueDate.split('-').reverse().join('/');
    return `izin menyampaikan reminder *${event.name}* untuk dilaksanakan paling lambat *${tgl} pukul ${event.dueTime} WIB*\n\nhal-hal untuk diketahui:\n${event.description || '-'}\n\nuntuk lebih jelas dapat mengunjungi tautan s.kemenkeu.go.id/ReminderSUKI\n\nTerima kasih atas perhatiannya\n\nTim ${event.ownerSeksi || 'Kepatuhan Internal'}`;
  };

  const handleExportAll = () => {
    if (sortedEvents.length === 0) return;
    const namaSeksi = filterSeksi === 'Semua Seksi' ? 'DJP' : filterSeksi;
    let text = `Izin mengingatkan agenda Seksi ${namaSeksi}:\n\n`;
    sortedEvents.forEach((event, index) => {
      const tgl = event.dueDate.split('-').reverse().join('/');
      text += `${index + 1}. *${event.name}* paling lambat *${tgl} pukul ${event.dueTime} WIB*\n`;
    });
    text += `\nuntuk lebih jelas dapat mengunjungi tautan s.kemenkeu.go.id/ReminderSUKI\n\nTerima kasih atas perhatiannya\n\nTim ${namaSeksi}`;
    setExportText(text);
    setShowExportModal(true);
  };

  // --- LOGIKA USER MANAGEMENT ---
  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const q = query(collection(db, "users"), where("username", "==", newUserForm.username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) { alert('Username sudah ada!'); return; }
      await addDoc(collection(db, 'users'), { ...newUserForm, role: 'admin_seksi' });
      setShowUserModal(false); setNewUserForm({ username: '', password: '', seksi: 'Pelayanan' });
      showToast("Akun seksi berhasil dibuat!");
    } catch (error) { alert('Gagal membuat akun.'); }
  };

  const handleDeleteUser = async (id, name) => {
    if (name === 'superadmin') { alert('Akun superadmin tidak boleh dihapus!'); return; }
    if (window.confirm(`Hapus akun ${name}? Seluruh akses seksi ini akan dicabut.`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        showToast("Akun berhasil dihapus");
      } catch (error) { alert("Gagal menghapus akun"); }
    }
  };

  const handleUpdatePassword = async (id) => {
    if (!editUserPass.password) return;
    try {
      await updateDoc(doc(db, 'users', id), { password: editUserPass.password });
      setEditUserPass({ id: '', password: '' });
      showToast("Password berhasil diperbarui!");
    } catch (error) { alert("Gagal update password"); }
  };

  // --- LOGIKA EVENT ---
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
    const newEvent = { ...formData, id: newId, lastEdited: null, ownerSeksi: currentUser?.seksi || 'Umum' };
    try {
      await setDoc(doc(db, 'events', newId), newEvent);
      setShowAddModal(false); setFormData({ name: '', dueDate: '', dueTime: '', location: '', description: '' });
      showToast("Agenda berhasil disimpan");
    } catch (error) { console.error(error); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const editRef = doc(db, 'events', editData.id);
      await setDoc(editRef, { ...editData, lastEdited: { by: currentUser?.username, at: new Date().toISOString() } }, { merge: true });
      setShowEditModal(false); showToast("Agenda berhasil diubah");
    } catch (error) { console.error(error); }
  };

  const sortedEvents = useMemo(() => {
    let filteredEvents = events;
    if (filterSeksi !== 'Semua Seksi') filteredEvents = events.filter(event => event.ownerSeksi === filterSeksi);
    return [...filteredEvents].sort((a, b) => parseDateTime(a.dueDate, a.dueTime) - parseDateTime(b.dueDate, b.dueTime));
  }, [events, filterSeksi]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-indigo-600 sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-white">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><Calendar size={24} /></div>
            <div><h1 className="text-xl font-bold">Sistem Pengingat Jadwal</h1><p className="text-xs text-indigo-200">Kepatuhan Internal DJP</p></div>
          </div>
          {currentUser ? (
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex items-center bg-white/10 px-3 py-1.5 rounded-lg text-white text-xs font-bold mr-2"><Users size={14} className="mr-1.5"/>{viewCount} Views</div>
              {currentUser.role === 'superadmin' && (
                <>
                  <button onClick={() => setShowUserModal(true)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md">+ Akun</button>
                  <button onClick={() => setShowManageUserModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md flex items-center"><Settings size={14} className="mr-1"/></button>
                </>
              )}
              <button onClick={() => {setCurrentUser(null); showToast("Berhasil Logout");}} className="bg-white/10 text-white px-3 py-1.5 rounded-lg font-bold"><LogOut size={16}/></button>
            </div>
          ) : ( <button onClick={() => setShowLoginModal(true)} className="text-sm font-bold bg-white text-indigo-600 px-5 py-2 rounded-lg shadow-sm">Admin Login</button> )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><BellRing size={20} /></div>
            <h2 className="text-lg font-bold text-gray-800">Daftar Agenda</h2>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">{sortedEvents.length}</span>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {sortedEvents.length > 0 && (
              <button onClick={handleExportAll} className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-md font-bold text-sm transition-transform hover:scale-105"><FileText size={18} /> <span>Teks Rekap</span></button>
            )}
            <select value={filterSeksi} onChange={(e) => setFilterSeksi(e.target.value)} className="w-full sm:w-auto px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium">
              {DAFTAR_SEKSI.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? ( <div className="text-center py-10">Memuat...</div> ) : sortedEvents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-400 font-medium"><Calendar size={32} className="mx-auto mb-3 opacity-20"/>Belum ada agenda untuk seksi ini.</div>
        ) : (
          <div className="space-y-4">
            {sortedEvents.map((event) => {
              const status = getStatusInfo(event.dueDate, event.dueTime);
              let bgGradient = status.text === 'Hari Ini' ? "from-white to-red-50" : status.isUrgent ? "from-white to-orange-50" : "from-white to-green-50";
              let cardAccent = status.text === 'Hari Ini' ? "border-red-500" : status.isUrgent ? "border-orange-500" : "border-green-500";
              return (
                <div key={event.id} className={`bg-gradient-to-br ${bgGradient} rounded-xl shadow-md hover:shadow-xl border border-l-8 ${cardAccent} overflow-hidden transition-all duration-300 transform hover:-translate-y-1.5`}>
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm ${status.color}`}>{status.text}</span>
                          <span className="px-2 py-1 bg-white/80 text-gray-700 rounded-md text-xs font-bold border shadow-sm">Tim: {event.ownerSeksi}</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug drop-shadow-sm">{event.name}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-gray-700">
                          <div className="flex items-center bg-white/60 px-2.5 py-1 rounded-md shadow-sm border border-gray-100"><Clock size={15} className="mr-1.5 text-indigo-600"/>{event.dueDate.split('-').reverse().join('/')} • {event.dueTime} WIB</div>
                          {event.location && <div className="flex items-center bg-white/60 px-2.5 py-1 rounded-md shadow-sm border border-gray-100"><MapPin size={15} className="mr-1.5 text-red-500"/>{event.location}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2 items-start">
                        <button onClick={() => {setExportText(formatSingleEvent(event)); setShowExportModal(true);}} className="p-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-md"><FileText size={18}/></button>
                        {currentUser && (currentUser.role === 'superadmin' || currentUser.seksi === event.ownerSeksi) && (
                          <div className="flex gap-2">
                            <button onClick={() => {setEditData(event); setShowEditModal(true);}} className="p-2.5 bg-blue-500 text-white rounded-lg"><Edit2 size={16}/></button>
                            <button onClick={() => setEventToDelete(event.id)} className="p-2.5 bg-red-500 text-white rounded-lg"><Trash2 size={16}/></button>
                          </div>
                        )}
                      </div>
                    </div>
                    {event.description && (
                      <div className="mt-4 pt-3 border-t border-gray-200/60">
                        <p className={`text-sm text-gray-800 font-medium ${!expandedEvents.includes(event.id) && 'line-clamp-2'}`}>{event.description}</p>
                        <button onClick={() => setExpandedEvents(prev => prev.includes(event.id) ? prev.filter(e => e !== event.id) : [...prev, event.id])} className="text-xs font-bold text-indigo-600 mt-2 bg-white/60 px-2.5 py-1 rounded shadow-sm">{expandedEvents.includes(event.id) ? 'Tutup' : 'Selengkapnya'}</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {currentUser && <button onClick={() => setShowAddModal(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-40"><Plus size={28}/></button>}

      {/* --- MODAL MANAGE USER (PENTING!) --- */}
      {showManageUserModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-2 text-orange-600"><Settings size={24} /><h3 className="text-xl font-bold">Manajemen Akun Seksi</h3></div>
              <button onClick={() => setShowManageUserModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {allUsers.map((user) => (
                <div key={user.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 leading-none mb-1">{user.username}</p>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Seksi: {user.seksi}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {editUserPass.id === user.id ? (
                      <div className="flex gap-1 animate-in slide-in-from-right-2">
                        <input type="text" placeholder="Pass Baru" value={editUserPass.password} onChange={(e) => setEditUserPass({...editUserPass, password: e.target.value})} className="px-3 py-1.5 text-sm border rounded-lg w-28 focus:ring-2 focus:ring-blue-500" />
                        <button onClick={() => handleUpdatePassword(user.id)} className="p-2 bg-blue-500 text-white rounded-lg"><Copy size={16}/></button>
                        <button onClick={() => setEditUserPass({id: '', password: ''})} className="p-2 bg-gray-300 text-white rounded-lg"><X size={16}/></button>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white px-3 py-1.5 rounded-lg border text-xs font-mono text-gray-400">********</div>
                        <button onClick={() => setEditUserPass({id: user.id, password: ''})} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Ganti Password"><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteUser(user.id, user.username)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Hapus Akun"><Trash2 size={16}/></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t text-center text-xs text-gray-400 font-medium">Data akun tersimpan aman di sistem enkripsi Firebase</div>
          </div>
        </div>
      )}

      {/* --- MODAL EKSPOR --- */}
      {showExportModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Teks Pengingat</h3><button onClick={() => setShowExportModal(false)}><X size={24} /></button></div>
            <div className="bg-gray-50 border rounded-xl p-4 mb-5 max-h-80 overflow-y-auto"><pre className="whitespace-pre-wrap text-sm font-sans text-gray-700 leading-relaxed">{exportText}</pre></div>
            <div className="flex space-x-3">
              <button onClick={() => setShowExportModal(false)} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl">Tutup</button>
              <button onClick={() => {navigator.clipboard.writeText(exportText); showToast("Teks disalin!"); setShowExportModal(false);}} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2"><Copy size={18} /> Salin Teks</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL LOGIN, ADD, EDIT, DELETE (STANDAR) --- */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-5">Admin Login</h3>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl" autoFocus />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl" />
              {loginError && <p className="text-red-500 text-xs font-bold text-center">{loginError}</p>}
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md">Masuk</button>
              <button type="button" onClick={() => setShowLoginModal(false)} className="w-full text-gray-400 text-sm mt-2">Batal</button>
            </form>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4 text-center">Buat Akun Seksi Baru</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <select value={newUserForm.seksi} onChange={(e) => setNewUserForm({...newUserForm, seksi: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-semibold">
                {DAFTAR_SEKSI.filter(s => s !== 'Semua Seksi').map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" placeholder="Username Baru" value={newUserForm.username} onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value.toLowerCase()})} className="w-full p-3 bg-gray-50 border rounded-xl" required />
              <input type="text" placeholder="Password Baru" value={newUserForm.password} onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl" required />
              <button type="submit" className="w-full py-3 bg-green-500 text-white font-bold rounded-xl shadow-md">Simpan Akun</button>
              <button type="button" onClick={() => setShowUserModal(false)} className="w-full text-gray-500 mt-2">Batal</button>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-5">Tambah Agenda</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <input type="text" placeholder="Nama Agenda" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl" required />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl" required />
                <input type="time" value={formData.dueTime} onChange={(e) => setFormData({...formData, dueTime: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl" required />
              </div>
              <input type="text" placeholder="Lokasi (Opsional)" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl" />
              <textarea placeholder="Keterangan" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="3" className="w-full p-3 bg-gray-50 border rounded-xl resize-none"></textarea>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md">Simpan Agenda</button>
              <button type="button" onClick={() => setShowAddModal(false)} className="w-full text-gray-500 mt-2">Batal</button>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editData && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-center">Edit Agenda</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input type="text" value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" required />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={editData.dueDate} onChange={(e) => setEditData({...editData, dueDate: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl" required />
                <input type="time" value={editData.dueTime} onChange={(e) => setEditData({...editData, dueTime: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl" required />
              </div>
              <input type="text" value={editData.location} onChange={(e) => setEditData({...editData, location: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl" />
              <textarea value={editData.description} onChange={(e) => setEditData({...editData, description: e.target.value})} rows="3" className="w-full p-3 bg-gray-50 border rounded-xl resize-none"></textarea>
              <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md">Update</button>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-gray-500 block w-full mt-2">Batal</button>
            </form>
          </div>
        </div>
      )}

      {eventToDelete && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl border-t-8 border-red-500">
            <AlertCircle className="h-14 w-14 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">Hapus Agenda?</h3>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setEventToDelete(null)} className="flex-1 py-2.5 bg-gray-100 rounded-xl font-bold">Batal</button>
              <button onClick={handleDeleteConfirm} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl shadow-md">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 bg-gray-900 text-white rounded-full shadow-2xl font-bold text-sm animate-bounce">
          {toast.message}
        </div>
      )}
    </div>
  );
}
