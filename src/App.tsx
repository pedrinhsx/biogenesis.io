import React, { useEffect, useRef, useState } from 'react';
import { GameState, Player, ClientMessage, ServerMessage, EVOLUTIONS } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Dna, Zap, Shield, Target, MousePointer2, ChevronUp, Heart, Swords, Wind, Brain } from 'lucide-react';

const MAP_SIZE = 2000;

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEvolve, setShowEvolve] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const isMoving = useRef(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'init':
          setPlayerId(message.id);
          setGameState(message.state);
          break;
        case 'update':
          setGameState(message.state);
          break;
      }
    };

    socket.onclose = () => {
      setError("Conexão perdida com o servidor.");
    };

    return () => socket.close();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !gameState || !playerId) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const player = gameState.players[playerId];
      if (!player) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

      // Draw Grid
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      for (let x = 0; x <= MAP_SIZE; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_SIZE); ctx.stroke();
      }
      for (let y = 0; y <= MAP_SIZE; y += 100) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_SIZE, y); ctx.stroke();
      }

      // Draw Resources
      gameState.resources.forEach(res => {
        ctx.beginPath();
        ctx.arc(res.x, res.y, res.size, 0, Math.PI * 2);
        ctx.fillStyle = res.type === 'protein' ? '#4ade80' : res.type === 'lipid' ? '#fbbf24' : '#60a5fa';
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle as string;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();
      });

      // Draw Players
      Object.values(gameState.players).forEach((p: Player) => {
        if (p.health <= 0) return;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Flagella (Tail)
        if (p.evolutions.includes('flagella')) {
          ctx.beginPath();
          ctx.moveTo(-p.size, 0);
          ctx.quadraticCurveTo(-p.size * 2, Math.sin(Date.now() / 100) * 10, -p.size * 2.5, 0);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.closePath();
        }

        // Cilia (Spikes)
        if (p.evolutions.includes('cilia')) {
          for (let i = 0; i < 8; i++) {
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(p.size, 0);
            ctx.lineTo(p.size + 8, 0);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();
          }
        }

        // Body
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Nucleus
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
        ctx.closePath();

        // Eye
        ctx.beginPath();
        ctx.arc(p.size * 0.6, 0, p.size * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.closePath();

        ctx.restore();

        // Name and Health
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x, p.y - p.size - 20);

        const barWidth = 50;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.roundRect(p.x - barWidth / 2, p.y - p.size - 15, barWidth, 6, 3);
        ctx.fill();
        const healthPercent = Math.max(0, p.health / p.maxHealth);
        ctx.fillStyle = healthPercent > 0.5 ? '#4ade80' : healthPercent > 0.2 ? '#fbbf24' : '#ef4444';
        ctx.roundRect(p.x - barWidth / 2, p.y - p.size - 15, barWidth * healthPercent, 6, 3);
        ctx.fill();
      });

      ctx.restore();

      if (isMoving.current && socketRef.current?.readyState === WebSocket.OPEN) {
        const dx = mousePos.current.x - canvas.width / 2;
        const dy = mousePos.current.y - canvas.height / 2;
        const angle = Math.atan2(dy, dx);
        socketRef.current.send(JSON.stringify({ type: 'move', angle, active: true }));
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, playerId]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'join', name: playerName }));
      setIsJoined(true);
    }
  };

  const handleEvolve = (evoId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'evolve', upgradeId: evoId }));
    }
  };

  const currentPlayer = playerId ? gameState?.players[playerId] : null;

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-sans text-white select-none">
      <AnimatePresence>
        {!isJoined && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl"
          >
            <div className="w-full max-w-md p-10 bg-[#0a0a0a] border border-white/5 rounded-3xl shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-green-500/10 rounded-2xl">
                  <Dna className="w-10 h-10 text-green-400" />
                </div>
                <div>
                  <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">Biogenesis</h1>
                  <span className="text-[10px] font-bold tracking-[0.3em] text-green-500/50 uppercase">Survival IO</span>
                </div>
              </div>
              <form onSubmit={handleJoin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-30">Identificação Celular</label>
                  <input
                    type="text"
                    placeholder="Ex: Amoeba-X"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-green-500 transition-all text-lg font-medium"
                    maxLength={15}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-5 bg-green-500 hover:bg-green-400 text-black font-black rounded-xl transition-all transform active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.3)]"
                >
                  INICIAR EVOLUÇÃO
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isJoined && (
        <>
          <canvas
            ref={canvasRef}
            onMouseMove={(e) => mousePos.current = { x: e.clientX, y: e.clientY }}
            onMouseDown={() => isMoving.current = true}
            onMouseUp={() => isMoving.current = false}
            className="w-full h-full cursor-crosshair"
          />

          {/* HUD Left */}
          <div className="absolute top-8 left-8 flex flex-col gap-6 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Nutrientes</span>
              </div>
              <div className="flex gap-8">
                {[
                  { label: 'Proteína', val: currentPlayer?.resources.protein, color: 'text-green-400' },
                  { label: 'Lípido', val: currentPlayer?.resources.lipid, color: 'text-yellow-400' },
                  { label: 'Carbo', val: currentPlayer?.resources.carbohydrate, color: 'text-blue-400' }
                ].map(r => (
                  <div key={r.label} className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold opacity-30 mb-1">{r.label}</span>
                    <span className={`text-2xl font-black font-mono ${r.color}`}>{r.val || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-2xl w-fit">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-red-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Score</span>
              </div>
              <span className="text-3xl font-black font-mono">{currentPlayer?.score || 0}</span>
            </div>
          </div>

          {/* Evolution Menu */}
          <div className="absolute bottom-8 right-8 flex flex-col items-end gap-4">
            <AnimatePresence>
              {showEvolve && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className="bg-black/60 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 shadow-2xl w-[320px] mb-2"
                >
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    Árvore de Evolução
                  </h3>
                  <div className="space-y-3">
                    {EVOLUTIONS.map(evo => {
                      const canAfford = currentPlayer && 
                        currentPlayer.resources.protein >= evo.cost.protein &&
                        currentPlayer.resources.lipid >= evo.cost.lipid &&
                        currentPlayer.resources.carbohydrate >= evo.cost.carbohydrate;
                      
                      return (
                        <button
                          key={evo.id}
                          onClick={() => handleEvolve(evo.id)}
                          disabled={!canAfford}
                          className={`w-full text-left p-4 rounded-xl border transition-all group ${
                            canAfford 
                              ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-green-500/50' 
                              : 'bg-black/20 border-white/5 opacity-40 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm">{evo.name}</span>
                            <div className="flex gap-1">
                              {evo.type === 'speed' && <Wind className="w-3 h-3 text-blue-400" />}
                              {evo.type === 'health' && <Heart className="w-3 h-3 text-red-400" />}
                              {evo.type === 'damage' && <Swords className="w-3 h-3 text-orange-400" />}
                              {evo.type === 'passive' && <Zap className="w-3 h-3 text-yellow-400" />}
                            </div>
                          </div>
                          <p className="text-[10px] opacity-50 mb-3 leading-relaxed">{evo.description}</p>
                          <div className="flex gap-3 text-[9px] font-bold">
                            {evo.cost.protein > 0 && <span className="text-green-400">P: {evo.cost.protein}</span>}
                            {evo.cost.lipid > 0 && <span className="text-yellow-400">L: {evo.cost.lipid}</span>}
                            {evo.cost.carbohydrate > 0 && <span className="text-blue-400">C: {evo.cost.carbohydrate}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <button 
              onClick={() => setShowEvolve(!showEvolve)}
              className={`p-5 rounded-full shadow-2xl transition-all active:scale-90 ${
                showEvolve ? 'bg-white text-black' : 'bg-green-500 text-black'
              }`}
            >
              <ChevronUp className={`w-6 h-6 transition-transform ${showEvolve ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Leaderboard */}
          <div className="absolute top-8 right-8 w-56 bg-black/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-2xl pointer-events-none">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-4">Rank Biológico</h3>
            <div className="space-y-3">
              {(Object.values(gameState?.players || {}) as Player[])
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map((p, i) => (
                  <div key={p.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-[10px] font-bold opacity-20">{i + 1}</span>
                      <span className="text-xs font-medium truncate">{p.name}</span>
                    </div>
                    <span className="text-xs font-black font-mono opacity-50">{p.score}</span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-red-950/40 backdrop-blur-2xl">
          <div className="bg-[#0a0a0a] p-10 rounded-3xl border border-red-500/20 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Zap className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-black uppercase italic mb-2">Extinção Prematura</h2>
            <p className="text-sm opacity-50 mb-8 max-w-xs mx-auto">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-red-500 text-white rounded-xl font-black transition-all active:scale-95"
            >
              RECONECTAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
