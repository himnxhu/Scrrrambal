import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { RotateCcw, RefreshCw, Trophy, Sparkles, Sun, Moon, Unlock, Users, Copy, Check, Link, Globe, ShieldAlert } from 'lucide-react';
import Peer from 'peerjs';

// 6 Clean 2D Colors for scaling difficulties
const ALL_COLORS = [
  { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-500', border: 'border-cyan-600' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-500', border: 'border-rose-600' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-400', border: 'border-amber-500' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-500', border: 'border-purple-600' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500', border: 'border-emerald-600' },
  { id: 'orange', name: 'Orange', bg: 'bg-orange-500', border: 'border-orange-600' },
];

const DIFFICULTY_SETTINGS = {
  easy: { name: 'Easy', colorCount: 3, pegCount: 4, itemsPerColor: 5, maxCapacity: 5, label: '3 Colors (5 Dice ea.) • Limit 5/Pole' },
  medium: { name: 'Medium', colorCount: 4, pegCount: 5, itemsPerColor: 6, maxCapacity: 6, label: '4 Colors (6 Dice ea.) • Limit 6/Pole' },
  hard: { name: 'Hard', colorCount: 5, pegCount: 6, itemsPerColor: 8, maxCapacity: 8, label: '5 Colors (8 Dice ea.) • Limit 8/Pole' },
};

export default function DifficultyColorGame() {
  const [difficulty, setDifficulty] = useState('medium');
  const currentConfig = DIFFICULTY_SETTINGS[difficulty];

  const [pegs, setPegs] = useState([]);
  const [selectedPeg, setSelectedPeg] = useState(null);
  const [moves, setMoves] = useState(0);
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [winnerName, setWinnerName] = useState(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Multiplayer State
  const [myPeerId, setMyPeerId] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [opponentProgress, setOpponentProgress] = useState(null); // { moves, time, won }
  const [peerError, setPeerError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);

  const peerRef = useRef(null);
  const connRef = useRef(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // PeerJS setup
  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyPeerId(id);
    });

    peer.on('connection', (conn) => {
      connRef.current = conn;
      setIsHost(true);
      setIsConnected(true);
      setPeerError(null);
      setupConnectionListeners(conn);
      
      // Sync initial game board to guest
      const currentBoardState = {
        type: 'INIT_GAME',
        difficulty,
        pegs: pegsRef.current
      };
      conn.send(currentBoardState);
    });

    peer.on('error', (err) => {
      setPeerError('Connection error: ' + err.message);
      setIsConnecting(false);
    });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const pegsRef = useRef(pegs);
  useEffect(() => {
    pegsRef.current = pegs;
  }, [pegs]);

  const setupConnectionListeners = (conn) => {
    conn.on('data', (data) => {
      if (data.type === 'INIT_GAME') {
        setDifficulty(data.difficulty);
        setPegs(data.pegs);
        setMoves(0);
        setTimer(0);
        setTimerRunning(false);
        setHasWon(false);
        setShowWinModal(false);
        setWinnerName(null);
        setOpponentProgress(null);
      } else if (data.type === 'SYNC_MOVE') {
        setOpponentProgress({
          moves: data.moves,
          timer: data.timer,
          won: data.won
        });
        if (data.won) {
          setWinnerName('Opponent');
          setShowWinModal(true);
          setTimerRunning(false);
        }
      } else if (data.type === 'RESTART_GAME') {
        setPegs(data.pegs);
        setMoves(0);
        setTimer(0);
        setTimerRunning(false);
        setHasWon(false);
        setShowWinModal(false);
        setWinnerName(null);
        setOpponentProgress(null);
      }
    });

    conn.on('close', () => {
      setIsConnected(false);
      setOpponentProgress(null);
      setPeerError('Opponent disconnected.');
    });
  };

  const createRoom = () => {
    setIsHost(true);
    setShowMultiplayerModal(true);
  };

  const joinRoom = () => {
    if (!roomCodeInput.trim()) return;
    setIsConnecting(true);
    setPeerError(null);

    const conn = peerRef.current.connect(roomCodeInput.trim().toLowerCase());
    connRef.current = conn;

    conn.on('open', () => {
      setIsConnecting(false);
      setIsConnected(true);
      setIsHost(false);
      setShowMultiplayerModal(false);
      setupConnectionListeners(conn);
    });

    conn.on('error', (err) => {
      setPeerError('Failed to join room: ' + err.message);
      setIsConnecting(false);
    });
  };

  const copyRoomCode = () => {
    if (!myPeerId) return;
    navigator.clipboard.writeText(myPeerId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Initialize & Scramble based on chosen difficulty
  const initGame = (diffKey = difficulty) => {
    const config = DIFFICULTY_SETTINGS[diffKey];
    let pool = [];
    for (let c = 0; c < config.colorCount; c++) {
      for (let r = 0; r < config.itemsPerColor; r++) {
        pool.push(c);
      }
    }

    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const newPegs = Array.from({ length: config.pegCount }, () => []);
    let idx = 0;
    const filledPegCount = config.colorCount;
    for (let p = 0; p < filledPegCount; p++) {
      for (let r = 0; r < config.itemsPerColor; r++) {
        newPegs[p].push({
          id: `dice-${p}-${r}-${Math.random().toString(36).substr(2, 4)}`,
          colorIndex: pool[idx++]
        });
      }
    }

    setPegs(newPegs);
    setSelectedPeg(null);
    setMoves(0);
    setTimer(0);
    setTimerRunning(false);
    setHasWon(false);
    setShowWinModal(false);
    setWinnerName(null);
    setOpponentProgress(null);

    // If in multiplayer and host, send board state to opponent
    if (isConnected && connRef.current) {
      connRef.current.send({
        type: 'RESTART_GAME',
        pegs: newPegs
      });
    }
  };

  useEffect(() => {
    initGame(difficulty);
  }, [difficulty]);

  useEffect(() => {
    let interval = null;
    if (timerRunning && !hasWon) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, hasWon]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleDifficultyChange = (newDiff) => {
    setDifficulty(newDiff);
  };

  // Check Win Condition:
  const checkWinCondition = (currentPegs, currentMoves, currentTimer) => {
    let sortedPegCount = 0;
    for (let p = 0; p < currentPegs.length; p++) {
      const stack = currentPegs[p];
      if (stack.length === 0) continue;

      if (stack.length === currentConfig.itemsPerColor) {
        const firstColor = stack[0].colorIndex;
        const allSame = stack.every(item => item.colorIndex === firstColor);
        if (allSame) sortedPegCount++;
      } else {
        return false;
      }
    }

    if (sortedPegCount === currentConfig.colorCount) {
      setHasWon(true);
      setWinnerName('You');
      setTimerRunning(false);
      setShowWinModal(true);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });

      if (isConnected && connRef.current) {
        connRef.current.send({
          type: 'SYNC_MOVE',
          moves: currentMoves,
          timer: currentTimer,
          won: true
        });
      }
      return true;
    }
    return false;
  };

  const [limitAlert, setLimitAlert] = useState(null);

  const handlePegClick = (pegIdx) => {
    if (hasWon) return;

    if (selectedPeg === null) {
      if (pegs[pegIdx].length > 0) {
        setSelectedPeg(pegIdx);
      }
    } else if (selectedPeg === pegIdx) {
      setSelectedPeg(null);
    } else {
      const sourcePeg = selectedPeg;
      const targetPeg = pegIdx;

      const sourceStack = [...pegs[sourcePeg]];
      const targetStack = [...pegs[targetPeg]];

      if (sourceStack.length === 0) {
        setSelectedPeg(null);
        return;
      }

      if (targetStack.length < currentConfig.maxCapacity) {
        const itemToMove = sourceStack.pop();
        targetStack.push(itemToMove);

        const newPegs = [...pegs];
        newPegs[sourcePeg] = sourceStack;
        newPegs[targetPeg] = targetStack;

        const newMoves = moves + 1;
        setPegs(newPegs);
        setSelectedPeg(null);
        setMoves(newMoves);

        if (!timerRunning && moves === 0) {
          setTimerRunning(true);
        }

        const isWin = checkWinCondition(newPegs, newMoves, timer);

        // Sync move to multiplayer opponent
        if (isConnected && connRef.current && !isWin) {
          connRef.current.send({
            type: 'SYNC_MOVE',
            moves: newMoves,
            timer,
            won: false
          });
        }
      } else {
        setLimitAlert(`Pole ${targetPeg + 1} has reached its limit (${currentConfig.maxCapacity} dice max)!`);
        setTimeout(() => {
          setLimitAlert(null);
        }, 3000);
        setSelectedPeg(null);
      }
    }
  };

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={darkMode ? 'dark' : ''}>
      {/* Page Load / Refresh Splash Screen Animation */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
            className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center text-white"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring", stiffness: 260, damping: 20 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                  className="absolute inset-0 -m-3 rounded-3xl border-2 border-dashed border-indigo-500/50"
                />
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/50">
                  <Sparkles className="w-10 h-10 text-white animate-bounce" />
                </div>
              </div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-center"
              >
                <h1 className="text-3xl font-black tracking-wider text-white mb-1">
                  Scrrrambal
                </h1>
                <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">
                  Loading Game World...
                </p>
              </motion.div>

              {/* Animated Dice Bars Loader */}
              <div className="flex gap-1.5 mt-2">
                {['bg-cyan-500', 'bg-rose-500', 'bg-amber-400', 'bg-purple-500'].map((color, i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [-4, 4, -4] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                    className={`w-3 h-8 rounded-full ${color}`}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 15 : 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col items-center py-4 px-2 sm:px-4 font-sans safe-padding"
      >
        
        {/* Header */}
        <header className="w-full max-w-4xl flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 sm:p-3 bg-indigo-600 rounded-2xl text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                Scrrrambal
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isConnected ? '🔴 Live 1v1 Race' : 'Free Transfer & Sorting Mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMultiplayerModal(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 touch-manipulation border ${
                isConnected
                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                  : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{isConnected ? 'Friends Room Active' : 'Play with Friends'}</span>
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition active:scale-95 touch-manipulation"
              title="Toggle Dark Mode"
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
          </div>
        </header>

        {/* Live Multiplayer Status Bar (if connected) */}
        {isConnected && (
          <div className="w-full max-w-4xl mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                Connected with Opponent!
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold">
              <div>
                <span className="text-slate-400 mr-1">Opponent Moves:</span>
                <span className="text-slate-800 dark:text-white font-mono">{opponentProgress?.moves || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Difficulty Selection Bar */}
        <div className="w-full max-w-4xl mb-4 bg-white dark:bg-slate-800 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            <span className="text-[10px] sm:text-xs font-extrabold uppercase text-slate-400">
              Difficulty:
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 sm:hidden">
              {currentConfig.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:flex-1 sm:max-w-md">
            {Object.keys(DIFFICULTY_SETTINGS).map((level) => {
              const isActive = difficulty === level;
              return (
                <button
                  key={level}
                  onClick={() => handleDifficultyChange(level)}
                  disabled={isConnected && !isHost}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-black capitalize transition-all border touch-manipulation active:scale-95 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  } ${isConnected && !isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {level}
                </button>
              );
            })}
          </div>

          <span className="hidden sm:inline-block text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
            {currentConfig.label}
          </span>
        </div>

        {/* Stats & Actions */}
        <div className="w-full max-w-4xl grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="bg-white dark:bg-slate-800 p-2.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left">
            <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Moves</span>
            <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">{moves}</span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-2.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left">
            <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Time</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-700 dark:text-slate-200">{formatTime(timer)}</span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-1.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1 sm:gap-2">
            <button
              onClick={() => initGame(difficulty)}
              className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-slate-100 dark:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition touch-manipulation"
              title="Reset current puzzle"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={() => initGame(difficulty)}
              className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-indigo-600 active:bg-indigo-700 text-white font-bold rounded-xl text-xs transition touch-manipulation"
              title="Scramble new puzzle"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Scramble</span>
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-3 text-[11px] sm:text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 w-full max-w-4xl text-center">
          <Unlock className="w-3.5 h-3.5 shrink-0" />
          <span>Tap pole to pick top dice, tap target pole to move!</span>
        </div>

        {/* 2D Stage */}
        <main className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-2 sm:p-6 flex flex-col items-center relative overflow-hidden shadow-sm">
          
          <div 
            className="w-full flex justify-around items-end relative pb-2 select-none transition-all duration-300"
            style={{ height: `${currentConfig.maxCapacity * 30 + 50}px` }}
          >
            {pegs.map((stack, pegIdx) => {
              const isSelected = selectedPeg === pegIdx;
              const isFull = stack.length >= currentConfig.maxCapacity;

              return (
                <div
                  key={`peg-${pegIdx}`}
                  onClick={() => handlePegClick(pegIdx)}
                  className="relative flex flex-col items-center justify-end h-full flex-1 max-w-[120px] cursor-pointer group touch-manipulation px-0.5"
                >
                  {/* Selection Border & Hit Target */}
                  <div
                    className={`absolute inset-0 rounded-xl sm:rounded-2xl transition-all pointer-events-none ${
                      isSelected
                        ? 'bg-indigo-500/15 border-2 border-indigo-500 shadow-md shadow-indigo-500/10'
                        : 'active:bg-slate-100 dark:active:bg-slate-700/50'
                    }`}
                  />

                  {/* 2D Flat Pole Bar (height matches maxCapacity dice) */}
                  <div 
                    className="w-3 sm:w-4 bg-slate-300 dark:bg-slate-600 rounded-t-lg z-0 relative transition-all duration-300 pointer-events-none"
                    style={{ height: `${currentConfig.maxCapacity * 28 + 10}px` }}
                  />

                  {/* Stack of 2D Dice Blocks */}
                  <div className="absolute bottom-3.5 flex flex-col-reverse items-center w-full z-10 px-0.5 pointer-events-none">
                    <AnimatePresence mode="popLayout">
                      {stack.map((item, stackIdx) => {
                        const isTopItem = stackIdx === stack.length - 1;
                        const isLifted = isSelected && isTopItem;
                        const colorInfo = ALL_COLORS[item.colorIndex];

                        return (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ y: -60, opacity: 0 }}
                            animate={{ 
                              y: isLifted ? -30 : 0, 
                              opacity: 1 
                            }}
                            exit={{ y: -40, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 28 }}
                            className={`w-full max-w-[92%] h-5 sm:h-6 my-0.5 rounded sm:rounded-md ${colorInfo.bg} border ${colorInfo.border} z-20 shadow-xs pointer-events-none`}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  <div className="mt-1 text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase z-10">
                    P{pegIdx + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Flat Base */}
          <div className="w-full h-4 bg-amber-400 rounded-lg border-t-2 border-amber-500 z-10" />
        </main>

        {/* Limit Reached Alert Banner (Under Playing Panel) */}
        <AnimatePresence>
          {limitAlert && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="mt-4 w-full max-w-4xl bg-rose-500/15 dark:bg-rose-500/25 border border-rose-500/40 text-rose-600 dark:text-rose-300 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-sm"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 animate-bounce" />
                <span>{limitAlert}</span>
              </div>
              <button 
                onClick={() => setLimitAlert(null)}
                className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 font-extrabold px-1.5"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Multiplayer Room Modal */}
        <AnimatePresence>
          {showMultiplayerModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 max-w-md w-full"
              >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                      Play with Friends
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowMultiplayerModal(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold px-2 py-1"
                  >
                    ✕
                  </button>
                </div>

                {peerError && (
                  <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-xs font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{peerError}</span>
                  </div>
                )}

                {/* Host Section */}
                <div className="mb-6 bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50">
                  <h3 className="text-xs font-extrabold uppercase text-indigo-600 dark:text-indigo-400 mb-2">
                    Host a Game (Share Your Code)
                  </h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={myPeerId || 'Generating room code...'}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-700 dark:text-slate-200"
                    />
                    <button
                      onClick={copyRoomCode}
                      disabled={!myPeerId}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95"
                    >
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Join Section */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-extrabold uppercase text-slate-500 mb-2">
                    Join Opponent Room Code
                  </h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Paste opponent room code..."
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={joinRoom}
                      disabled={isConnecting || !roomCodeInput.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95"
                    >
                      {isConnecting ? 'Connecting...' : 'Join'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Win Modal */}
        <AnimatePresence>
          {showWinModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center"
              >
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500">
                  <Trophy className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                  {winnerName ? `${winnerName} Won!` : 'Puzzle Solved!'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  {winnerName === 'You'
                    ? 'Congratulations! You solved the puzzle first!'
                    : winnerName === 'Opponent'
                    ? 'Your opponent finished sorting their dice first!'
                    : 'You successfully sorted all dice blocks onto matching poles!'}
                </p>

                {/* Score & Time Summary */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 mb-6 grid grid-cols-2 gap-3 text-left">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-slate-400">Total Moves</span>
                    <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{moves}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase text-slate-400">Time Taken</span>
                    <p className="text-xl font-black font-mono text-slate-700 dark:text-slate-200">{formatTime(timer)}</p>
                  </div>
                </div>

                <button
                  onClick={() => initGame(difficulty)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition"
                >
                  Play Again
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
