export interface Point {
  x: number;
  y: number;
}

export interface Evolution {
  id: string;
  name: string;
  description: string;
  cost: {
    protein: number;
    lipid: number;
    carbohydrate: number;
  };
  type: 'speed' | 'health' | 'damage' | 'passive';
}

export const EVOLUTIONS: Evolution[] = [
  {
    id: 'flagella',
    name: 'Flagelo',
    description: 'Aumenta a velocidade de movimento.',
    cost: { protein: 10, lipid: 5, carbohydrate: 0 },
    type: 'speed'
  },
  {
    id: 'cell_wall',
    name: 'Parede Celular',
    description: 'Aumenta a vida máxima.',
    cost: { protein: 5, lipid: 15, carbohydrate: 0 },
    type: 'health'
  },
  {
    id: 'cilia',
    name: 'Cílios',
    description: 'Causa dano ao tocar em outros organismos.',
    cost: { protein: 15, lipid: 0, carbohydrate: 10 },
    type: 'damage'
  },
  {
    id: 'mitochondria',
    name: 'Mitocôndria',
    description: 'Gera score passivamente.',
    cost: { protein: 5, lipid: 5, carbohydrate: 15 },
    type: 'passive'
  }
];

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  color: string;
  score: number;
  health: number;
  maxHealth: number;
  level: number;
  angle: number;
  speed: number;
  damage: number;
  passiveIncome: number;
  evolutions: string[];
  resources: {
    protein: number;
    lipid: number;
    carbohydrate: number;
  };
}

export interface Resource {
  id: string;
  type: 'protein' | 'lipid' | 'carbohydrate';
  x: number;
  y: number;
  size: number;
}

export interface GameState {
  players: { [id: string]: Player };
  resources: Resource[];
}

export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'move'; angle: number; active: boolean }
  | { type: 'attack'; angle: number }
  | { type: 'evolve'; upgradeId: string };

export type ServerMessage =
  | { type: 'init'; id: string; state: GameState }
  | { type: 'update'; state: GameState }
  | { type: 'playerJoined'; player: Player }
  | { type: 'playerLeft'; id: string };
