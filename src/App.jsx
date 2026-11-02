import React, { useState, useMemo, useEffect } from 'react';
import { 
  Compass, 
  Clock, 
  Calendar, 
  Users, 
  Plus, 
  Trash2, 
  Globe, 
  Zap,
  ChevronRight,
  Footprints,
  Eye,
  Radio,
  Volume2,
  Cloud,
  Check,
  RefreshCw
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';

// Reads custom Firebase Config strictly from environment variables
const getFirebaseConfig = () => {
  try {
    if (typeof window !== 'undefined' && window.__firebase_config) {
      return typeof window.__firebase_config === 'string' 
        ? JSON.parse(window.__firebase_config) 
        : window.__firebase_config;
    }
  } catch (e) {
    console.warn("Using env variables for firebase config");
  }

  return {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || ""
  };
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = (typeof window !== 'undefined' && window.__app_id) ? window.__app_id : 'big-walk-sync-app';

// Preset Squad Members for BIG WALK inspired by character colors in screenshots
const SQUAD_MEMBERS = [
  { id: 'walker_1', name: 'John', avatar: '👀', border: 'border-sky-500', bg: 'bg-sky-500/20', tagColor: 'text-sky-400' },
  { id: 'walker_2', name: 'Scott', avatar: '📢', border: 'border-amber-400', bg: 'bg-amber-400/20', tagColor: 'text-amber-400' },
  { id: 'walker_3', name: 'Doug', avatar: '📻', border: 'border-rose-500', bg: 'bg-rose-500/20', tagColor: 'text-rose-400' }
];

// Common Timezones
const TIMEZONES = [
  { label: 'Eastern Time (EST/EDT)', value: 'America/New_York' },
  { label: 'Central Time (CST/CDT)', value: 'America/Chicago' },
  { label: 'Mountain Time (MST/MDT)', value: 'America/Denver' },
  { label: 'Pacific Time (PST/PDT)', value: 'America/Los_Angeles' },
  { label: 'UTC / GMT', value: 'UTC' },
  { label: 'Central European (CET)', value: 'Europe/Paris' },
  { label: 'Japan Standard Time (JST)', value: 'Asia/Tokyo' }
];

// Format date nicely (YYYY-MM-DD)
const getTodayStr = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

// Initial Sample Availabilities (Timestamps stored in UTC ISO format)
const today = getTodayStr(0);
const tomorrow = getTodayStr(1);

const generateUtcISO = (dateStr, hour) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const actualDay = day + Math.floor(hour / 24);
  const actualHour = hour % 24;
  const date = new Date(Date.UTC(year, month - 1, actualDay, actualHour, 0, 0));
  return date.toISOString();
};

const INITIAL_SCHEDULES = {
  walker_1: [
    { id: 'w1_1', startDate: today, startTime: '20:00', endDate: today, endTime: '23:00', startISO: generateUtcISO(today, 20), endISO: generateUtcISO(today, 23) },
    { id: 'w1_2', startDate: tomorrow, startTime: '19:00', endDate: tomorrow, endTime: '22:00', startISO: generateUtcISO(tomorrow, 19), endISO: generateUtcISO(tomorrow, 22) }
  ],
  walker_2: [
    { id: 'w2_1', startDate: today, startTime: '20:30', endDate: today, endTime: '23:30', startISO: generateUtcISO(today, 20.5), endISO: generateUtcISO(today, 23.5) },
    { id: 'w2_2', startDate: tomorrow, startTime: '18:00', endDate: tomorrow, endTime: '23:00', startISO: generateUtcISO(tomorrow, 18), endISO: generateUtcISO(tomorrow, 23) }
  ],
  walker_3: [
    { id: 'w3_1', startDate: today, startTime: '19:00', endDate: today, endTime: '22:00', startISO: generateUtcISO(today, 19), endISO: generateUtcISO(today, 22) },
    { id: 'w3_2', startDate: tomorrow, startTime: '20:00', endDate: tomorrow, endTime: '22:00', startISO: generateUtcISO(tomorrow, 20), endISO: generateUtcISO(tomorrow, 22) }
  ]
};

export default function App() {
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState('walker_1');
  const [userTimezone, setUserTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York');
  const [schedules, setSchedules] = useState(INITIAL_SCHEDULES);
  const [isSyncing, setIsSyncing] = useState(true);

  // New Slot Form State (No title/note field)
  const [newDate, setNewDate] = useState(getTodayStr(0));
  const [newStartTime, setNewStartTime] = useState('20:00');
  const [newEndTime, setNewEndTime] = useState('23:00');
  const [formError, setFormError] = useState('');

  // 1. Authenticated Session Effect (Enforcing Auth for Production Rules)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const customToken = typeof window !== 'undefined' ? window.__initial_auth_token : undefined;
        if (customToken) {
          await signInWithCustomToken(auth, customToken);
        } else {
          // Anonymous authentication creates a unique UID per user/device
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore Sync Effect
  useEffect(() => {
    if (!user) return;

    setIsSyncing(true);
    const slotsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'schedules');

    const unsubscribe = onSnapshot(slotsCollection, (snapshot) => {
      const updatedSchedules = {
        walker_1: [],
        walker_2: [],
        walker_3: []
      };

      if (!snapshot.empty) {
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.userId && updatedSchedules[data.userId]) {
            updatedSchedules[data.userId].push({
              id: docSnap.id,
              ...data
            });
          }
        });
        setSchedules(updatedSchedules);
      }
      setIsSyncing(false);
    }, (error) => {
      console.error("Firestore snapshot error:", error);
      setIsSyncing(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Convert inputs to UTC ISO string
  const createISOFromLocal = (dateStr, timeStr) => {
    try {
      const dateTimeStr = `${dateStr}T${timeStr}:00`;
      const localDate = new Date(dateTimeStr);
      return localDate.toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  };

  // Add new slot for current active user (persisted to cloud)
  const handleAddSlot = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!newDate || !newStartTime || !newEndTime) {
      setFormError('Please select date, start time, and end time.');
      return;
    }

    const startISO = createISOFromLocal(newDate, newStartTime);
    let endISO = createISOFromLocal(newDate, newEndTime);

    if (new Date(endISO) <= new Date(startISO)) {
      const nextDay = new Date(newDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      endISO = createISOFromLocal(nextDayStr, newEndTime);
    }

    const slotId = `${currentUser}-${Date.now()}`;
    const newSlot = {
      userId: currentUser,
      startDate: newDate,
      startTime: newStartTime,
      endDate: newDate,
      endTime: newEndTime,
      startISO,
      endISO,
      createdAt: new Date().toISOString()
    };

    // Optimistic UI update
    setSchedules(prev => ({
      ...prev,
      [currentUser]: [...(prev[currentUser] || []), { id: slotId, ...newSlot }]
    }));

    // Save to Firestore
    if (user) {
      try {
        const slotRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedules', slotId);
        await setDoc(slotRef, newSlot);
      } catch (err) {
        console.error("Failed to save slot to cloud:", err);
      }
    }
  };

  // Remove slot (persisted to cloud)
  const handleDeleteSlot = async (userId, slotId) => {
    // Optimistic UI update
    setSchedules(prev => ({
      ...prev,
      [userId]: prev[userId].filter(slot => slot.id !== slotId)
    }));

    // Remove from Firestore
    if (user) {
      try {
        const slotRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedules', slotId);
        await deleteDoc(slotRef);
      } catch (err) {
        console.error("Failed to delete slot from cloud:", err);
      }
    }
  };

  // Format ISO timestamp in user's selected timezone
  const formatInUserTZ = (isoString) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(d);
    } catch (e) {
      return isoString;
    }
  };

  // Calculate overlaps across all players
  const overlaps = useMemo(() => {
    const allSlots = [];
    Object.keys(schedules).forEach(userId => {
      (schedules[userId] || []).forEach(slot => {
        allSlots.push({
          userId,
          start: new Date(slot.startISO).getTime(),
          end: new Date(slot.endISO).getTime()
        });
      });
    });

    if (allSlots.length === 0) return [];

    const timePoints = new Set();
    allSlots.forEach(s => {
      timePoints.add(s.start);
      timePoints.add(s.end);
    });
    const sortedPoints = Array.from(timePoints).sort((a, b) => a - b);

    const intervals = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const windowStart = sortedPoints[i];
      const windowEnd = sortedPoints[i + 1];

      if (windowEnd - windowStart < 15 * 60 * 1000) continue;

      const availableUsers = new Set();
      allSlots.forEach(s => {
        if (s.start <= windowStart && s.end >= windowEnd) {
          availableUsers.add(s.userId);
        }
      });

      if (availableUsers.size >= 2) {
        intervals.push({
          startISO: new Date(windowStart).toISOString(),
          endISO: new Date(windowEnd).toISOString(),
          users: Array.from(availableUsers),
          count: availableUsers.size,
          isFullSquad: availableUsers.size === SQUAD_MEMBERS.length
        });
      }
    }

    const merged = [];
    intervals.forEach(curr => {
      if (merged.length === 0) {
        merged.push(curr);
      } else {
        const last = merged[merged.length - 1];
        const sameUsers = last.users.length === curr.users.length && 
                          last.users.every(u => curr.users.includes(u));

        if (last.endISO === curr.startISO && sameUsers) {
          last.endISO = curr.endISO;
        } else {
          merged.push(curr);
        }
      }
    });

    return merged.sort((a, b) => new Date(a.startISO) - new Date(b.startISO));
  }, [schedules]);

  const activeUserObj = SQUAD_MEMBERS.find(m => m.id === currentUser);

  return (
    <div className="min-h-screen bg-[#1c221a] text-stone-100 font-sans pb-16 selection:bg-[#bef264] selection:text-stone-900">
      
      {/* HEADER BAR WITH BIG WALK LIME ACCENTS */}
      <header className="border-b border-[#364332] bg-[#222b20]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#bef264] rounded-2xl shadow-lg shadow-[#bef264]/10 border border-[#d9f99d]">
              <Footprints className="w-7 h-7 text-stone-900" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-wide text-white flex items-center gap-2 font-mono">
                BIG WALK SYNC 
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#bef264] text-stone-950 font-bold uppercase tracking-wider">
                  3 Walkers
                </span>
              </h1>
              <p className="text-xs text-stone-400 flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-lime-400" /> Walkie-Talkie Squad Availability
                {isSyncing ? (
                  <span className="flex items-center gap-1 text-[#bef264] text-[11px] font-bold">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                    <Cloud className="w-3.5 h-3.5" /> <Check className="w-3 h-3 -ml-1" /> Auto-Saved
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* TIMEZONE SELECTOR */}
          <div className="flex items-center gap-2 bg-[#171d16] px-3.5 py-2 rounded-2xl border border-[#384634]">
            <Globe className="w-4 h-4 text-lime-400 shrink-0" />
            <span className="text-xs font-semibold text-stone-300 shrink-0">Your Timezone:</span>
            <select 
              value={userTimezone} 
              onChange={(e) => setUserTimezone(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#bef264] focus:outline-none cursor-pointer pr-2"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value} className="bg-[#1c221a] text-stone-200">
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-8">

        {/* TOP HERO BANNER / FULL TRIO OVERLAPS HIGHLIGHT */}
        <section className="relative overflow-hidden rounded-3xl bg-[#252f23] border-2 border-[#bef264]/40 p-6 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[#bef264]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Compass className="w-6 h-6 text-[#bef264]" />
              <h2 className="text-lg font-extrabold text-white tracking-wide uppercase font-mono">
                WALK SWEET SPOTS (OVERLAPS)
              </h2>
            </div>
            <span className="text-xs font-bold text-stone-300 bg-[#192017] px-3.5 py-1.5 rounded-full border border-[#384734] flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-lime-400" />
              {overlaps.filter(o => o.isFullSquad).length} Trio Walks Ready
            </span>
          </div>

          {overlaps.length === 0 ? (
            <div className="text-center py-8 bg-[#1a2118]/80 rounded-2xl border border-dashed border-[#384734]">
              <Footprints className="w-10 h-10 text-stone-600 mx-auto mb-2" />
              <p className="text-stone-300 font-bold">No overlapping walk times yet.</p>
              <p className="text-xs text-stone-400 mt-1">Select your walker perspective below and add free hours!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overlaps.map((overlap, idx) => (
                <div 
                  key={idx}
                  className={`relative p-5 rounded-2xl border transition-all duration-300 ${
                    overlap.isFullSquad 
                      ? 'bg-[#1e2a1b] border-[#bef264] shadow-lg ring-2 ring-[#bef264]/30' 
                      : 'bg-[#1a2118] border-[#384734]'
                  }`}
                >
                  {overlap.isFullSquad && (
                    <div className="absolute -top-3 left-4 bg-[#bef264] text-stone-950 font-black text-[10px] px-3 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-md">
                      <Footprints className="w-3 h-3 text-stone-950" /> FULL TRIO READY!
                    </div>
                  )}

                  <div className="flex items-start justify-between mt-1 mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#bef264]">
                      <Clock className="w-4 h-4" />
                      <span>{formatInUserTZ(overlap.startISO)}</span>
                    </div>
                  </div>

                  <div className="text-xs text-stone-400 mb-4 flex items-center gap-1 font-medium">
                    <span className="text-stone-500">Until:</span> 
                    <span className="text-stone-200 font-semibold">{formatInUserTZ(overlap.endISO)}</span>
                  </div>

                  {/* Avatars of attending members */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#313f2f]">
                    <div className="flex items-center gap-1.5">
                      {overlap.users.map(uId => {
                        const member = SQUAD_MEMBERS.find(m => m.id === uId);
                        return (
                          <span 
                            key={uId} 
                            title={member?.name}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${member?.border} ${member?.bg} shadow-md`}
                          >
                            {member?.avatar}
                          </span>
                        );
                      })}
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                      overlap.isFullSquad ? 'bg-[#bef264] text-stone-950' : 'bg-stone-800 text-stone-300 border border-stone-700'
                    }`}>
                      {overlap.count} / 3 Ready
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ACTIVE USER VIEW SWITCHER BAR */}
        <section className="bg-[#222b20] p-5 rounded-3xl border border-[#364332] shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2 tracking-wide font-mono uppercase">
                <Users className="w-4 h-4 text-lime-400" />
                SELECT YOUR WALKER
              </h3>
              <p className="text-xs text-stone-400">Switch views to edit free hours for each of the 3 players.</p>
            </div>
            <div className="flex items-center gap-1.5 bg-[#161d15] px-3 py-1.5 rounded-xl border border-[#364332]">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] text-stone-400">Editing as: <strong className="text-white font-bold">{activeUserObj?.name}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SQUAD_MEMBERS.map(member => {
              const isActive = member.id === currentUser;
              const slotCount = (schedules[member.id] || []).length;

              return (
                <button
                  key={member.id}
                  onClick={() => setCurrentUser(member.id)}
                  className={`relative p-4 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3.5 ${
                    isActive 
                      ? `bg-[#182117] border-[#bef264] shadow-md ring-2 ring-[#bef264]/40` 
                      : 'bg-[#171e16] border-[#2e3b2b] hover:border-stone-600 hover:bg-[#1f281d]'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl bg-[#242e22] border-2 ${member.border} shadow-inner`}>
                    {member.avatar}
                  </div>
                  <div className="overflow-hidden">
                    <p className={`text-xs font-extrabold truncate ${isActive ? 'text-white' : 'text-stone-300'}`}>
                      {member.name}
                    </p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {slotCount} {slotCount === 1 ? 'time slot' : 'time slots'} set
                    </p>
                  </div>
                  {isActive && (
                    <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#bef264] animate-ping" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* TWO COLUMN LAYOUT: INPUT FORM & SQUAD LISTING */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT: ADD AVAILABILITY FORM (No Title/Note field & No Presets) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#222b20] p-6 rounded-3xl border border-[#364332] shadow-xl space-y-5">
              <div className="flex items-center gap-2 border-b border-[#313f2f] pb-3">
                <Plus className="w-5 h-5 text-[#bef264]" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                  Add Time for <span className={activeUserObj?.tagColor}>{activeUserObj?.name}</span>
                </h3>
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
                  {formError}
                </div>
              )}

              <form onSubmit={handleAddSlot} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1.5 uppercase font-mono tracking-wider">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-[#161d15] border border-[#364433] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#bef264] transition-colors font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-300 block mb-1.5 uppercase font-mono tracking-wider">Start Time</label>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full bg-[#161d15] border border-[#364433] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#bef264] transition-colors font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-300 block mb-1.5 uppercase font-mono tracking-wider">End Time</label>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full bg-[#161d15] border border-[#364433] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#bef264] transition-colors font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#bef264] hover:bg-[#d9f99d] text-stone-950 font-black text-xs rounded-2xl shadow-lg shadow-[#bef264]/20 transition-all duration-200 flex items-center justify-center gap-2 uppercase tracking-wider font-mono mt-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Add Available Hours
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT: ALL GAMERS SCHEDULE CARDS */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
              <Calendar className="w-4 h-4 text-[#bef264]" /> Trio Schedules ({userTimezone})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SQUAD_MEMBERS.map(member => {
                const isCurrentActive = member.id === currentUser;
                const userSlots = schedules[member.id] || [];

                return (
                  <div 
                    key={member.id}
                    className={`bg-[#222b20] rounded-3xl border p-4 transition-all ${
                      isCurrentActive 
                        ? 'border-[#bef264] ring-1 ring-[#bef264]/40 shadow-lg' 
                        : 'border-[#364332]'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-[#313f2f] pb-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{member.avatar}</span>
                        <div>
                          <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                            {member.name}
                            {isCurrentActive && (
                              <span className="text-[10px] bg-[#bef264] text-stone-950 px-1.5 py-0.5 rounded-full font-bold">
                                You
                              </span>
                            )}
                          </h4>
                        </div>
                      </div>
                    </div>

                    {userSlots.length === 0 ? (
                      <div className="py-6 text-center text-xs text-stone-500 border border-dashed border-[#364332] rounded-2xl">
                        No walk times added.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {userSlots.map(slot => (
                          <div 
                            key={slot.id}
                            className="bg-[#161d15] p-3 rounded-2xl border border-[#313f2f] flex items-center justify-between group hover:border-stone-600 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="text-[11px] text-[#bef264] font-mono font-bold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-lime-400" />
                                <span>{formatInUserTZ(slot.startISO)}</span>
                                <ChevronRight className="w-3 h-3 text-stone-500" />
                                <span>{formatInUserTZ(slot.endISO)}</span>
                              </div>
                            </div>

                            {isCurrentActive && (
                              <button
                                onClick={() => handleDeleteSlot(member.id, slot.id)}
                                title="Delete Time Window"
                                className="text-stone-500 hover:text-rose-400 p-1.5 rounded-xl hover:bg-[#222b20] transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
