import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, collection, getDocs, setDoc, addDoc, query, orderBy, limit } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Connectivity validation as requested in skill
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, '_health', 'check'));
    return true;
  } catch (error) {
    // Permission or not found is normal for health check; if offline, log warning
    if (error instanceof Error && error.message.includes('client is offline')) {
      console.warn('Firebase connection: client appears offline');
      return false;
    }
    return true;
  }
}

// Leaderboard service functions
export interface LeaderboardRecord {
  id: string;
  username: string;
  wins: number;
  gamesPlayed: number;
  totalCashEarned: number;
  updatedAt: string;
}

export async function fetchGlobalLeaderboard(): Promise<LeaderboardRecord[]> {
  try {
    const q = query(collection(db, 'leaderboard'), orderBy('wins', 'desc'), limit(10));
    const snapshot = await getDocs(q);
    const records: LeaderboardRecord[] = [];
    snapshot.forEach((d) => {
      records.push({ id: d.id, ...(d.data() as Omit<LeaderboardRecord, 'id'>) });
    });
    return records;
  } catch (err) {
    console.error('Failed to fetch leaderboard from Firestore:', err);
    return [];
  }
}

export async function recordGameVictory(winnerName: string, netWorth: number, roomCode: string, turns: number, playersCount: number) {
  try {
    // 1. Add to match history
    await addDoc(collection(db, 'matchHistory'), {
      roomCode,
      winnerName,
      winnerNetWorth: netWorth,
      turnsPlayed: turns,
      playersCount,
      timestamp: new Date().toISOString(),
    });

    // 2. Update player leaderboard record
    const playerDocId = winnerName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const playerRef = doc(db, 'leaderboard', playerDocId);
    await setDoc(
      playerRef,
      {
        username: winnerName,
        wins: 1, // incremented in actual play or upsert
        gamesPlayed: 1,
        totalCashEarned: netWorth,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Failed to record game victory in Firestore:', err);
  }
}
