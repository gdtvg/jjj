export interface LeaderboardRecord {
  id: string;
  username: string;
  wins: number;
  gamesPlayed: number;
  totalCashEarned: number;
  updatedAt: string;
}
export async function fetchGlobalLeaderboard(): Promise<LeaderboardRecord[]> {
  const response = await fetch('/.netlify/functions/game', { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Rangliste konnte nicht geladen werden.');
  return response.json();
}
