/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ElementId, 
  ElementInfo, 
  FusionSkill, 
  PlayerDB, 
  GameMatchState, 
  GameWSMessage 
} from './types';
import { ELEMENTS_LIST, getFusionSkill, getFusionKey } from './elementSkills';
import { 
  Flame, 
  Zap, 
  Snowflake, 
  Sprout, 
  Wind, 
  Sun, 
  Mountain, 
  Moon, 
  Copy, 
  Check, 
  Play, 
  User, 
  Trophy, 
  Sword, 
  AlertCircle,
  Shield,
  ZapOff,
  Crosshair,
  Volume2,
  VolumeX,
  Keyboard
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  // Navigation & User Info State
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('stickman_username') || '';
  });
  const [isRegistered, setIsRegistered] = useState<boolean>(() => {
    return !!localStorage.getItem('stickman_username');
  });
  const [playerInfo, setPlayerInfo] = useState<PlayerDB | null>(null);
  
  // Element selections (2 elements must be chosen)
  const [selectedElements, setSelectedElements] = useState<ElementId[]>(['fire', 'lightning']);
  
  // Match Status & Realtime
  const [queueStatus, setQueueStatus] = useState<'idle' | 'searching' | 'connected'>('idle');
  const [matchRoomId, setMatchRoomId] = useState<string | null>(null);
  const [mySide, setMySide] = useState<1 | 2>(1);
  const [p1Elems, setP1Elems] = useState<ElementId[]>(['fire', 'lightning']);
  const [p2Elems, setP2Elems] = useState<ElementId[]>(['ice', 'plant']);
  const [opponentName, setOpponentName] = useState<string>('EasyBot_AI');
  const [opponentWins, setOpponentWins] = useState<number>(5);
  const [isPrivateRoom, setIsPrivateRoom] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>('');

  // Rankings
  const [rankings, setRankings] = useState<PlayerDB[]>([]);
  const [showRankings, setShowRankings] = useState<boolean>(false);

  // In-Game Synced state
  const [gameState, setGameState] = useState<GameMatchState | null>(null);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [winnerMessage, setWinnerMessage] = useState<string>('');
  const [countdownMsg, setCountdownMsg] = useState<string>('');

  // SQL DDL copy flag
  const [ddlText, setDdlText] = useState<string>('');
  const [copiedDdl, setCopiedDdl] = useState<boolean>(false);
  const [showDdlPopup, setShowDdlPopup] = useState<boolean>(false);

  // Client Keyboard Input State
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const wsRef = useRef<WebSocket | null>(null);

  // Particle Effects (visual candy)
  const [localParticles, setLocalParticles] = useState<{
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    alpha: number;
    life: number;
  }[]>([]);

  // Sound effects
  const [audioMuted, setAudioMuted] = useState<boolean>(true);

  // Load SQL DDL and leaderboard rankings
  useEffect(() => {
    fetch(API_BASE + '/api/ddl')
      .then(res => res.text())
      .then(text => setDdlText(text))
      .catch(err => console.error('Failed to load SQL Schema', err));

    fetchRankings();
  }, []);

  const fetchRankings = () => {
    fetch(API_BASE + '/api/rankings')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setRankings(data.players);
          if (isRegistered && username) {
            const me = data.players.find((p: PlayerDB) => p.username.toLowerCase() === username.toLowerCase());
            if (me) setPlayerInfo(me);
          }
        }
      })
      .catch(err => console.error('Failed to get rankings', err));
  };

  // Connect & Join Matchmaking Queue via WebSockets
  const startMatchmaking = () => {
    if (!username.trim()) {
      alert('아이디를 먼저 등록해 주세요!');
      return;
    }

    if (selectedElements.length !== 2) {
      alert('2가지 원소를 반드시 선택해야 융합 궁극기를 쓸 수 있습니다!');
      return;
    }

    if (isPrivateRoom && !roomCode.trim()) {
      alert('친구와 함께 셜전하려면 방 코드를 입력해 주세요!');
      return;
    }

    localStorage.setItem('stickman_username', username.trim());
    setIsRegistered(true);

    // Save player profile info
    fetch(API_BASE + '/api/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim() })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setPlayerInfo(data.player);
      }
    });

    setQueueStatus('searching');
    setIsFinished(false);
    setGameState(null);

    // Dynamic clean protocol determination
    const wsUrl = import.meta.env.VITE_WS_URL || (() => {
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      return `${protocol}${window.location.host}`;
    })();
    
    if (wsRef.current) {
      wsRef.current.close();
    }

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      // Send Register and Join Queue message
      const msg: GameWSMessage = {
        type: 'join_queue',
        username: username.trim(),
        elem1: selectedElements[0],
        elem2: selectedElements[1],
        roomCode: isPrivateRoom ? roomCode.trim() : undefined
      };
      socket.send(JSON.stringify(msg));
    };

    socket.onmessage = (event) => {
      try {
        const message: GameWSMessage = JSON.parse(event.data);

        if (message.type === 'match_found') {
          setQueueStatus('connected');
          setMatchRoomId(message.roomId);
          setMySide(message.side);
          setP1Elems(message.p1Elems);
          setP2Elems(message.p2Elems);
          
          if (message.side === 1) {
            setOpponentName(message.p2.username);
            setOpponentWins(message.p2.win_count);
          } else {
            setOpponentName(message.p1.username);
            setOpponentWins(message.p1.win_count);
          }
          
          triggerCombatCountdown();
        } 
        else if (message.type === 'game_update') {
          setGameState(message.state);
          // Spawn cool impact visuals when screen shake rises
          if (message.state.shakeIntensity > 15) {
            spawnImpactParticles();
          }
        } 
        else if (message.type === 'rankings_data') {
          setRankings(message.players);
        }
        else if (message.type === 'match_over') {
          setIsFinished(true);
          setQueueStatus('idle');
          if (message.winnerId) {
            setWinnerMessage(
              message.winnerUsername === username.trim() 
                ? '🏆 승리했습니다! 당신의 실시간 전투 랭킹이 향상되었습니다.' 
                : `💀 패배하였습니다... 승리자는 ${message.winnerUsername} 입니다.`
            );
          } else {
            setWinnerMessage('🤝 무승부! 둘 다 막상막하의 전투였습니다.');
          }
          fetchRankings();
          if (wsRef.current) {
            wsRef.current.close();
          }
        }
      } catch (err) {
        console.error('Socket parse err', err);
      }
    };

    socket.onclose = () => {
      setQueueStatus('idle');
    };
  };

  const cancelMatchmaking = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'leave_queue' }));
      wsRef.current.close();
    }
    setQueueStatus('idle');
  };

  // Spark up visual background particle systems
  const spawnImpactParticles = () => {
    const fresh: typeof localParticles = [];
    const colors = ['#f97316', '#eab308', '#06b6d4', '#22c55e', '#a855f7', '#6366f1'];
    for (let i = 0; i < 15; i++) {
      fresh.push({
        id: Math.random().toString(),
        x: 100 + Math.random() * 800,
        y: 100 + Math.random() * 300,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 6,
        alpha: 1.0,
        life: 500 + Math.random() * 600
      });
    }
    setLocalParticles(prev => [...prev, ...fresh].slice(0, 100));
  };

  // Periodic particle simulator tick
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            alpha: Math.max(0, p.alpha - 0.05),
            life: p.life - 30
          }))
          .filter(p => p.life > 0)
      );
    }, 30);
    return () => clearInterval(timer);
  }, []);

  const triggerCombatCountdown = () => {
    setCountdownMsg('3');
    setTimeout(() => setCountdownMsg('2'), 1000);
    setTimeout(() => setCountdownMsg('1'), 2000);
    setTimeout(() => setCountdownMsg('DESTRY!'), 3000);
    setTimeout(() => setCountdownMsg(''), 3800);
  };

  // Setup Keyboard Capturer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (queueStatus !== 'connected') return;
      const key = e.key.toUpperCase();

      // Prevent scrolling behaviors for standard controls
      if (['ARROWUP', 'ARROWDOWN', ' ', 'A', 'S', 'D', 'W'].includes(e.key.toUpperCase())) {
        e.preventDefault();
      }

      if (!keysPressed.current[key]) {
        keysPressed.current[key] = true;
        sendInputsToServer();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (queueStatus !== 'connected') return;
      const key = e.key.toUpperCase();
      if (keysPressed.current[key]) {
        keysPressed.current[key] = false;
        sendInputsToServer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [queueStatus]);

  const sendInputsToServer = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    let moveX = 0;
    if (keysPressed.current['A'] || keysPressed.current['ARROWLEFT']) {
      moveX = -1;
    } else if (keysPressed.current['D'] || keysPressed.current['ARROWRIGHT']) {
      moveX = 1;
    }

    const jump = !!(keysPressed.current['W'] || keysPressed.current['ARROWUP'] || keysPressed.current[' ']);
    
    let skillSelected: 'A' | 'S' | 'R' | null = null;
    if (keysPressed.current['Q'] || keysPressed.current['A_KEY_SPELL']) {
      // mapping standard skill A
    }

    // Since character spell trigger keys are specified as A, S, R:
    // We register direct key releases or keypresses as state triggers.
    // If user hit 'A', that conflicts with left motion arrow?
    // Let's allow Arrow Left/Right for motion, and [A, S, R] or [1, 2, 3] for spells to be ultra-usable!
    let skill: 'A' | 'S' | 'R' | null = null;
    if (keysPressed.current['Z'] || keysPressed.current['1'] || keysPressed.current['J']) {
      skill = 'A';
    } else if (keysPressed.current['X'] || keysPressed.current['2'] || keysPressed.current['K']) {
      skill = 'S';
    } else if (keysPressed.current['R'] || keysPressed.current['3'] || keysPressed.current['L']) {
      skill = 'R';
    }

    const payload: GameWSMessage = {
      type: 'client_input',
      moveX,
      jump,
      skill
    };
    wsRef.current.send(JSON.stringify(payload));
  };

  // Direct Button Spell casting shortcuts
  const castSpellDirectly = (skillType: 'A' | 'S' | 'R') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const payload: GameWSMessage = {
      type: 'client_input',
      moveX: 0,
      jump: false,
      skill: skillType
    };
    wsRef.current.send(JSON.stringify(payload));
  };

  // Element utility selectors
  const handleToggleElement = (id: ElementId) => {
    setSelectedElements(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(x => x !== id);
      } else {
        if (prev.length >= 2) {
          // Replace second choice
          return [prev[0], id];
        }
        return [...prev, id];
      }
    });
  };

  // Copy Supabase Table schema SQL snippet helper
  const handleCopyDdl = () => {
    navigator.clipboard.writeText(ddlText);
    setCopiedDdl(true);
    setTimeout(() => setCopiedDdl(false), 2000);
  };

  // Active Fusion logic representation
  const activeFusion: FusionSkill = selectedElements.length === 2 
    ? getFusionSkill(selectedElements[0], selectedElements[1])
    : { name: '-', desc: '-', color: '#6366f1', effect: '-', animationType: 'basic' };

  // Render elements in colorful chips
  const renderElemIcon = (id: ElementId, size: number = 18) => {
    switch(id) {
      case 'fire': return <Flame size={size} className="text-red-500" />;
      case 'lightning': return <Zap size={size} className="text-yellow-400" />;
      case 'ice': return <Snowflake size={size} className="text-cyan-400" />;
      case 'plant': return <Sprout size={size} className="text-emerald-400" />;
      case 'wind': return <Wind size={size} className="text-indigo-300" />;
      case 'light': return <Sun size={size} className="text-amber-200" />;
      case 'earth': return <Mountain size={size} className="text-yellow-600" />;
      case 'void': return <Moon size={size} className="text-purple-400" />;
    }
  };

  // Compute percentage calculations for safety bars
  const p1Character = gameState?.p1;
  const p2Character = gameState?.p2;

  // Let's select active in-flight components of client side
  const myPlayerState = mySide === 1 ? p1Character : p2Character;
  const opponentState = mySide === 1 ? p2Character : p1Character;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-x-hidden antialiased">
      {/* 1. Header Section */}
      <header className="h-20 border-b border-slate-900 bg-slate-900/40 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-2xl skew-x-[-10deg] shadow-lg shadow-indigo-600/30">
            S
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase italic text-white flex items-center gap-2">
              Stickman <span className="text-indigo-400">Element Duel</span>
              <span className="text-xs font-normal border border-indigo-500/30 text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded ml-2">v2.4 Live</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mt-1">실시간 원소 결합 & 백엔드 연동 대전</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowDdlPopup(true)} 
            className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 border border-slate-800 rounded-lg bg-slate-950/80 text-indigo-400 hover:border-indigo-500/40 transition-all cursor-pointer"
          >
            <Shield size={14} />
            <span>Supabase DDL Setup</span>
          </button>

          <button 
            onClick={() => {
              setShowRankings(!showRankings);
              fetchRankings();
            }} 
            className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 border border-slate-800 rounded-lg bg-slate-950/80 text-yellow-500 hover:border-yellow-500/40 transition-all cursor-pointer"
          >
            <Trophy size={14} />
            <span>랭킹 리더보드</span>
          </button>

          <div className="h-10 w-px bg-slate-800"></div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-white">{username || '익명 도전자'}</p>
              <p className="text-xs text-indigo-400 font-mono">Wins: {playerInfo?.win_count || 0}</p>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-indigo-500 bg-slate-800/80 flex items-center justify-center shadow-md">
              <User size={20} className="text-indigo-400" />
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Arena Layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: Element Selectors & Stats */}
        <div className="lg:col-span-1 flex flex-col gap-5">
          {/* USER REGISTRATION & MATCH MODE SETTING */}
          <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-5 shadow-xl backdrop-blur-sm flex flex-col gap-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <User size={14} />
                <span>플레이어 정보 등록</span>
              </h2>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="고유 닉네임 입력..." 
                  disabled={queueStatus !== 'idle'}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg font-medium text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors"
                />
                <button 
                  onClick={() => {
                    if (username.trim()) {
                      setIsRegistered(true);
                      localStorage.setItem('stickman_username', username.trim());
                      fetchRankings();
                    }
                  }} 
                  disabled={queueStatus !== 'idle'}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2.5 flex items-center gap-1.5">
                <span>⚔️ 대전 모드 선택</span>
              </h2>
              
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800/60 text-xs mb-3">
                <button
                  type="button"
                  onClick={() => setIsPrivateRoom(false)}
                  disabled={queueStatus !== 'idle'}
                  className={`py-1.5 px-2 rounded-md font-bold transition-all ${!isPrivateRoom ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                >
                  공개 매칭
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivateRoom(true)}
                  disabled={queueStatus !== 'idle'}
                  className={`py-1.5 px-2 rounded-md font-bold transition-all ${isPrivateRoom ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                >
                  친선전 (방 코드)
                </button>
              </div>

              {isPrivateRoom && (
                <div className="space-y-2.5 animate-fadeIn">
                  <div className="flex gap-1.5">
                    <input 
                      type="text" 
                      value={roomCode} 
                      onChange={(e) => setRoomCode(e.target.value)}
                      placeholder="방 코드 입력 (예: 1234)" 
                      disabled={queueStatus !== 'idle'}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-sm text-indigo-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors uppercase"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const code = Math.floor(1000 + Math.random() * 9000).toString();
                        setRoomCode(code);
                      }}
                      disabled={queueStatus !== 'idle'}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer disabled:opacity-50"
                    >
                      랜덤 생성
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    본인의 방 코드를 친구에게 공유하거나, 친구가 생성한 방 코드를 입력하고 매칭을 시작하세요!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ELEMENT SELECTORS GRID */}
          <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-5 shadow-xl backdrop-blur-sm flex-1 flex flex-col">
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 flex items-center justify-between">
                <span>원소 선택 (2가지 원소)</span>
                <span className="text-indigo-400 font-mono">{selectedElements.length}/2</span>
              </h2>
              <p className="text-xs text-slate-400">전장에서 융합할 2개의 원소를 클릭하세요.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 flex-1 min-h-[220px]">
              {ELEMENTS_LIST.map((elem) => {
                const isActive = selectedElements.includes(elem.id);
                const orderIndex = selectedElements.indexOf(elem.id);
                return (
                  <button 
                    key={elem.id}
                    disabled={queueStatus !== 'idle'}
                    onClick={() => handleToggleElement(elem.id)}
                    className={`relative p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer select-none group focus:outline-none ${
                      isActive 
                        ? 'bg-slate-950 border-indigo-500 ring-2 ring-indigo-500 shadow-md shadow-indigo-500/10' 
                        : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                    } ${queueStatus !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isActive && (
                      <span className="absolute top-1.5 right-2 bg-indigo-500 text-[10px] font-bold text-white px-1.5 py-0.2 rounded-full leading-tight">
                        {orderIndex === 0 ? '1st' : '2nd'}
                      </span>
                    )}
                    <span className="text-3xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)] transform group-hover:scale-110 transition-transform">
                      {elem.emoji}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      {elem.id}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* FUSION DETAILS CHIP */}
            <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[9px] font-black tracking-widest uppercase text-indigo-400 block mb-1">융합 궁극기 대기중</span>
              <p className="text-sm font-bold text-white">{activeFusion.name}</p>
              <p className="text-[10px] text-slate-400 leading-normal mt-1">{activeFusion.desc}</p>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Realtime Canvas/Combat view */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          
          {/* QUEUE CONTROLLER BAR */}
          <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 shadow-xl backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className={`w-3.5 h-3.5 rounded-full ${
                queueStatus === 'connected' ? 'bg-green-500 shadow-lg shadow-green-500/50' : 
                queueStatus === 'searching' ? 'bg-yellow-500 animate-ping' : 'bg-slate-400'
              }`} />
              <div>
                <span className="font-bold text-sm text-slate-300">
                  {queueStatus === 'connected' ? '실시간 1v1 대전 진행 중' : 
                   queueStatus === 'searching' ? (isPrivateRoom ? `비공개 방 '${roomCode}' 대기 중...` : '대기방 연동 및 상대 탐색 중...') : '전투 준비 인벤토리 완료'}
                </span>
                <p className="text-[11px] text-slate-500">
                  {queueStatus === 'connected' ? '실시간 Supabase WebSockets 동기화 중' : 
                   queueStatus === 'searching' ? (isPrivateRoom ? '친구가 이 방 코드를 입력하고 입장하면 대전이 자동 시작됩니다.' : '상대 플레이어를 검색하고 있습니다. 4.5초 후 매칭이 안 되면 AI와 전투가 매칭됩니다.') : '아래 매칭 버튼을 눌러 격투를 시작하세요.'}
                </p>
              </div>
            </div>

            {/* ACTION TRIGGERS */}
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              {queueStatus === 'idle' ? (
                <button 
                  onClick={startMatchmaking}
                  className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-indigo-400 text-slate-950/90 font-black rounded-lg text-sm uppercase tracking-tighter flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  <Sword size={16} />
                  <span>실시간 매칭 시작</span>
                </button>
              ) : queueStatus === 'searching' ? (
                <button 
                  onClick={cancelMatchmaking}
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 font-bold rounded-lg text-xs tracking-tight flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-red-500/30"
                >
                  <ZapOff size={14} />
                  <span>매칭 매수 취소</span>
                </button>
              ) : (
                <div className="px-4 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-xs font-bold text-green-400 flex items-center gap-1.5">
                  <Crosshair className="animate-spin text-green-400" size={12} />
                  <span>MATCH ACTIVE</span>
                </div>
              )}
            </div>
          </div>

          {/* THE BATTLE GROUND CANV / SVG RENDERER */}
          <div className="bg-slate-900 border-2 border-slate-900 h-[480px] rounded-xl relative overflow-hidden flex flex-col shadow-2xl">
            {/* Grid background overlay styling */}
            <div className="absolute inset-0 opacity-15" style={{
              backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)',
              backgroundSize: '30px 30px'
            }} />

            {/* Timer and Header Health Panels in overlay */}
            {queueStatus === 'connected' && gameState && (
              <div className="absolute top-3 inset-x-4 flex items-center justify-between z-10 pointer-events-none">
                {/* Me character Health/Mana (Side relative) */}
                <div className="w-[180px] bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[11px] text-white truncate max-w-[100px]">{username} (나)</span>
                    <span className="font-mono text-[10px] text-indigo-400 font-bold">HP {Math.round(myPlayerState?.health || 100)}</span>
                  </div>
                  {/* Health Bar */}
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-75" 
                      style={{ width: `${Math.max(0, Math.min(100, myPlayerState?.health || 100))}%` }}
                    />
                  </div>
                  {/* Mana Bar */}
                  <div className="flex items-center justify-between mt-1.5 mb-0.5 text-[9px] text-slate-400">
                    <span>마나 기력</span>
                    <span>{Math.round(myPlayerState?.mana || 100)} MP</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-sky-500 transition-all duration-75" 
                      style={{ width: `${Math.max(0, Math.min(100, myPlayerState?.mana || 100))}%` }}
                    />
                  </div>
                </div>

                {/* Core Arena timer */}
                <div className="bg-slate-950/90 px-4 py-2 border-2 border-slate-800 rounded-xl flex flex-col items-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold leading-none">TIME LEFT</span>
                  <span className="font-mono text-2xl font-black text-white">{gameState.timer}s</span>
                </div>

                {/* Opponent Health / Mana */}
                <div className="w-[180px] bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 text-right backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-orange-400 font-bold">HP {Math.round(opponentState?.health || 100)}</span>
                    <span className="font-bold text-[11px] text-white truncate max-w-[100px]">{opponentName}</span>
                  </div>
                  {/* Health Bar */}
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex justify-end">
                    <div 
                      className="h-full bg-red-500 transition-all duration-75" 
                      style={{ width: `${Math.max(0, Math.min(100, opponentState?.health || 100))}%` }}
                    />
                  </div>
                  {/* Mana Bar */}
                  <div className="flex items-center justify-between mt-1.5 mb-0.5 text-[9px] text-slate-400">
                    <span>{Math.round(opponentState?.mana || 100)} MP</span>
                    <span>상대 기력</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden flex justify-end">
                    <div 
                      className="h-full bg-orange-400 transition-all duration-75" 
                      style={{ width: `${Math.max(0, Math.min(100, opponentState?.mana || 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* BATTLE GRID SYSTEM SVG / STICKMAN LAYOUT */}
            {queueStatus === 'connected' && gameState ? (
              <svg 
                viewBox="0 0 1000 480" 
                className="w-full h-full absolute inset-0 select-none"
                style={{
                  transform: gameState.shakeIntensity > 0 
                    ? `translate(${(Math.random() - 0.5) * gameState.shakeIntensity}px, ${(Math.random() - 0.5) * gameState.shakeIntensity}px)` 
                    : 'none'
                }}
              >
                {/* Spawn horizontal Arena floor */}
                <line x1="0" y1="420" x2="1000" y2="420" stroke="#334155" strokeWidth="8" />
                {/* Secondary platform lines for spacing feel */}
                <line x1="100" y1="424" x2="900" y2="424" stroke="#1e293b" strokeWidth="4" />

                {/* Warm active fields from ultimate skills */}
                {gameState.effects.map(eff => {
                  let fill = 'none';
                  let stroke = eff.color;
                  let strokeWidth = 3;
                  let opacity = 0.3;

                  if (eff.type === 'volcano_ground') {
                    fill = `url(#lava-grad-${eff.id})`;
                    opacity = 0.6;
                  } else if (eff.type === 'blackhole' || eff.type === 'void_vacuum') {
                    fill = `url(#hole-grad-${eff.id})`;
                    opacity = 0.5;
                  } else if (eff.type === 'fullscreen_fusion_trigger') {
                    opacity = 0.25;
                    fill = eff.color;
                  }

                  return (
                    <g key={eff.id}>
                      <defs>
                        <radialGradient id={`lava-grad-${eff.id}`}>
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                          <stop offset="60%" stopColor="#f97316" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#7c2d12" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id={`hole-grad-${eff.id}`}>
                          <stop offset="0%" stopColor="#1e1b4b" stopOpacity="1" />
                          <stop offset="50%" stopColor="#4c1d95" stopOpacity="0.7" />
                          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      <circle 
                        cx={eff.x} 
                        cy={eff.y} 
                        r={eff.radius} 
                        fill={fill} 
                        stroke={stroke} 
                        strokeWidth={strokeWidth}
                        opacity={opacity} 
                        className="transition-all duration-300 transform scale-110"
                      />
                    </g>
                  );
                })}

                {/* Sync local particles on screen */}
                {localParticles.map(p => (
                  <circle 
                    key={p.id}
                    cx={p.x}
                    cy={p.y}
                    r={p.size}
                    fill={p.color}
                    opacity={p.alpha}
                  />
                ))}

                {/* Player 1 Render (Stickman) */}
                <g transform={`translate(${gameState.p1.x}, ${gameState.p1.y - 45})`}>
                  {/* Active buffs rendering */}
                  {gameState.p1.isInvincible && (
                    <circle cx="0" cy="-20" r="45" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 4" className="animate-spin" />
                  )}
                  {gameState.p1.isSuperArmor && (
                    <rect x="-24" y="-70" width="48" height="96" rx="8" fill="none" stroke="#a16207" strokeWidth="2.5" />
                  )}
                  {gameState.p1.activeBuffs.some(b => b.type === 'freeze') && (
                    <rect x="-22" y="-65" width="44" height="90" rx="4" fill="#67e8f9" fillOpacity="0.4" stroke="#06b6d4" strokeWidth="2" />
                  )}

                  {/* Character Head */}
                  <circle cx="0" cy="-45" r="14" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
                  {/* Center eye/expression */}
                  <circle cx={gameState.p1.facingLeft ? -4 : 4} cy="-47" r="2.5" fill="#000000" />

                  {/* Body backbone spine */}
                  <line x1="0" y1="-31" x2="0" y2="10" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" />

                  {/* Hands/Arms according to motion state */}
                  <line 
                    x1="0" 
                    y1="-15" 
                    x2={gameState.p1.facingLeft ? -22 : 22} 
                    y2={gameState.p1.isJumping ? -35 : 0} 
                    stroke="#ffffff" 
                    strokeWidth="4.5" 
                    strokeLinecap="round" 
                  />
                  <line 
                    x1="0" 
                    y1="-15" 
                    x2={gameState.p1.facingLeft ? 20 : -20} 
                    y2="-5" 
                    stroke="#ffffff" 
                    strokeWidth="4.5" 
                    strokeLinecap="round" 
                  />

                  {/* Feet/Legs */}
                  <line 
                    x1="0" 
                    y1="10" 
                    x2="-18" 
                    y2="42" 
                    stroke="#ffffff" 
                    strokeWidth="5" 
                    strokeLinecap="round" 
                  />
                  <line 
                    x1="0" 
                    y1="10" 
                    x2="18" 
                    y2="42" 
                    stroke="#ffffff" 
                    strokeWidth="5" 
                    strokeLinecap="round" 
                  />

                  {/* Elemental decorative glows in hands */}
                  <circle 
                    cx={gameState.p1.facingLeft ? -22 : 22} 
                    cy={gameState.p1.isJumping ? -35 : 0} 
                    r="8" 
                    fill={gameState.p1.facingLeft ? '#f97316' : '#eab308'} 
                    opacity="0.8" 
                  />

                  {/* Label tag overhead */}
                  <text x="0" y="-72" textAnchor="middle" fill="#94a3b8" fontSize="10px" fontWeight="bold">
                    {gameState.p1.isStunned ? '⚡ 기절/빙결' : gameState.p1.username}
                  </text>
                </g>

                {/* Player 2 Render (Stickman) */}
                <g transform={`translate(${gameState.p2.x}, ${gameState.p2.y - 45})`}>
                  {/* Active buffs rendering */}
                  {gameState.p2.isInvincible && (
                    <circle cx="0" cy="-20" r="45" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 4" className="animate-spin" />
                  )}
                  {gameState.p2.isSuperArmor && (
                    <rect x="-24" y="-70" width="48" height="96" rx="8" fill="none" stroke="#a16207" strokeWidth="2.5" />
                  )}
                  {gameState.p2.activeBuffs.some(b => b.type === 'freeze') && (
                    <rect x="-22" y="-65" width="44" height="90" rx="4" fill="#67e8f9" fillOpacity="0.4" stroke="#06b6d4" strokeWidth="2" />
                  )}

                  {/* Character Head */}
                  <circle cx="0" cy="-45" r="14" fill="#ff4d4d" stroke="#f87171" strokeWidth="2" className="filter drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  {/* Center eye */}
                  <circle cx={gameState.p2.facingLeft ? -4 : 4} cy="-47" r="2.5" fill="#ffffff" />

                  {/* Body backbone spine */}
                  <line x1="0" y1="-31" x2="0" y2="10" stroke="#f87171" strokeWidth="5.5" strokeLinecap="round" />

                  {/* Hands/Arms */}
                  <line 
                    x1="0" 
                    y1="-15" 
                    x2={gameState.p2.facingLeft ? -22 : 22} 
                    y2={gameState.p2.isJumping ? -25 : 5} 
                    stroke="#f87171" 
                    strokeWidth="4.5" 
                    strokeLinecap="round" 
                  />
                  <line 
                    x1="0" 
                    y1="-15" 
                    x2={gameState.p2.facingLeft ? 20 : -20} 
                    y2="0" 
                    stroke="#f87171" 
                    strokeWidth="4.5" 
                    strokeLinecap="round" 
                  />

                  {/* Feet/Legs */}
                  <line 
                    x1="0" 
                    y1="10" 
                    x2="-18" 
                    y2="42" 
                    stroke="#f87171" 
                    strokeWidth="5" 
                    strokeLinecap="round" 
                  />
                  <line 
                    x1="0" 
                    y1="10" 
                    x2="18" 
                    y2="42" 
                    stroke="#f87171" 
                    strokeWidth="5" 
                    strokeLinecap="round" 
                  />

                  {/* Hand element core effect */}
                  <circle 
                    cx={gameState.p2.facingLeft ? -22 : 22} 
                    cy={gameState.p2.isJumping ? -25 : 5} 
                    r="8" 
                    fill="#a855f7" 
                    opacity="0.8" 
                  />

                  {/* Label tag overhead */}
                  <text x="0" y="-72" textAnchor="middle" fill="#f87171" fontSize="10px" fontWeight="bold">
                    {gameState.p2.isStunned ? '🔒 억압상태' : gameState.p2.username}
                  </text>
                </g>

                {/* Projectiles Sync Display */}
                {gameState.projectiles.map(p => (
                  <g key={p.id}>
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r={p.radius} 
                      fill={p.color} 
                      className="filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                    />
                    {/* Tiny trailing flare vector */}
                    <circle 
                      cx={p.x - (p.vx * 1.5)} 
                      cy={p.y - (p.vy * 1.5)} 
                      r={p.radius * 0.7} 
                      fill={p.color} 
                      opacity="0.4"
                    />
                  </g>
                ))}
              </svg>
            ) : (
              /* IDLE STATE / LOBBY PREVIEW WRAPPERS */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative z-10">
                <div className="absolute -inset-10 bg-indigo-500/5 rounded-full blur-3xl aurora-pulse"></div>

                <div className="relative mb-6">
                  {/* Outer aura circles matching primary chosen element colors */}
                  <div className="absolute -inset-12 bg-indigo-600/10 rounded-full blur-3xl animate-pulse"></div>
                  
                  {/* Decorative Stickman Preview */}
                  <svg width="180" height="260" viewBox="0 0 100 170" className="relative filter drop-shadow-[0_0_12px_rgba(99,102,241,0.3)]">
                    <circle cx="50" cy="24" r="14" fill="white" />
                    <circle cx="50" cy="24" r="14" fill="none" stroke="#6366f1" strokeWidth="2" />
                    <line x1="50" y1="38" x2="50" y2="105" stroke="white" strokeWidth="6" strokeLinecap="round" />
                    <path d="M50 50 L12 90 M50 50 L88 90" stroke="white" strokeWidth="5.5" strokeLinecap="round" />
                    <path d="M50 105 L22 165 M50 105 L78 165" stroke="white" strokeWidth="6" strokeLinecap="round" />
                    
                    {/* Visual energy lines linking current dual selections */}
                    <circle cx="12" cy="90" r="7" fill={ELEMENTS_LIST.find(x => x.id === selectedElements[0])?.color || '#ef4444'} />
                    <circle cx="88" cy="90" r="7" fill={ELEMENTS_LIST.find(x => x.id === selectedElements[1])?.color || '#eab308'} />
                  </svg>
                </div>

                <div className="max-w-md">
                  <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white">
                    {selectedElements.length === 2 
                      ? `${ELEMENTS_LIST.find(x => x.id === selectedElements[0])?.name.split(' ')[0]} + ${ELEMENTS_LIST.find(x => x.id === selectedElements[1])?.name.split(' ')[0]}`
                      : '원소 충전 대기 중'}
                  </h3>
                  <p className="text-indigo-400 font-mono text-xs tracking-widest font-black uppercase mt-1">
                    융합 상태: {activeFusion.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                    선택한 두 가지 원소의 에너지가 결합되어 전장에서 R키를 누르면 고유한 융합 필살기가 가동됩니다. 실시간 매칭 서비스를 시작해 전장으로 돌입하세요.
                  </p>
                </div>
              </div>
            )}

            {/* COUNTDOWN OVERLAYS DURING FOUND MATCHES */}
            {countdownMsg && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-30 pointer-events-none">
                <span className="text-[12px] uppercase font-bold tracking-widest text-indigo-400 mb-2 animate-bounce">
                  실시간 전투방 생성 완료
                </span>
                <span className="text-6xl font-black text-white italic tracking-tighter scale-125 transition-all">
                  {countdownMsg}
                </span>
              </div>
            )}

            {/* BATTLE VICTORY / DEFEAT POPUP OVERLAY */}
            {isFinished && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center mb-4">
                  <Trophy className="text-indigo-400" size={24} />
                </div>
                <h3 className="text-3xl font-black italic uppercase text-white tracking-widest">대전 종료</h3>
                <p className="text-sm font-semibold text-slate-300 mt-2 max-w-sm leading-relaxed">
                  {winnerMessage}
                </p>
                <div className="mt-6 flex gap-3">
                  <button 
                    onClick={startMatchmaking} 
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-all cursor-pointer shadow-lg"
                  >
                    새로운 대전 시작
                  </button>
                  <button 
                    onClick={() => setIsFinished(false)} 
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg transition-all cursor-pointer"
                  >
                    대기 화면으로
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* HUD & REALTIME SKILL CONTROLS PANEL */}
          <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 shadow-xl backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Skill 1 (A) */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => castSpellDirectly('A')}
                  disabled={queueStatus !== 'connected'}
                  className="w-11 h-11 bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-500/30 font-black text-sm rounded flex flex-col items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 select-none"
                >
                  <span className="text-[10px] text-slate-400 font-mono">Sp1</span>
                  <span className="font-mono text-base font-bold leading-none mt-0.5">1 / Z</span>
                </button>
                <div>
                  <p className="text-xs font-bold text-slate-200">
                    {ELEMENTS_LIST.find(x => x.id === (queueStatus === 'connected' ? p1Elems[0] : selectedElements[0]))?.skills.s1.name || '스킬 1'}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-none mt-1">마나 25 소모</p>
                </div>
              </div>

              {/* Skill 2 (S) */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => castSpellDirectly('S')}
                  disabled={queueStatus !== 'connected'}
                  className="w-11 h-11 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 border border-yellow-500/30 font-black text-sm rounded flex flex-col items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 select-none"
                >
                  <span className="text-[10px] text-slate-400 font-mono">Sp2</span>
                  <span className="font-mono text-base font-bold leading-none mt-0.5">2 / X</span>
                </button>
                <div>
                  <p className="text-xs font-bold text-slate-200">
                    {ELEMENTS_LIST.find(x => x.id === (queueStatus === 'connected' ? p1Elems[1] : selectedElements[1]))?.skills.s2.name || '스킬 2'}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-none mt-1">마나 20 소모</p>
                </div>
              </div>

              {/* Fusion Ultimate R */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => castSpellDirectly('R')}
                  disabled={queueStatus !== 'connected' || (myPlayerState && myPlayerState.ultiGauge < 100)}
                  className={`w-11 h-11 font-black text-sm rounded flex flex-col items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 select-none ${
                    myPlayerState && myPlayerState.ultiGauge >= 100 
                      ? 'bg-indigo-600 text-white border-2 border-indigo-400 animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.5)]' 
                      : 'bg-indigo-900/20 text-indigo-400 border border-indigo-500/30'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 font-mono">ULT</span>
                  <span className="font-mono text-base font-bold leading-none mt-0.5">3 / R</span>
                </button>
                <div>
                  <p className="text-xs font-bold text-indigo-300">{activeFusion.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 leading-none">
                    <span className="text-[10px] font-mono text-slate-400">게이지:</span>
                    <span className={`text-[10px] font-bold font-mono ${myPlayerState?.ultiGauge && myPlayerState.ultiGauge >= 100 ? 'text-green-400' : 'text-slate-400'}`}>
                      {Math.round(myPlayerState?.ultiGauge || 0)} / 100
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Key guide banner triggers */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-950 px-3 py-2 rounded-lg border border-slate-900">
              <Keyboard size={13} className="text-slate-400 animate-pulse" />
              <span>좌우 이동: <strong className="text-slate-200">◀▶/AD</strong> | 점프: <strong className="text-slate-200">▲/Space</strong></span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Supabase rankings leaderboard */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-5 shadow-xl backdrop-blur-sm flex-1 flex flex-col">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Trophy size={14} className="text-yellow-500" />
                <span>실시간 누적 랭킹</span>
              </span>
              <button onClick={fetchRankings} className="text-xs text-indigo-400 font-semibold hover:underline">
                새로고침
              </button>
            </h2>

            <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
              {rankings.map((rank, idx) => {
                const isMe = rank.username.toLowerCase() === username.toLowerCase();
                return (
                  <div 
                    key={rank.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${
                      isMe 
                        ? 'bg-indigo-900/20 border-indigo-500/40 text-white' 
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-xs font-black ${
                        idx === 0 ? 'text-yellow-500 text-base' : 
                        idx === 1 ? 'text-slate-300' : 
                        idx === 2 ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        #{idx + 1}
                      </span>
                      <span className="font-semibold truncate max-w-[100px]">{rank.username}</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                      {rank.win_count} Wins
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto pt-4 border-t border-slate-900 text-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">전투 종료 시 승리 횟수 실시간 집계</span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Footer Stats Section */}
      <footer className="h-14 bg-slate-950 border-t border-slate-900 px-6 flex items-center justify-between shrink-0">
        <div className="flex gap-8 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Server Status:</span> <span className="text-white">Asia East-1 (Express Active)</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span>Latency:</span> <span className="text-green-400 font-mono">15ms</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">
          Supabase Connected &bull; WebSocket Realtime Node Server
        </div>
      </footer>

      {/* SUPABASE SQL SCHEMATICS DRAWER MODAL UP */}
      {showDdlPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in-50">
            <div className="p-6 border-b border-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shield className="text-indigo-400" size={20} />
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">Supabase PostgreSQL DDL Schema</h3>
              </div>
              <button 
                onClick={() => setShowDdlPopup(false)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                닫기
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Supabase DB를 본 따 구현된 로컬 SQLite DB가 작동하고 있습니다. 동명의 진짜 Supabase 대시보드에 연동하고 싶다면, 아래 테이블 생성 DDL 쿼리를 복사하여 Supabase SQL Editor에 입력해 실행하면 모든 실시간 실체가 매핑 가동됩니다:
              </p>
              
              <div className="relative">
                <pre className="p-4 bg-slate-900 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto max-h-[220px]">
                  {ddlText}
                </pre>
                
                <button 
                  onClick={handleCopyDdl}
                  className="absolute top-2 right-2 bg-slate-950 hover:bg-slate-800 text-indigo-400 border border-slate-800 p-2 rounded-lg cursor-pointer flex items-center gap-1 text-xs"
                >
                  {copiedDdl ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  <span>{copiedDdl ? '복사 완료' : '코드 복사'}</span>
                </button>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setShowDdlPopup(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-lg cursor-pointer"
                >
                  스키마 모달 닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
