import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarClock, 
  Plus, 
  Share2, 
  LogOut, 
  Lock, 
  Trash2, 
  Copy, 
  AlertCircle,
  Clock,
  Users,
  ShieldCheck,
  Fingerprint,
  Wallet,
  Building2,
  CalendarDays,
  BellRing,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
  Edit2,
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

// --- KONFIGURASI FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// GANTI BAGIAN DI BAWAH INI DENGAN KODE FIREBASECONFIG MILIK ANDA
const firebaseConfig = {
  apiKey: "AIzaSyDvSAiFoTeWOLwhkSXwJgl-vJASfs3UfQw",
  authDomain: "remindersuki-095.firebaseapp.com",
  projectId: "remindersuki-095",
  storageBucket: "remindersuki-095.firebasestorage.app",
  messagingSenderId: "277543932067",
  appId: "1:277543932067:web:170ed9b5cea8c55cd22f16",
  measurementId: "G-0PHDJF2VDL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// ----------------------------

const CATEGORIES = [
  "Kepegawaian",
  "UKI",
  "Presensi",
  "Keuangan",
  "BMN dan Sarpras",
  "Lain-lain"
];

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export default function App() {
  const [fbUser, setFbUser] = useState(null); 
  const [events, setEvents] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null); 
  const [expandedEvents, setExpandedEvents] = useState([]);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [formData, setFormData] = useState({
    id: '', name: '', category: CATEGORIES[0], dueDate: '', dueTime: '', description: ''
  });

  const [toastMessage, setToastMessage] = useState({ text: '', type: '' });
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (toastMessage.text) {
      const timer = setTimeout(() => {
        setToastMessage({ text: '', type: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Auth Firebase
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Autentikasi cloud gagal:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  // Sync Data Firebase
  useEffect(() => {
    if (!fbUser) return;
    
    const eventsRef = collection(db, 'events');
    const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
      const fetchedEvents = [];
      snapshot.forEach(doc => {
        fetchedEvents.push({ id: doc.id, ...doc.data() });
      });
      setEvents(fetchedEvents);
      setIsLoading(false);
    }, (error) => {
      console.error("Gagal sinkronisasi data:", error);
      setIsLoading(false);
      showToast("Gagal menarik data dari server", "error");
    });
    
    return () => unsubscribe();
  }, [fbUser]);


  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'SUKIMadselada' && password === 'SUKIMadselada') {
      setIsAuthenticated(true);
      setShowLoginModal(false);
      setUsername('');
      setPassword('');
      setLoginError('');
      showToast("Berhasil login sebagai Admin");
    } else {
      setLoginError('Username atau password salah.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    showToast("Berhasil logout");
  };

  const openAddModal = () => {
    setFormData({ id: '', name: '', category: CATEGORIES[0], dueDate: '', dueTime: '', description: '' });
    setShowAddModal(true);
  };

  const openEditModal = (event) => {
    setFormData({ ...event });
    setShowEditModal(true);
  };

  const requestDelete = (event) => {
    setEventToDelete(event);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.dueDate || !formData.dueTime) return;
    
    if (events.length >= 50) {
      showToast("Kapasitas maksimal 50 event telah tercapai.", "error");
      return;
    }

    const newId = Math.random().toString(36).substr(2, 9);
    const newEvent = { ...formData, id: newId, lastEdited: null };
    
    try {
      await setDoc(doc(db, 'events', newId), newEvent);
      setShowAddModal(false);
      showToast("Event berhasil ditambahkan ke Server");
    } catch (error) {
      console.error("Gagal tambah event:", error);
      showToast("Gagal menyimpan ke server", "error");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.dueDate || !formData.dueTime) return;

    const updatedEvent = { ...formData, lastEdited: new Date().toISOString() };
    
    try {
      await setDoc(doc(db, 'events', formData.id), updatedEvent);
      setShowEditModal(false);
      showToast("Event berhasil diperbarui di Server");
    } catch (error) {
      console.error("Gagal update event:", error);
      showToast("Gagal memperbarui ke server", "error");
    }
  };

  const confirmDelete = async () => {
    if (eventToDelete) {
      try {
        await deleteDoc(doc(db, 'events', eventToDelete.id));
        setEventToDelete(null);
        showToast("Event berhasil dihapus dari Server", "success");
      } catch (error) {
        console.error("Gagal hapus event:", error);
        showToast("Gagal menghapus dari server", "error");
      }
    }
  };

  const toggleExpand = (id) => {
    setExpandedEvents(prev => 
      prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]
    );
  };

  const parseDateTime = (dateStr, timeStr) => {
    return new Date(`${dateStr}T${timeStr}`);
  };

  const calculateCountdown = (targetDate) => {
    const diff = targetDate - now;
    if (diff <= 0) return { expired: true, text: "Jatuh Tempo" };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);

    let text = "";
    if (days > 0) text += `${days} Hari `;
    if (hours > 0) text += `${hours} Jam `;
    text += `${minutes} Menit`;
    
    return { expired: false, text };
  };

  const formatDateId = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    return `${parseInt(day, 10)} ${MONTHS[parseInt(month, 10) - 1]} ${year}`;
  };

  const formatDateTimeFull = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    const day = d.getDate();
    const month = MONTHS[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} jam ${hours}.${minutes}`;
  };

  const getCategoryIcon = (cat) => {
    switch(cat) {
      case 'Kepegawaian': return <Users size={14} className="mr-1.5" />;
      case 'UKI': return <ShieldCheck size={14} className="mr-1.5" />;
      case 'Presensi': return <Fingerprint size={14} className="mr-1.5" />;
      case 'Keuangan': return <Wallet size={14} className="mr-1.5" />;
      case 'BMN dan Sarpras': return <Building2 size={14} className="mr-1.5" />;
      case 'Lain-lain': return <Layers size={14} className="mr-1.5" />;
      default: return <CalendarDays size={14} className="mr-1.5" />;
    }
  };

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      return parseDateTime(a.dueDate, a.dueTime) - parseDateTime(b.dueDate, b.dueTime);
    });
  }, [events]);

  const generateGlobalWaText = () => {
    let text = "Reminder SUKI:\n";
    sortedEvents.forEach((ev, idx) => {
      const timeStr = ev.dueTime.replace(':', '.');
      text += `${idx + 1}. ${ev.name} (${ev.category}): paling lambat *${formatDateId(ev.dueDate)} jam ${timeStr}*\n`;
      if (ev.lastEdited) {
        text += `   _(Diedit terakhir pada: ${formatDateTimeFull(ev.lastEdited)})_\n`;
      }
    });
    
    text += "\nUntuk informasi dan tatacara selengkapnya dapat dilihat pada tautan: s.kemenkeu.go.id/ReminderSUKI\n";
    text += "Terima kasih atas perhatiannya...\n\n";
    text += "Tim SUKI";
    return text;
  };

  const generateSingleEventWaText = (ev) => {
    let text = `*REMINDER: ${ev.name}*\n\n`;
    text += `Kategori: ${ev.category}\n`;
    text += `Jatuh Tempo: *${formatDateId(ev.dueDate)} jam ${ev.dueTime.replace(':', '.')}*\n\n`;
    
    if (ev.description && ev.description.trim() !== '') {
      text += `*Informasi / Tata Cara:*\n${ev.description}\n\n`;
    }
    
    if (ev.lastEdited) {
      text += `_(Diedit terakhir pada: ${formatDateTimeFull(ev.lastEdited)})_\n\n`;
    }

    text += `Untuk informasi dan tatacara selengkapnya dapat dilihat pada tautan: s.kemenkeu.go.id/ReminderSUKI\n`;
    text += `Terima kasih atas perhatiannya...\n\n`;
    text += `Tim SUKI`;
    return text;
  };

  const copyToClipboard = (textToCopy, successMsg) => {
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg || "Teks berhasil disalin!", "success");
    } catch (err) {
      console.error('Gagal menyalin teks', err);
      showToast("Gagal menyalin teks", "error");
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-sans text-gray-800 pb-16 relative">
      
      {toastMessage.text && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-top-5 fade-in duration-300">
          <div className={`flex items-center px-4 py-3 rounded-xl shadow-xl border ${
            toastMessage.type === 'error' ? 'bg-white border-red-500 text-red-700' : 'bg-white border-green-500 text-green-700'
          }`}>
            {toastMessage.type === 'error' ? (
              <AlertCircle size={18} className="mr-2 flex-shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="mr-2 flex-shrink-0" />
            )}
            <span className="font-semibold text-sm">{toastMessage.text}</span>
          </div>
        </div>
      )}

      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:py-5 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-yellow-300 to-yellow-500 text-blue-900 p-2.5 rounded-xl shadow-sm transform transition hover:scale-105">
              <CalendarClock size={28} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-extrabold tracking-tight drop-shadow-sm">Reminder SUKI</h1>
              <p className="text-blue-100 text-xs md:text-sm font-medium opacity-90">Sistem Pengingat Jadwal SUKI Terpadu</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <button 
                onClick={handleLogout}
                className="flex items-center text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm px-4 py-2.5 rounded-xl transition-all duration-200"
              >
                <LogOut size={18} className="mr-2" />
                <span className="hidden md:inline">Logout Admin</span>
              </button>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)}
                className="flex items-center text-sm font-semibold bg-yellow-400 hover:bg-yellow-500 text-blue-900 shadow-md hover:shadow-lg px-4 py-2.5 rounded-xl transition-all duration-200 transform hover:-translate-y-0.5"
              >
                <Lock size={18} className="mr-2" />
                <span className="hidden md:inline">Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl sm:text-2xl font-bold text-blue-950 flex items-center">
              <BellRing className="mr-2 text-yellow-500" size={24} />
              Daftar Agenda
            </h2>
            <span className="bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
              {events.length} / 50 Event
            </span>
          </div>
          
          {isAuthenticated && (
            <div className="flex w-full sm:w-auto space-x-3">
              <button 
                onClick={() => setShowExportModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-blue-700 border border-blue-200 font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md"
              >
                <Share2 size={18} />
                <span>Export Semua WA</span>
              </button>
              <button 
                onClick={openAddModal}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <Plus size={18} />
                <span>Tambah Event</span>
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-blue-100">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-blue-900 font-medium">Menyinkronkan data dari server...</p>
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-dashed border-blue-200 flex flex-col items-center justify-center">
            <div className="bg-blue-50 p-6 rounded-full mb-4">
              <CalendarClock size={56} className="text-blue-300" />
            </div>
            <h3 className="text-xl font-bold text-blue-900">Belum Ada Agenda Aktif</h3>
            <p className="text-gray-500 mt-2 max-w-sm">
              {isAuthenticated 
                ? "Silakan klik tombol 'Tambah Event' di atas untuk membuat jadwal pengingat baru." 
                : "Login sebagai admin untuk mulai menambahkan jadwal pengingat."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {sortedEvents.map(event => {
              const targetDate = parseDateTime(event.dueDate, event.dueTime);
              const countdown = calculateCountdown(targetDate);
              
              const diff = targetDate - now;
              const daysLeft = diff / (1000 * 60 * 60 * 24);
              
              const isCritical = diff > 0 && daysLeft <= 1; 
              const isWarning = daysLeft > 1 && daysLeft <= 3; 

              const isExpanded = expandedEvents.includes(event.id);
              
              return (
                <div 
                  key={event.id} 
                  className={`rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-t-4 flex flex-col overflow-hidden group ${
                    countdown.expired ? 'border-red-600 bg-red-50/50 opacity-80' : 
                    isCritical ? 'border-red-400 bg-red-50' : 
                    isWarning ? 'border-yellow-400 bg-yellow-50' : 
                    'border-blue-500 bg-white'
                  }`}
                >
                  <div className="p-5 md:p-6 flex-grow">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`inline-flex items-center text-xs px-3 py-1.5 rounded-lg font-semibold border ${
                        isCritical ? 'bg-white/80 text-red-700 border-red-200' :
                        isWarning ? 'bg-white/80 text-yellow-800 border-yellow-200' :
                        'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {getCategoryIcon(event.category)}
                        {event.category}
                      </span>
                      {isAuthenticated && (
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditModal(event)}
                            className="text-gray-400 hover:text-blue-600 hover:bg-white/60 p-2 rounded-lg transition-colors"
                            title="Edit Event"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => requestDelete(event)}
                            className="text-gray-400 hover:text-red-600 hover:bg-white/60 p-2 rounded-lg transition-colors"
                            title="Hapus Event"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-gray-800 leading-snug mb-1">
                      {event.name}
                    </h3>
                    {event.lastEdited && (
                      <p className="text-[10px] text-gray-500 mt-1 italic">
                        Diedit: {formatDateTimeFull(event.lastEdited)}
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-black/5 px-5 py-4 border-t border-black/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center text-sm font-medium text-gray-600">
                        <CalendarClock size={16} className={`mr-2 ${
                          isCritical ? 'text-red-500' : isWarning ? 'text-yellow-600' : 'text-blue-500'
                        }`} />
                        <span>{formatDateId(event.dueDate)}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-700 bg-white/80 px-2 py-1 rounded shadow-sm">
                        {event.dueTime.replace(':', '.')} WIB
                      </span>
                    </div>
                    
                    <div className={`flex items-center text-sm font-bold mt-3 px-3 py-2 rounded-lg ${
                      countdown.expired ? 'bg-red-100 text-red-700' : 
                      isCritical ? 'bg-red-100 text-red-700' : 
                      isWarning ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-50 text-blue-700'
                    }`}>
                      <Clock size={16} className="mr-2" />
                      {countdown.expired ? "SUDAH JATUH TEMPO" : `Sisa: ${countdown.text}`}
                    </div>

                    <button 
                      onClick={() => toggleExpand(event.id)}
                      className="w-full mt-3 flex items-center justify-center text-sm text-gray-600 hover:text-gray-900 transition-colors py-1 font-medium"
                    >
                      {isExpanded ? (
                         <><ChevronUp size={16} className="mr-1"/> Tutup Detail</>
                      ) : (
                         <><ChevronDown size={16} className="mr-1"/> Selengkapnya</>
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="bg-white/60 p-5 border-t border-black/5 text-sm animate-in slide-in-from-top-2 fade-in duration-200">
                      <div className="mb-3">
                        <h4 className="font-bold text-gray-800 flex items-center mb-1">
                          <Info size={14} className="mr-1.5" />
                          Informasi / Tata Cara
                        </h4>
                        <div className="text-gray-700 whitespace-pre-wrap bg-white/80 p-3 rounded-lg border border-black/5 shadow-inner">
                          {event.description ? event.description : <span className="text-gray-500 italic">Tidak ada informasi tambahan.</span>}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => copyToClipboard(generateSingleEventWaText(event), "Info event ini berhasil disalin!")}
                        className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-blue-600 font-semibold py-2 rounded-lg transition-colors mt-2 shadow-sm"
                      >
                        <Share2 size={14} className="mr-2" />
                        Export Info Event Ini
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {eventToDelete && (
        <div className="fixed inset-0 bg-blue-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl text-center transform transition-all">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-600" size={28} />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">Hapus Event?</h2>
            <p className="text-sm text-gray-500 mb-6">
              Anda yakin ingin menghapus <strong>"{eventToDelete.name}"</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setEventToDelete(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-md"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoginModal && (
        <div className="fixed inset-0 bg-blue-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl transform transition-all">
            <div className="text-center mb-6">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="text-blue-600" size={28} />
              </div>
              <h2 className="text-2xl font-extrabold text-blue-950">Akses Admin</h2>
              <p className="text-sm text-gray-500 mt-1">Silakan login untuk mengelola event</p>
            </div>
            
            {loginError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl mb-5 flex items-center">
                <AlertCircle size={16} className="mr-2 flex-shrink-0" /> 
                <span>{loginError}</span>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Masukkan username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Masukkan password"
                  required
                />
              </div>
              <div className="pt-2 flex space-x-3">
                <button 
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-blue-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-extrabold text-blue-950 flex items-center">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <Plus className="text-blue-600" size={20} />
                </div>
                Tambah Event Baru
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors">✕</button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nama Event / Agenda</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Contoh: Penilaian perilaku..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kategori Bidang</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tanggal Paling Lambat</label>
                  <input 
                    type="date" 
                    value={formData.dueDate}
                    onChange={e => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Jam (WIB)</label>
                  <input 
                    type="time" 
                    value={formData.dueTime}
                    onChange={e => setFormData({...formData, dueTime: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Informasi / Tata Cara Khusus <span className="font-normal text-gray-400">(Opsional)</span>
                </label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all h-24 resize-none"
                  placeholder="Masukkan informasi tambahan, link, atau tata cara penyelesaian event ini..."
                />
              </div>
              <div className="pt-2 flex space-x-3">
                 <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-blue-950 font-extrabold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  Simpan Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-blue-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-extrabold text-blue-950 flex items-center">
                <div className="bg-yellow-100 p-2 rounded-lg mr-3">
                  <Edit2 className="text-yellow-600" size={20} />
                </div>
                Edit Event
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors">✕</button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nama Event / Agenda</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Contoh: Penilaian perilaku..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kategori Bidang</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tanggal Paling Lambat</label>
                  <input 
                    type="date" 
                    value={formData.dueDate}
                    onChange={e => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Jam (WIB)</label>
                  <input 
                    type="time" 
                    value={formData.dueTime}
                    onChange={e => setFormData({...formData, dueTime: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Informasi / Tata Cara Khusus <span className="font-normal text-gray-400">(Opsional)</span>
                </label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all h-24 resize-none"
                  placeholder="Masukkan informasi tambahan, link, atau tata cara penyelesaian event ini..."
                />
              </div>
              <div className="pt-2 flex space-x-3">
                 <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-blue-950 font-extrabold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  Update Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-blue-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-extrabold text-blue-950 flex items-center">
                <div className="bg-green-100 p-2 rounded-lg mr-3">
                  <Share2 className="text-green-600" size={20} />
                </div>
                Export WA Siap Kirim
              </h2>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors">✕</button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded-xl flex items-start">
              <AlertCircle size={18} className="text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
              <span>Daftar lengkap ini sudah diurutkan dari yang paling mendesak. Info edit terakhir akan muncul jika ada.</span>
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-5 relative group max-h-64 overflow-y-auto">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                {generateGlobalWaText()}
              </pre>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => copyToClipboard(generateGlobalWaText(), "Semua teks event berhasil disalin!")}
                className="flex-1 flex items-center justify-center bg-white border-2 border-blue-600 text-blue-700 hover:bg-blue-50 font-bold py-3 rounded-xl transition-all"
              >
                <Copy size={18} className="mr-2" />
                Salin Teks
              </button>
              <a 
                href={`https://wa.me/?text=${encodeURIComponent(generateGlobalWaText())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <ExternalLink size={18} className="mr-2" />
                Buka WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}