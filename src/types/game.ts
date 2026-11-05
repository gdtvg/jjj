export type TileType = 
  | 'street' 
  | 'railroad' 
  | 'utility' 
  | 'tax' 
  | 'chance' 
  | 'community' 
  | 'go' 
  | 'jail' 
  | 'freeparking' 
  | 'gotojail';

export type PropertyColor = 
  | 'brown' 
  | 'lightblue' 
  | 'pink' 
  | 'orange' 
  | 'red' 
  | 'yellow' 
  | 'green' 
  | 'darkblue' 
  | 'railroad' 
  | 'utility';

export interface BoardTile {
  id: number;
  name: string;
  type: TileType;
  color?: PropertyColor;
  price?: number;
  rent?: number[]; // [base, 1 house, 2, 3, 4, hotel] or [1 rr, 2 rr, 3 rr, 4 rr]
  houseCost?: number;
  taxAmount?: number;
  description?: string;
}

export type PlayerToken = '🎩' | '🚗' | '🚢' | '🐕' | '👢' | '🐱' | '✈️' | '🦖';

export interface Player {
  id: string; // Socket ID or generated ID
  name: string;
  color: string; // Hex or tailwind color name
  token: PlayerToken;
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  bankrupt: boolean;
  isHost: boolean;
  isReady: boolean;
  isBot?: boolean;
  connected: boolean;
}

export interface PropertyState {
  tileId: number;
  ownerId: string | null;
  houses: number; // 0-4 houses, 5 = hotel
  mortgaged: boolean;
}

export type GamePhase = 'LOBBY' | 'ROLL' | 'ACTION' | 'RESOLVING_CARD' | 'END_TURN' | 'GAME_OVER';

export interface Card {
  id: string;
  type: 'chance' | 'community';
  title: string;
  description: string;
  action: 
    | 'advance_go'
    | 'advance_illinois'
    | 'advance_st_charles'
    | 'advance_nearest_railroad'
    | 'advance_nearest_utility'
    | 'bank_dividend'
    | 'get_out_of_jail'
    | 'go_back_3'
    | 'go_to_jail'
    | 'general_repairs'
    | 'poor_tax'
    | 'reading_railroad'
    | 'boardwalk'
    | 'chairman_board'
    | 'building_loan'
    | 'beauty_contest'
    | 'bank_error'
    | 'doctor_fee'
    | 'stock_sale'
    | 'holiday_fund'
    | 'income_tax_refund'
    | 'life_insurance'
    | 'hospital_fees'
    | 'school_fees'
    | 'consultancy_fee'
    | 'street_repairs'
    | 'inherit_money';
  amount?: number;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredMoney: number;
  offeredProperties: number[]; // tile IDs
  requestedMoney: number;
  requestedProperties: number[]; // tile IDs
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'system' | 'roll' | 'trade' | 'purchase' | 'rent' | 'jail' | 'card' | 'bankrupt' | 'chat';
  playerName?: string;
  playerColor?: string;
}

export interface GameState {
  turnDeadline?: number;
  turnClockKey?: string;
  roomId: string;
  phase: GamePhase;
  players: Player[];
  activePlayerIndex: number;
  dice: [number, number];
  doublesCount: number;
  hasRolled: boolean;
  properties: Record<number, PropertyState>;
  pendingCard: Card | null;
  activeTrade: TradeOffer | null;
  logs: GameLogEntry[];
  winnerId?: string;
  lastActionPrompt?: string;
  freeParkingPot: number;
}

export interface LobbyRoom {
  roomId: string;
  hostId: string;
  players: Player[];
  status: 'WAITING' | 'PLAYING';
  createdAt: number;
}
