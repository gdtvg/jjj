import { BOARD_TILES, COLOR_GROUPS, CHANCE_CARDS, COMMUNITY_CARDS } from '../data/monopolyBoard';
import {
  BoardTile,
  Card,
  GameLogEntry,
  GamePhase,
  GameState,
  Player,
  PropertyState,
  TradeOffer,
} from '../types/game';

export class GameEngine {
  private state: GameState;
  private chanceDeck: Card[];
  private communityDeck: Card[];

  constructor(roomId: string, players: Player[]) {
    // Initialize properties state
    const properties: Record<number, PropertyState> = {};
    BOARD_TILES.forEach((tile) => {
      if (tile.type === 'street' || tile.type === 'railroad' || tile.type === 'utility') {
        properties[tile.id] = {
          tileId: tile.id,
          ownerId: null,
          houses: 0,
          mortgaged: false,
        };
      }
    });

    this.chanceDeck = this.shuffle([...CHANCE_CARDS]);
    this.communityDeck = this.shuffle([...COMMUNITY_CARDS]);

    this.state = {
      roomId,
      phase: 'ROLL',
      players: players.map((p) => ({
        ...p,
        money: 1500,
        position: 0,
        inJail: false,
        jailTurns: 0,
        getOutOfJailCards: 0,
        bankrupt: false,
        connected: true,
      })),
      activePlayerIndex: 0,
      dice: [1, 1],
      doublesCount: 0,
      hasRolled: false,
      properties,
      pendingCard: null,
      activeTrade: null,
      logs: [],
      freeParkingPot: 100,
    };

    this.addLog('Game started! Initial cash: $1500. Good luck!', 'system');
  }

  public snapshot() {
    return { state: this.state, chanceDeck: this.chanceDeck, communityDeck: this.communityDeck };
  }

  public static restore(snapshot: ReturnType<GameEngine['snapshot']>): GameEngine {
    const engine = new GameEngine(snapshot.state.roomId, []);
    engine.state = snapshot.state;
    engine.chanceDeck = snapshot.chanceDeck;
    engine.communityDeck = snapshot.communityDeck;
    return engine;
  }

  public getState(): GameState {
    return this.state;
  }

  public getActivePlayer(): Player | undefined {
    return this.state.players[this.state.activePlayerIndex];
  }

  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  public addLog(
    message: string,
    type: GameLogEntry['type'] = 'system',
    player?: Player
  ): void {
    const entry: GameLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      message,
      type,
      playerName: player?.name,
      playerColor: player?.color,
    };
    this.state.logs.push(entry);
    // Keep last 100 logs
    if (this.state.logs.length > 100) {
      this.state.logs.shift();
    }
  }

  // Rolling the dice
  public rollDice(playerId: string): { success: boolean; message?: string } {
    const activePlayer = this.getActivePlayer();
    if (!activePlayer || activePlayer.id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }
    if (this.state.phase !== 'ROLL') {
      return { success: false, message: 'Cannot roll in this phase' };
    }

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const isDouble = d1 === d2;
    const totalRoll = d1 + d2;
    this.state.dice = [d1, d2];
    this.state.hasRolled = true;

    this.addLog(
      `${activePlayer.name} rolled ${d1} and ${d2} (${totalRoll})${isDouble ? ' - Doubles!' : ''}`,
      'roll',
      activePlayer
    );

    // Player in jail handling
    if (activePlayer.inJail) {
      if (isDouble) {
        activePlayer.inJail = false;
        activePlayer.jailTurns = 0;
        this.state.doublesCount = 0;
        this.addLog(`${activePlayer.name} rolled doubles and broke out of Jail!`, 'jail', activePlayer);
        this.movePlayer(activePlayer, totalRoll);
      } else {
        activePlayer.jailTurns++;
        if (activePlayer.jailTurns >= 3) {
          this.addLog(
            `${activePlayer.name} has spent 3 turns in Jail and pays $50 fine.`,
            'jail',
            activePlayer
          );
          this.deductMoney(activePlayer, 50);
          this.state.freeParkingPot += 50;
          activePlayer.inJail = false;
          activePlayer.jailTurns = 0;
          this.movePlayer(activePlayer, totalRoll);
        } else {
          this.addLog(
            `${activePlayer.name} failed to roll doubles and remains in Jail (Turn ${activePlayer.jailTurns}/3).`,
            'jail',
            activePlayer
          );
          this.state.phase = 'END_TURN';
        }
      }
      return { success: true };
    }

    // Normal turn (not in jail)
    if (isDouble) {
      this.state.doublesCount++;
      if (this.state.doublesCount >= 3) {
        this.addLog(
          `${activePlayer.name} rolled 3 doubles in a row and is sent directly to Jail!`,
          'jail',
          activePlayer
        );
        this.sendToJail(activePlayer);
        this.state.phase = 'END_TURN';
        return { success: true };
      }
    } else {
      this.state.doublesCount = 0;
    }

    this.movePlayer(activePlayer, totalRoll);
    return { success: true };
  }

  // Move player by spaces
  private movePlayer(player: Player, spaces: number): void {
    const oldPos = player.position;
    const newPos = (oldPos + spaces) % 40;

    // Passed GO
    if (newPos < oldPos && spaces > 0) {
      player.money += 200;
      this.addLog(`${player.name} passed GO and collected $200!`, 'system', player);
    }

    player.position = newPos;
    this.handleTileLanding(player, newPos);
  }

  // Direct move without passing GO bonus unless specified
  private moveTo(player: Player, destination: number, collectGo: boolean = true): void {
    if (collectGo && destination < player.position) {
      player.money += 200;
      this.addLog(`${player.name} passed GO and collected $200!`, 'system', player);
    }
    player.position = destination;
    this.handleTileLanding(player, destination);
  }

  public sendToJail(player: Player): void {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    this.state.doublesCount = 0;
  }

  private handleTileLanding(player: Player, tileId: number): void {
    const tile = BOARD_TILES[tileId];
    if (!tile) return;

    this.addLog(`${player.name} landed on ${tile.name}`, 'system', player);

    switch (tile.type) {
      case 'go':
        this.state.phase = 'END_TURN';
        break;

      case 'freeparking':
        if (this.state.freeParkingPot > 0) {
          const pot = this.state.freeParkingPot;
          player.money += pot;
          this.state.freeParkingPot = 50; // reset with seed
          this.addLog(
            `${player.name} landed on Free Parking and won the jackpot pot of $${pot}!`,
            'system',
            player
          );
        }
        this.state.phase = 'END_TURN';
        break;

      case 'gotojail':
        this.addLog(`${player.name} landed on Go to Jail!`, 'jail', player);
        this.sendToJail(player);
        this.state.phase = 'END_TURN';
        break;

      case 'jail':
        this.state.phase = 'END_TURN';
        break;

      case 'tax':
        const tax = tile.taxAmount || 100;
        this.deductMoney(player, tax);
        this.state.freeParkingPot += tax;
        this.addLog(`${player.name} paid $${tax} in ${tile.name}`, 'rent', player);
        this.state.phase = 'END_TURN';
        break;

      case 'chance':
        this.drawCard(player, 'chance');
        break;

      case 'community':
        this.drawCard(player, 'community');
        break;

      case 'street':
      case 'railroad':
      case 'utility':
        this.handlePropertyLanding(player, tile);
        break;

      default:
        this.state.phase = 'END_TURN';
        break;
    }
  }

  private handlePropertyLanding(player: Player, tile: BoardTile): void {
    const propState = this.state.properties[tile.id];
    if (!propState) {
      this.state.phase = 'END_TURN';
      return;
    }

    // Unowned property
    if (!propState.ownerId) {
      this.state.phase = 'ACTION';
      this.state.lastActionPrompt = `Would you like to buy ${tile.name} for $${tile.price}?`;
      return;
    }

    // Owned by self
    if (propState.ownerId === player.id) {
      this.addLog(`${player.name} owns this property. No rent due.`, 'system', player);
      this.state.phase = 'END_TURN';
      return;
    }

    // Owned by someone else
    const owner = this.state.players.find((p) => p.id === propState.ownerId);
    if (!owner || owner.bankrupt) {
      this.state.phase = 'END_TURN';
      return;
    }

    if (propState.mortgaged) {
      this.addLog(`${tile.name} is mortgaged. No rent collected.`, 'system', player);
      this.state.phase = 'END_TURN';
      return;
    }

    // Calculate rent
    const rent = this.calculateRent(tile, propState, owner);
    this.addLog(`${player.name} paid $${rent} rent to ${owner.name}`, 'rent', player);
    this.transferMoney(player, owner, rent);
    this.state.phase = 'END_TURN';
  }

  public calculateRent(tile: BoardTile, propState: PropertyState, owner: Player): number {
    if (tile.type === 'street') {
      const houses = propState.houses;
      if (houses > 0 && tile.rent && tile.rent[houses]) {
        return tile.rent[houses];
      }
      const baseRent = tile.rent ? tile.rent[0] : 10;
      // If color monopoly owned and 0 houses, rent is double
      if (tile.color && this.hasMonopoly(owner.id, tile.color)) {
        return baseRent * 2;
      }
      return baseRent;
    }

    if (tile.type === 'railroad') {
      const rrGroup = COLOR_GROUPS.railroad;
      const ownedCount = rrGroup.filter(
        (id) => this.state.properties[id]?.ownerId === owner.id
      ).length;
      const scale = [25, 50, 100, 200];
      return scale[Math.min(ownedCount - 1, 3)] || 25;
    }

    if (tile.type === 'utility') {
      const utilGroup = COLOR_GROUPS.utility;
      const ownedCount = utilGroup.filter(
        (id) => this.state.properties[id]?.ownerId === owner.id
      ).length;
      const rollSum = this.state.dice[0] + this.state.dice[1];
      const multiplier = ownedCount === 2 ? 10 : 4;
      return rollSum * multiplier;
    }

    return 0;
  }

  public hasMonopoly(playerId: string, color: string): boolean {
    const group = COLOR_GROUPS[color];
    if (!group) return false;
    return group.every((tileId) => this.state.properties[tileId]?.ownerId === playerId);
  }

  private drawCard(player: Player, type: 'chance' | 'community'): void {
    const deck = type === 'chance' ? this.chanceDeck : this.communityDeck;
    if (deck.length === 0) {
      if (type === 'chance') this.chanceDeck = this.shuffle([...CHANCE_CARDS]);
      else this.communityDeck = this.shuffle([...COMMUNITY_CARDS]);
    }
    const card = (type === 'chance' ? this.chanceDeck : this.communityDeck).shift()!;
    this.state.pendingCard = card;
    this.state.phase = 'RESOLVING_CARD';
    this.addLog(`${player.name} drew a ${type === 'chance' ? 'Chance' : 'Community Chest'} card: "${card.title}"`, 'card', player);
  }

  public resolveCard(playerId: string): { success: boolean; message?: string } {
    const player = this.getActivePlayer();
    if (!player || player.id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }
    const card = this.state.pendingCard;
    if (!card) {
      this.state.phase = 'END_TURN';
      return { success: true };
    }

    this.state.pendingCard = null;

    switch (card.action) {
      case 'advance_go':
        this.moveTo(player, 0, true);
        break;
      case 'advance_illinois':
        this.moveTo(player, 24, true);
        break;
      case 'advance_st_charles':
        this.moveTo(player, 11, true);
        break;
      case 'advance_nearest_railroad': {
        const rr = [5, 15, 25, 35];
        const nextRR = rr.find((r) => r > player.position) ?? rr[0];
        this.moveTo(player, nextRR, true);
        break;
      }
      case 'advance_nearest_utility': {
        const utils = [12, 28];
        const nextUtil = utils.find((u) => u > player.position) ?? utils[0];
        this.moveTo(player, nextUtil, true);
        break;
      }
      case 'boardwalk':
        this.moveTo(player, 39, true);
        break;
      case 'reading_railroad':
        this.moveTo(player, 5, true);
        break;
      case 'go_back_3':
        const newPos = (player.position - 3 + 40) % 40;
        player.position = newPos;
        this.handleTileLanding(player, newPos);
        break;
      case 'go_to_jail':
        this.sendToJail(player);
        this.state.phase = 'END_TURN';
        break;
      case 'get_out_of_jail':
        player.getOutOfJailCards++;
        this.addLog(`${player.name} received a Get Out of Jail Free card!`, 'card', player);
        this.state.phase = 'END_TURN';
        break;
      case 'bank_dividend':
      case 'building_loan':
      case 'holiday_fund':
      case 'income_tax_refund':
      case 'life_insurance':
      case 'inherit_money':
      case 'beauty_contest':
      case 'stock_sale':
      case 'bank_error':
        player.money += card.amount || 50;
        this.addLog(`${player.name} collected $${card.amount || 50}`, 'card', player);
        this.state.phase = 'END_TURN';
        break;
      case 'doctor_fee':
      case 'hospital_fees':
      case 'school_fees':
      case 'poor_tax':
        this.deductMoney(player, card.amount || 50);
        this.state.freeParkingPot += card.amount || 50;
        this.addLog(`${player.name} paid $${card.amount || 50}`, 'card', player);
        this.state.phase = 'END_TURN';
        break;
      case 'chairman_board': {
        const amt = card.amount || 50;
        this.state.players.forEach((other) => {
          if (other.id !== player.id && !other.bankrupt) {
            this.transferMoney(player, other, amt);
          }
        });
        this.state.phase = 'END_TURN';
        break;
      }
      case 'general_repairs':
      case 'street_repairs': {
        let totalCost = 0;
        Object.entries(this.state.properties).forEach(([_, prop]) => {
          if (prop.ownerId === player.id) {
            if (prop.houses === 5) totalCost += 100;
            else totalCost += prop.houses * 25;
          }
        });
        if (totalCost > 0) {
          this.deductMoney(player, totalCost);
          this.state.freeParkingPot += totalCost;
          this.addLog(`${player.name} paid $${totalCost} for property repairs`, 'card', player);
        }
        this.state.phase = 'END_TURN';
        break;
      }
      default:
        this.state.phase = 'END_TURN';
        break;
    }

    return { success: true };
  }

  public buyProperty(playerId: string, tileId: number): { success: boolean; message?: string } {
    if (this.state.phase !== 'ACTION') return { success: false, message: 'Cannot do this in the current phase' };
    const player = this.getActivePlayer();
    if (!player || player.id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }
    const tile = BOARD_TILES[tileId];
    const propState = this.state.properties[tileId];

    if (!tile || !propState) {
      return { success: false, message: 'Invalid property' };
    }
    if (propState.ownerId) {
      return { success: false, message: 'Property already owned' };
    }
    if (player.position !== tileId) {
      return { success: false, message: 'Player not currently on this property' };
    }
    const cost = tile.price || 0;
    if (player.money < cost) {
      return { success: false, message: 'Insufficient funds' };
    }

    player.money -= cost;
    propState.ownerId = player.id;
    this.addLog(`${player.name} bought ${tile.name} for $${cost}!`, 'purchase', player);
    this.state.phase = 'END_TURN';
    return { success: true };
  }

  public declineProperty(playerId: string): { success: boolean; message?: string } {
    if (this.state.phase !== 'ACTION') return { success: false, message: 'Cannot do this in the current phase' };
    const player = this.getActivePlayer();
    if (!player || player.id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }
    this.addLog(`${player.name} declined to buy the property.`, 'system', player);
    this.state.phase = 'END_TURN';
    return { success: true };
  }

  public payJailFine(playerId: string): { success: boolean; message?: string } {
    const player = this.getActivePlayer();
    if (!player || player.id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }
    if (!player.inJail) {
      return { success: false, message: 'Not in jail' };
    }
    if (player.money < 50) {
      return { success: false, message: 'Insufficient funds for bail ($50)' };
    }

    player.money -= 50;
    this.state.freeParkingPot += 50;
    player.inJail = false;
    player.jailTurns = 0;
    this.addLog(`${player.name} paid $50 fine and is released from Jail!`, 'jail', player);
    return { success: true };
  }

  public useJailCard(playerId: string): { success: boolean; message?: string } {
    const player = this.getActivePlayer();
    if (!player || player.id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }
    if (!player.inJail) {
      return { success: false, message: 'Not in jail' };
    }
    if (player.getOutOfJailCards <= 0) {
      return { success: false, message: 'No Get Out of Jail Free cards' };
    }

    player.getOutOfJailCards--;
    player.inJail = false;
    player.jailTurns = 0;
    this.addLog(`${player.name} used a Get Out of Jail Free card and was released!`, 'jail', player);
    return { success: true };
  }

  // Building houses/hotels
  public buildHouse(playerId: string, tileId: number): { success: boolean; message?: string } {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found' };

    const tile = BOARD_TILES[tileId];
    const prop = this.state.properties[tileId];
    if (!tile || !prop || prop.ownerId !== playerId || tile.type !== 'street' || !tile.color) {
      return { success: false, message: 'Cannot build on this property' };
    }

    if (!this.hasMonopoly(playerId, tile.color)) {
      return { success: false, message: 'You must own all properties of this color group to build' };
    }

    const group = COLOR_GROUPS[tile.color];
    const hasMortgage = group.some((id) => this.state.properties[id]?.mortgaged);
    if (hasMortgage) {
      return { success: false, message: 'Cannot build while any property in the group is mortgaged' };
    }

    if (prop.houses >= 5) {
      return { success: false, message: 'Maximum improvements already reached (Hotel)' };
    }

    // Even build rule: cannot build if this property already has more houses than another in group
    const minHousesInGroup = Math.min(...group.map((id) => this.state.properties[id]?.houses ?? 0));
    if (prop.houses > minHousesInGroup) {
      return { success: false, message: 'You must build evenly across the color group' };
    }

    const cost = tile.houseCost || 100;
    if (player.money < cost) {
      return { success: false, message: 'Insufficient funds' };
    }

    player.money -= cost;
    prop.houses++;
    const typeLabel = prop.houses === 5 ? 'a Hotel' : `House #${prop.houses}`;
    this.addLog(`${player.name} built ${typeLabel} on ${tile.name} for $${cost}!`, 'purchase', player);
    return { success: true };
  }

  // Selling houses/hotels
  public sellHouse(playerId: string, tileId: number): { success: boolean; message?: string } {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found' };

    const tile = BOARD_TILES[tileId];
    const prop = this.state.properties[tileId];
    if (!tile || !prop || prop.ownerId !== playerId || tile.type !== 'street' || !tile.color) {
      return { success: false, message: 'Cannot sell on this property' };
    }

    if (prop.houses <= 0) {
      return { success: false, message: 'No houses on this property to sell' };
    }

    const group = COLOR_GROUPS[tile.color];
    const maxHousesInGroup = Math.max(...group.map((id) => this.state.properties[id]?.houses ?? 0));
    if (prop.houses < maxHousesInGroup) {
      return { success: false, message: 'You must sell evenly across the color group' };
    }

    const refund = Math.floor((tile.houseCost || 100) / 2);
    player.money += refund;
    prop.houses--;
    this.addLog(`${player.name} sold a house on ${tile.name} for $${refund}!`, 'system', player);
    return { success: true };
  }

  // Mortgaging
  public mortgageProperty(playerId: string, tileId: number): { success: boolean; message?: string } {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found' };

    const tile = BOARD_TILES[tileId];
    const prop = this.state.properties[tileId];
    if (!tile || !prop || prop.ownerId !== playerId) {
      return { success: false, message: 'Cannot mortgage this property' };
    }
    if (prop.mortgaged) {
      return { success: false, message: 'Property is already mortgaged' };
    }

    // Check if any property in color group has houses
    if (tile.color) {
      const group = COLOR_GROUPS[tile.color];
      const hasHouses = group.some((id) => (this.state.properties[id]?.houses ?? 0) > 0);
      if (hasHouses) {
        return { success: false, message: 'Sell all buildings on this color group before mortgaging' };
      }
    }

    const mortgageValue = Math.floor((tile.price || 100) / 2);
    prop.mortgaged = true;
    player.money += mortgageValue;
    this.addLog(`${player.name} mortgaged ${tile.name} for $${mortgageValue}!`, 'system', player);
    return { success: true };
  }

  // Unmortgaging
  public unmortgageProperty(playerId: string, tileId: number): { success: boolean; message?: string } {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found' };

    const tile = BOARD_TILES[tileId];
    const prop = this.state.properties[tileId];
    if (!tile || !prop || prop.ownerId !== playerId) {
      return { success: false, message: 'Cannot unmortgage this property' };
    }
    if (!prop.mortgaged) {
      return { success: false, message: 'Property is not mortgaged' };
    }

    const cost = Math.floor(((tile.price || 100) / 2) * 1.1); // 10% interest
    if (player.money < cost) {
      return { success: false, message: 'Insufficient funds to unmortgage' };
    }

    player.money -= cost;
    prop.mortgaged = false;
    this.addLog(`${player.name} unmortgaged ${tile.name} for $${cost}!`, 'system', player);
    return { success: true };
  }

  // Trading
  public proposeTrade(offer: Omit<TradeOffer, 'id' | 'status'>): { success: boolean; message?: string } {
    const fromPlayer = this.state.players.find((p) => p.id === offer.fromPlayerId);
    const toPlayer = this.state.players.find((p) => p.id === offer.toPlayerId);

    if (!fromPlayer || !toPlayer) return { success: false, message: 'Invalid players in trade' };
    if (fromPlayer.money < offer.offeredMoney) return { success: false, message: 'Insufficient cash offered' };

    if (this.state.phase === 'GAME_OVER' || this.state.activeTrade || fromPlayer.bankrupt || toPlayer.bankrupt || fromPlayer.id === toPlayer.id ||
        ![offer.offeredMoney, offer.requestedMoney].every((n) => Number.isSafeInteger(n) && n >= 0) ||
        ![offer.offeredProperties, offer.requestedProperties].every((ids) => Array.isArray(ids) && new Set(ids).size === ids.length) ||
        [...offer.offeredProperties, ...offer.requestedProperties].some((id) => this.state.properties[id]?.houses > 0)) {
      return { success: false, message: 'Invalid trade offer' };
    }

    // Verify properties owned
    const allOfferedOwned = offer.offeredProperties.every(
      (id) => this.state.properties[id]?.ownerId === fromPlayer.id
    );
    const allRequestedOwned = offer.requestedProperties.every(
      (id) => this.state.properties[id]?.ownerId === toPlayer.id
    );

    if (!allOfferedOwned || !allRequestedOwned) {
      return { success: false, message: 'Properties must be owned by respective traders' };
    }

    const trade: TradeOffer = {
      ...offer,
      id: Math.random().toString(36).substring(2, 9),
      status: 'PENDING',
    };

    this.state.activeTrade = trade;
    this.addLog(`${fromPlayer.name} proposed a trade with ${toPlayer.name}`, 'trade', fromPlayer);
    return { success: true };
  }

  public respondTrade(tradeId: string, playerId: string, accept: boolean): { success: boolean; message?: string } {
    const trade = this.state.activeTrade;
    if (!trade || trade.id !== tradeId) {
      return { success: false, message: 'Trade no longer active' };
    }
    if (trade.toPlayerId !== playerId) {
      return { success: false, message: 'You are not the recipient of this trade' };
    }

    const fromPlayer = this.state.players.find((p) => p.id === trade.fromPlayerId);
    const toPlayer = this.state.players.find((p) => p.id === trade.toPlayerId);

    if (!fromPlayer || !toPlayer) {
      this.state.activeTrade = null;
      return { success: false, message: 'Players not found' };
    }

    if (!accept) {
      trade.status = 'REJECTED';
      this.state.activeTrade = null;
      this.addLog(`${toPlayer.name} rejected the trade offer.`, 'trade', toPlayer);
      return { success: true };
    }

    if (fromPlayer.bankrupt || toPlayer.bankrupt ||
        !trade.offeredProperties.every((id) => this.state.properties[id]?.ownerId === fromPlayer.id && !this.state.properties[id].houses) ||
        !trade.requestedProperties.every((id) => this.state.properties[id]?.ownerId === toPlayer.id && !this.state.properties[id].houses)) {
      this.state.activeTrade = null;
      return { success: false, message: 'Trade assets have changed' };
    }

    // Check balances
    if (fromPlayer.money < trade.offeredMoney || toPlayer.money < trade.requestedMoney) {
      this.state.activeTrade = null;
      return { success: false, message: 'Insufficient funds to complete trade' };
    }

    // Execute trade
    fromPlayer.money -= trade.offeredMoney;
    toPlayer.money += trade.offeredMoney;

    toPlayer.money -= trade.requestedMoney;
    fromPlayer.money += trade.requestedMoney;

    trade.offeredProperties.forEach((id) => {
      if (this.state.properties[id]) {
        this.state.properties[id].ownerId = toPlayer.id;
      }
    });

    trade.requestedProperties.forEach((id) => {
      if (this.state.properties[id]) {
        this.state.properties[id].ownerId = fromPlayer.id;
      }
    });

    trade.status = 'ACCEPTED';
    this.state.activeTrade = null;
    this.addLog(`Trade accepted between ${fromPlayer.name} and ${toPlayer.name}!`, 'trade', toPlayer);
    return { success: true };
  }

  public cancelTrade(playerId: string): { success: boolean } {
    if (this.state.activeTrade && (this.state.activeTrade.fromPlayerId === playerId || this.state.activeTrade.toPlayerId === playerId)) {
      this.state.activeTrade = null;
      this.addLog('Trade offer cancelled', 'trade');
      return { success: true };
    }
    return { success: false };
  }

  // Money handling helpers
  private deductMoney(player: Player, amount: number): void {
    player.money -= amount;
    if (player.money < 0) {
      this.addLog(`${player.name} is in debt! Balance: $${player.money}`, 'rent', player);
    }
  }

  private transferMoney(from: Player, to: Player, amount: number): void {
    from.money -= amount;
    to.money += amount;
    if (from.money < 0) {
      this.addLog(`${from.name} owes $${Math.abs(from.money)}! Sell assets or declare bankruptcy.`, 'rent', from);
    }
  }

  // End turn
  public endTurn(playerId: string): { success: boolean; message?: string } {
    if (this.state.phase !== 'END_TURN') return { success: false, message: 'Cannot do this in the current phase' };
    const activePlayer = this.getActivePlayer();
    if (!activePlayer || activePlayer.id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }

    if (activePlayer.money < 0) return { success: false, message: 'You must settle your debt or declare bankruptcy' };

    // If active player rolled doubles and is not in jail and doublesCount < 3, roll again!
    if (
      this.state.dice[0] === this.state.dice[1] &&
      !activePlayer.inJail &&
      this.state.doublesCount > 0 &&
      this.state.doublesCount < 3
    ) {
      this.state.phase = 'ROLL';
      this.state.hasRolled = false;
      this.addLog(`${activePlayer.name} rolled doubles and gets an extra turn!`, 'roll', activePlayer);
      return { success: true };
    }

    // Shift to next active player
    this.state.doublesCount = 0;
    this.state.hasRolled = false;
    this.advanceToNextPlayer();
    this.state.phase = 'ROLL';
    return { success: true };
  }

  private advanceToNextPlayer(): void {
    const nonBankrupt = this.state.players.filter((p) => !p.bankrupt);
    if (nonBankrupt.length <= 1) {
      this.state.phase = 'GAME_OVER';
      this.state.winnerId = nonBankrupt[0]?.id;
      this.addLog(`🏆 ${nonBankrupt[0]?.name || 'Player'} has won the game!`, 'system');
      return;
    }

    let nextIdx = (this.state.activePlayerIndex + 1) % this.state.players.length;
    while (this.state.players[nextIdx].bankrupt) {
      nextIdx = (nextIdx + 1) % this.state.players.length;
    }

    this.state.activePlayerIndex = nextIdx;
    const nextPlayer = this.state.players[nextIdx];
    this.addLog(`It is now ${nextPlayer.name}'s turn.`, 'system', nextPlayer);
  }

  // Bankruptcy
  public declareBankruptcy(playerId: string): { success: boolean; message?: string } {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found' };

    player.bankrupt = true;
    this.addLog(`💀 ${player.name} has declared bankruptcy and is eliminated!`, 'bankrupt', player);

    // Release properties to bank
    Object.values(this.state.properties).forEach((prop) => {
      if (prop.ownerId === playerId) {
        prop.ownerId = null;
        prop.houses = 0;
        prop.mortgaged = false;
      }
    });

    const nonBankrupt = this.state.players.filter((p) => !p.bankrupt);
    if (nonBankrupt.length <= 1) {
      this.state.phase = 'GAME_OVER';
      this.state.winnerId = nonBankrupt[0]?.id;
      this.addLog(`🎉 ${nonBankrupt[0]?.name} is the last tycoon standing and wins!`, 'system');
    } else if (this.state.players[this.state.activePlayerIndex]?.id === playerId) {
      this.state.doublesCount = 0;
      this.state.hasRolled = false;
      this.state.pendingCard = null;
      this.advanceToNextPlayer();
      this.state.phase = 'ROLL';
    }

    return { success: true };
  }

  // Bot AI decision maker
  public botStep(): boolean {
    const activePlayer = this.getActivePlayer();
    if (!activePlayer || !activePlayer.isBot || activePlayer.bankrupt) {
      return false;
    }

    if (activePlayer.money < 0) {
      const owned = Object.values(this.state.properties).filter((p) => p.ownerId === activePlayer.id);
      const built = owned.filter((p) => p.houses > 0).sort((a, b) => b.houses - a.houses);
      for (const prop of built) if (this.sellHouse(activePlayer.id, prop.tileId).success) return true;
      for (const prop of owned) if (!prop.mortgaged && this.mortgageProperty(activePlayer.id, prop.tileId).success) return true;
      this.declareBankruptcy(activePlayer.id);
      return true;
    }

    if (this.state.phase === 'ROLL') {
      if (activePlayer.inJail) {
        if (activePlayer.getOutOfJailCards > 0) {
          this.useJailCard(activePlayer.id);
        } else if (activePlayer.money >= 300) {
          this.payJailFine(activePlayer.id);
        }
      }
      this.rollDice(activePlayer.id);
      return true;
    }

    if (this.state.phase === 'ACTION') {
      const tile = BOARD_TILES[activePlayer.position];
      const cost = tile?.price || 0;
      // Bot buys if it can keep a healthy cash buffer of at least $100
      if (activePlayer.money >= cost + 100) {
        this.buyProperty(activePlayer.id, activePlayer.position);
      } else {
        this.declineProperty(activePlayer.id);
      }
      return true;
    }

    if (this.state.phase === 'RESOLVING_CARD') {
      this.resolveCard(activePlayer.id);
      return true;
    }

    if (this.state.phase === 'END_TURN') {
      // Check if bot can build houses on monopolies
      Object.keys(COLOR_GROUPS).forEach((color) => {
        if (color !== 'railroad' && color !== 'utility' && this.hasMonopoly(activePlayer.id, color)) {
          const group = COLOR_GROUPS[color];
          for (const tileId of group) {
            const prop = this.state.properties[tileId];
            const tile = BOARD_TILES[tileId];
            if (prop && prop.houses < 5 && activePlayer.money >= (tile.houseCost || 100) + 200) {
              this.buildHouse(activePlayer.id, tileId);
              break;
            }
          }
        }
      });

      this.endTurn(activePlayer.id);
      return true;
    }

    return false;
  }
}
