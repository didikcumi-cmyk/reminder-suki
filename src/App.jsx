import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where, getDocs, increment, addDoc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, BellRing, Plus, Edit2, Trash2, X, AlertCircle, LogOut, Users, Share2, Copy } from 'lucide-react';

export default function App() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewCount, setViewCount] = useState(0);
  const [filterSeksi, setFilterSeksi] = useState('Semua Seksi');
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', seksi: 'Pelayanan' });

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

  useEffect(() => {
    const q = collection(db, 'events');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  // --- LOGIKA EKSPOR WHATSAPP ---
  const formatSingleEvent = (event) => {
    return `*AGENDA: ${event.name.toUpperCase()}*\n` +
           `📅 Tanggal: ${event.dueDate.split('-').reverse().join('/')}\n` +
           `⏰ Waktu: ${event.dueTime} WIB\n` +
           (event.location ? `📍 Lokasi: ${event.location}\n` : '') +
           (event.description ? `📝 Keterangan: ${event.description}\n` : '') +
           `_Seksi: ${event.ownerSeksi || 'Umum'}_`;
  };

  const exportToWA = (text) => {
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("Teks berhasil disalin ke clipboard!");
  };

  const exportAllToWA = () => {
    if (sortedEvents.length === 0) return;
    let headerText = `*REKAP AGENDA - ${filterSeksi.toUpperCase()}*\n_Update: ${new Date().toLocaleDateString('id-ID')}_\n\n`;
    let bodyText = sortedEvents.map((event, index) => `${index + 1}. ${formatSingleEvent(event)}`).join('\n\n---\n\n');
    exportToWA(headerText + bodyText);
  };
  // -----------------------------

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) { setLoginError('Isi username dan password.'); return; }
    try {
      const q = query(collection(db, "users"), where("username", "==", username), where("password", "==", password));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        setCurrentUser({ username: userData.username, role: userData.role, seksi: userData.seksi });
        setShowLoginModal(false); setUsername(''); setPassword(''); setLoginError('');
        showToast(`Selamat datang, Admin ${userData.seksi}`);
      } else { setLoginError('Username atau password salah.'); }
    } catch (error) { setLoginError('Terjadi kesalahan koneksi.'); }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    showToast("Berhasil logout");
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const q = query(collection(db, "users"), where("username", "==", newUserForm.username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) { alert('Username sudah dipakai!'); return; }
      await addDoc(collection(db, 'users'), {
        username: newUserForm.username, password: newUserForm.password,
        seksi: newUserForm.seksi, role: 'admin_seksi'
      });
      setShowUserModal(false); setNewUserForm({ username: '', password: '', seksi: 'Pelayanan' });
      showToast(`Akun ${newUserForm.seksi} berhasil dibuat!`);
    } catch (error) { alert('Terjadi kesalahan server.'); }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.dueDate || !formData.dueTime) return;
    if (events.length >= 200) { showToast("Kapasitas maksimal 200 event telah tercapai.", "error"); return; }
    const newId = Math.random().toString(36).substr(2, 9);
    const newEvent = { ...formData, id: newId, lastEdited: null, ownerSeksi: currentUser?.seksi || 'Umum' };
    try {
      await setDoc(doc(db, 'events', newId), newEvent);
      setShowAddModal(false); setFormData({ name: '', dueDate: '', dueTime: '', location: '', description: '' });
      showToast("Event berhasil ditambahkan");
    } catch (error) { console.error("Gagal tambah event", error); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editData.name || !editData.dueDate || !editData.dueTime) return;
    try {
      const editRef = doc(db, 'events', editData.id);
      await setDoc(editRef, { ...editData, lastEdited: { by: currentUser?.username || 'admin', at: new Date().toISOString() } }, { merge: true });
      setShowEditModal(false); showToast("Event berhasil diubah");
    } catch (error) { console.error("Gagal edit event", error); }
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    try {
      await deleteDoc(doc(db, 'events', eventToDelete));
      setEventToDelete(null); showToast("Event berhasil dihapus");
    } catch (error) { console.error("Gagal hapus event", error); }
  };

  const openEditModal = (evt) => { setEditData(evt); setShowEditModal(true); };

  const sortedEvents = useMemo(() => {
    let filteredEvents = events;
    if (filterSeksi !== 'Semua Seksi') {
      filteredEvents = events.filter(event => event.ownerSeksi === filterSeksi);
    }
    return [...filteredEvents].sort((a, b) => parseDateTime(a.dueDate, a.dueTime) - parseDateTime(b.dueDate, b.dueTime));
  }, [events, filterSeksi]);

  const toggleExpand = (id) => {
    setExpandedEvents(prev => prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-indigo-600 sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-white">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><Calendar size={24} /></div>
            <div>
              <h1 className="text-xl font-bold leading-tight tracking-tight">Sistem Pengingat Jadwal</h1>
              <p className="text-xs text-indigo-200 font-medium tracking-wide">Kepatuhan Internal DJP</p>
            </div>
          </div>
          {currentUser ? (
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex items-center bg-white/10 px-3 py-1.5 rounded-lg text-white text-sm font-medium mr-2">
                <Users size={16} className="mr-1.5"/><span>{viewCount} Views</span>
              </div>
              {currentUser.role === 'superadmin' && (
                <button onClick={() => setShowUserModal(true)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-md">
                  + Akun
                </button>
              )}
              <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm font-bold"><LogOut size={16}/></button>
            </div>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="text-sm font-bold bg-white text-indigo-600 px-5 py-2 rounded-lg">Admin Login</button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><BellRing size={20} /></div>
            <h2 className="text-lg font-bold">Daftar Agenda</h2>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">{sortedEvents.length}</span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {/* --- TOMBOL EKSPOR SEMUA --- */}
            {sortedEvents.length > 0 && (
              <button onClick={exportAllToWA} title="Share Semua ke WA" className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-sm transition-transform hover:scale-105">
                <Share2 size={18} />
              </button>
            )}
            <select value={filterSeksi} onChange={(e) => setFilterSeksi(e.target.value)} className="w-full sm:w-auto px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-medium">
              {DAFTAR_SEKSI.map(seksi => <option key={seksi} value={seksi}>{seksi}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-gray-500">Memuat data...</div>
        ) : sortedEvents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Calendar size={32} className="mx-auto mb-3 text-gray-400" />
            <p className="text-gray-500 font-medium">Belum ada agenda untuk seksi ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedEvents.map((event) => {
              const status = getStatusInfo(event.dueDate, event.dueTime);
              const isExpanded = expandedEvents.includes(event.id);
              let bgGradient = status.text === 'Hari Ini' ? "from-white to-red-50" : status.isUrgent ? "from-white to-orange-50" : "from-white to-green-50";
              let cardAccent = status.text === 'Hari Ini' ? "border-red-500" : status.isUrgent ? "border-orange-500" : "border-green-500";

              return (
                <div key={event.id} className={`bg-gradient-to-br ${bgGradient} rounded-xl shadow-md hover:shadow-xl border border-gray-100 border-l-8 ${cardAccent} overflow-hidden transition-all duration-300 transform hover:-translate-y-1`}>
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm ${status.color}`}>{status.text}</span>
                          <span className="px-2 py-1 bg-white/80 text-gray-700 rounded-md text-xs font-bold border shadow-sm">Pemilik: {event.ownerSeksi}</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{event.name}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
                          <div className="flex items-center bg-white/60 px-2.5 py-1 rounded-md shadow-sm"><Clock size={15} className="mr-1.5 text-indigo-600"/>{event.dueDate.split('-').reverse().join('/')} • {event.dueTime}</div>
                          {event.location && <div className="flex items-center bg-white/60 px-2.5 py-1 rounded-md shadow-sm"><MapPin size={15} className="mr-1.5 text-red-500"/>{event.location}</div>}
                        </div>
                      </div>

                      <div className="flex gap-2 items-start">
                        {/* --- TOMBOL EKSPOR PER EVENT --- */}
                        <button onClick={() => copyToClipboard(formatSingleEvent(event))} title="Copy Teks WA" className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-transform hover:scale-110 shadow-sm"><Copy size={18}/></button>
                        <button onClick={() => exportToWA(formatSingleEvent(event))} title="Share ke WA" className="p-2.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-transform hover:scale-110 shadow-sm"><Share2 size={18}/></button>
                        
                        {currentUser && (currentUser.role === 'superadmin' || currentUser.seksi === event.ownerSeksi) && (
                          <div className="flex gap-2">
                            <button onClick={() => openEditModal(event)} className="p-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 shadow-md"><Edit2 size={16}/></button>
                            <button onClick={() => setEventToDelete(event.id)} className="p-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-md"><Trash2 size={16}/></button>
                          </div>
                        )}
                      </div>
                    </div>
                    {event.description && (
                      <div className="mt-4 pt-3 border-t border-gray-200/60">
                        <p className={`text-sm text-gray-800 ${!isExpanded && 'line-clamp-2'}`}>{event.description}</p>
                        <button onClick={() => toggleExpand(event.id)} className="text-xs font-bold text-indigo-600 mt-2 bg-white/60 px-2 py-1 rounded shadow-sm">{isExpanded ? 'Tutup' : 'Selengkapnya'}</button>
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

      {/* --- MODAL LOGIN, ADD, EDIT, DELETE (SAMA SEPERTI SEBELUMNYA) --- */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-5">Login Admin</h3>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl" autoFocus />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl" />
              {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl">Masuk</button>
              <button type="button" onClick={() => setShowLoginModal(false)} className="w-full text-gray-500 text-sm">Batal</button>
            </form>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">Akun Baru</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <select value={newUserForm.seksi} onChange={(e) => setNewUserForm({...newUserForm, seksi: e.target.value})} className="w-full p-2.5 bg-gray-50 border rounded-xl">
                {DAFTAR_SEKSI.filter(s => s !== 'Semua Seksi').map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" placeholder="Username" value={newUserForm.username} onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value.toLowerCase()})} className="w-full p-2.5 bg-gray-50 border rounded-xl" required />
              <input type="text" placeholder="Password" value={newUserForm.password} onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})} className="w-full p-2.5 bg-gray-50 border rounded-xl" required />
              <button type="submit" className="w-full py-2.5 bg-green-500 text-white font-bold rounded-xl">Simpan</button>
              <button type="button" onClick={() => setShowUserModal(false)} className="w-full text-gray-500">Batal</button>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-5">Tambah Jadwal</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <input type="text" placeholder="Nama Agenda" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 bg-gray-50 border rounded-xl" required />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full p-2.5 bg-gray-50 border rounded-xl" required />
                <input type="time" value={formData.dueTime} onChange={(e) => setFormData({...formData, dueTime: e.target.value})} className="w-full p-2.5 bg-gray-50 border rounded-xl" required />
              </div>
              <input type="text" placeholder="Lokasi" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full p-2.5 bg-gray-50 border rounded-xl" />
              <textarea placeholder="Keterangan" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="3" className="w-full p-2.5 bg-gray-50 border rounded-xl"></textarea>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl">Simpan</button>
              <button type="button" onClick={() => setShowAddModal(false)} className="w-full text-gray-500">Batal</button>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editData && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Edit Jadwal</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input type="text" value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} className="w-full p-2.5 bg-gray-50 border rounded-xl" required />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={editData.dueDate} onChange={(e) => setEditData({...editData, dueDate: e.target.value})} className="w-full p-2.5 bg-gray-50 border rounded-xl" required />
                <input type="time" value={editData.dueTime} onChange={(e) => setEditData({...editData, dueTime: e.target.value})} className="w-full p-2.5 bg-gray-50 border rounded-xl" required />
              </div>
              <input type="text" value={editData.location} onChange={(e) => setEditData({...editData, location: e.target.value})} className="w-full p-2.5 bg-gray-50 border rounded-xl" />
              <textarea value={editData.description} onChange={(e) => setEditData({...editData, description: e.target.value})} rows="3" className="w-full p-2.5 bg-gray-50 border rounded-xl"></textarea>
              <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl">Update</button>
              <button type="button" onClick={() => setShowEditModal(false)} className="w-full text-gray-500">Batal</button>
            </form>
          </div>
        </div>
      )}

      {eventToDelete && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">Hapus Jadwal?</h3>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setEventToDelete(null)} className="flex-1 py-2.5 bg-gray-100 rounded-xl">Batal</button>
              <button onClick={handleDeleteConfirm} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 bg-gray-800 text-white rounded-full shadow-lg font-bold text-sm transition-all animate-bounce">
          {toast.message}
        </div>
      )}
    </div>
  );
}
