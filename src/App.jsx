// ... existing code ...
const getTodayStr = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const EMPTY_SCHEDULES = {
  walker_1: [],
  walker_2: [],
  walker_3: []
};

export default function App() {
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState('walker_1');
  const [userTimezone, setUserTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York');
  const [schedules, setSchedules] = useState(EMPTY_SCHEDULES);
  const [isSyncing, setIsSyncing] = useState(true);

  // New Slot Form State (No title/note field)
// ... existing code ...
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

      // Populate snapshot data directly without fallback to default demo slots
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
      setIsSyncing(false);
    }, (error) => {
      console.error("Firestore snapshot error:", error);
      setIsSyncing(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Convert inputs to UTC ISO string
// ... existing code ...
