export type TrackType = 'city' | 'desert' | 'cyberpunk' | 'space';
export type DifficultyType = 'easy' | 'medium' | 'hard';
export type RoomStatus = 'lobby' | 'countdown' | 'racing' | 'finished';

export interface PlayerStats {
  racesPlayed: number;
  wins: number;
  avgWpm: number;
  avgAccuracy: number;
}

export interface Player {
  id: string;
  nickname: string;
  carColor: string; // Hex code or label
  carStyle: number; // Index for car model CSS drawings
  progress: number; // 0 to 100%
  wpm: number;
  accuracy: number;
  combo: number;
  mistakes: number;
  typedLength: number;
  isBot: boolean;
  botDifficulty?: DifficultyType;
  finished: boolean;
  finishTime?: number; // total elapsed time in ms
  rank?: number;
  boostActive: boolean;
  boostCharge: number; // 0 to 100
  shieldActive: boolean;
  isFrozen: boolean;
  frozenUntil?: number;
  score?: number;
}

export interface Room {
  id: string; // Room ID / Join code
  status: RoomStatus;
  players: Player[];
  targetText: string;
  track: TrackType;
  difficulty: DifficultyType;
  countdown: number;
  startTime?: number;
  hostId: string;
  maxPlayers: number;
  useBots: boolean;
}

export interface LeaderboardEntry {
  nickname: string;
  wpm: number;
  accuracy: number;
  date: string;
  track: TrackType;
  difficulty: DifficultyType;
}

export interface PowerUpEvent {
  senderId: string;
  senderNickname: string;
  type: 'nitro' | 'freeze' | 'shield';
  targetId?: string;
}
