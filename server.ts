import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";
import { GameState, Player, Resource, ClientMessage, ServerMessage, EVOLUTIONS } from "./src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MAP_SIZE = 2000;
const INITIAL_SIZE = 20;
const MAX_RESOURCES = 150;

async function startServer() {
  const app = express();
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  const state: GameState = {
    players: {},
    resources: [],
  };

  // Spawn initial resources
  for (let i = 0; i < MAX_RESOURCES; i++) {
    spawnResource();
  }

  function spawnResource() {
    const types: Resource['type'][] = ['protein', 'lipid', 'carbohydrate'];
    state.resources.push({
      id: nanoid(),
      type: types[Math.floor(Math.random() * types.length)],
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE,
      size: 5 + Math.random() * 5,
    });
  }

  const clients = new Map<string, WebSocket>();

  wss.on("connection", (ws) => {
    const id = nanoid();
    
    ws.on("message", (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        
        if (message.type === 'join') {
          const player: Player = {
            id,
            name: message.name || "Cell",
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            size: INITIAL_SIZE,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            score: 0,
            health: 100,
            maxHealth: 100,
            level: 1,
            angle: 0,
            speed: 2,
            damage: 5,
            passiveIncome: 0,
            evolutions: [],
            resources: { protein: 0, lipid: 0, carbohydrate: 0 }
          };
          state.players[id] = player;
          clients.set(id, ws);
          
          ws.send(JSON.stringify({ type: 'init', id, state }));
          broadcast({ type: 'playerJoined', player });
        }
        
        if (message.type === 'move') {
          const player = state.players[id];
          if (player && player.health > 0) {
            player.angle = message.angle;
            if (message.active) {
              player.x += Math.cos(player.angle) * player.speed;
              player.y += Math.sin(player.angle) * player.speed;
              
              // Keep in bounds
              player.x = Math.max(0, Math.min(MAP_SIZE, player.x));
              player.y = Math.max(0, Math.min(MAP_SIZE, player.y));
              
              // Check resource collisions
              state.resources = state.resources.filter(res => {
                const dx = player.x - res.x;
                const dy = player.y - res.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < player.size + res.size) {
                  player.resources[res.type]++;
                  player.score += 10;
                  player.size += 0.05;
                  return false;
                }
                return true;
              });
              
              while (state.resources.length < MAX_RESOURCES) {
                spawnResource();
              }

              // Check player collisions (Combat)
              Object.values(state.players).forEach(other => {
                if (other.id === player.id || other.health <= 0) return;
                const dx = player.x - other.x;
                const dy = player.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < player.size + other.size) {
                  // Damage based on size and damage stat
                  other.health -= player.damage * 0.1;
                  if (other.health <= 0) {
                    player.score += 500;
                    player.resources.protein += 50;
                  }
                }
              });
            }
          }
        }

        if (message.type === 'evolve') {
          const player = state.players[id];
          const evo = EVOLUTIONS.find(e => e.id === message.upgradeId);
          if (player && evo && player.health > 0) {
            if (player.resources.protein >= evo.cost.protein &&
                player.resources.lipid >= evo.cost.lipid &&
                player.resources.carbohydrate >= evo.cost.carbohydrate) {
              
              player.resources.protein -= evo.cost.protein;
              player.resources.lipid -= evo.cost.lipid;
              player.resources.carbohydrate -= evo.cost.carbohydrate;
              
              player.evolutions.push(evo.id);
              player.level++;

              // Apply effects
              if (evo.type === 'speed') player.speed += 0.5;
              if (evo.type === 'health') {
                player.maxHealth += 50;
                player.health = player.maxHealth;
              }
              if (evo.type === 'damage') player.damage += 10;
              if (evo.type === 'passive') player.passiveIncome += 1;
            }
          }
        }
      } catch (e) {
        console.error("Error parsing message", e);
      }
    });

    ws.on("close", () => {
      delete state.players[id];
      clients.delete(id);
      broadcast({ type: 'playerLeft', id });
    });
  });

  function broadcast(message: ServerMessage) {
    const data = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // Game Loop
  setInterval(() => {
    // Passive income
    Object.values(state.players).forEach(p => {
      if (p.health > 0) {
        p.score += p.passiveIncome;
        // Natural healing
        if (p.health < p.maxHealth) p.health += 0.05;
      }
    });
    broadcast({ type: 'update', state });
  }, 1000 / 30); // 30 FPS updates

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer();
