import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { RotateCcw, RefreshCw, Trophy, Sparkles, Sun, Moon, Info, Unlock } from 'lucide-react';

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
  const [showWinModal, setShowWinModal] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

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
    const filledPegCount = config.colorCount; // Leave 1 or more empty pegs
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
  // When all required colors are sorted into single-color stacks of exact count
  const checkWinCondition = (currentPegs) => {
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
      setTimerRunning(false);
      setShowWinModal(true);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      return true;
    }
    return false;
  };

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

        setPegs(newPegs);
        setSelectedPeg(null);
        setMoves(m => m + 1);

        if (!timerRunning && moves === 0) {
          setTimerRunning(true);
        }

        checkWinCondition(newPegs);
      } else {
        setSelectedPeg(null);
      }
    }
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col items-center py-6 px-4 font-sans">
        
        {/* Header */}
        <header className="w-full max-w-4xl flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Color Dice Swap Puzzle
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Free Transfer & Sorting Mode
              </p>
            </div>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title="Toggle Dark Mode"
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
        </header>

        {/* Difficulty Selection Bar */}
        <div className="w-full max-w-4xl mb-6 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-extrabold uppercase text-slate-400 px-2">
            Select Difficulty:
          </span>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            {Object.keys(DIFFICULTY_SETTINGS).map((level) => {
              const isActive = difficulty === level;
              return (
                <button
                  key={level}
                  onClick={() => handleDifficultyChange(level)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black capitalize transition-all border ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>

          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
            {currentConfig.label}
          </span>
        </div>

        {/* Stats & Actions */}
        <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Moves</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{moves}</span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Time</span>
            <span className="text-2xl font-black font-mono text-slate-700 dark:text-slate-200">{formatTime(timer)}</span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
            <button
              onClick={() => initGame(difficulty)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button
              onClick={() => initGame(difficulty)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition"
            >
              <RefreshCw className="w-4 h-4" /> Scramble
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <Unlock className="w-4 h-4" />
          Click any pole to pick up top dice, then click ANY other pole to transfer it!
        </div>

        {/* 2D Stage */}
        <main className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 flex flex-col items-center relative overflow-hidden">
          
          <div 
            className="w-full flex justify-around items-end relative pb-4 select-none transition-all duration-300"
            style={{ height: `${currentConfig.maxCapacity * 32 + 60}px` }}
          >
            {pegs.map((stack, pegIdx) => {
              const isSelected = selectedPeg === pegIdx;

              return (
                <div
                  key={`peg-${pegIdx}`}
                  onClick={() => handlePegClick(pegIdx)}
                  className="relative flex flex-col items-center justify-end h-full flex-1 max-w-[130px] cursor-pointer group"
                >
                  {/* Selection Border */}
                  <div
                    className={`absolute inset-0 rounded-2xl transition-all ${
                      isSelected
                        ? 'bg-indigo-500/10 border-2 border-indigo-500'
                        : 'group-hover:bg-slate-100 dark:group-hover:bg-slate-700/50'
                    }`}
                  />

                  {/* 2D Flat Pole Bar (height matches maxCapacity dice) */}
                  <div 
                    className="w-4 bg-slate-300 dark:bg-slate-600 rounded-t-lg z-0 relative transition-all duration-300"
                    style={{ height: `${currentConfig.maxCapacity * 30 + 12}px` }}
                  />

                  {/* Stack of 2D Dice Blocks */}
                  <div className="absolute bottom-4 flex flex-col-reverse items-center w-full z-10">
                    <AnimatePresence mode="popLayout">
                      {stack.map((item, stackIdx) => {
                        const isTopItem = stackIdx === stack.length - 1;
                        const isLifted = isSelected && isTopItem;
                        const colorInfo = ALL_COLORS[item.colorIndex];

                        return (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ y: -100, opacity: 0 }}
                            animate={{ 
                              y: isLifted ? -35 : 0, 
                              opacity: 1 
                            }}
                            exit={{ y: -60, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className={`w-[86%] h-6 sm:h-7 my-0.5 rounded-md ${colorInfo.bg} border ${colorInfo.border} z-20 shadow-xs`}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  <div className="mt-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase z-10">
                    Pole {pegIdx + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Flat Base */}
          <div className="w-full h-4 bg-amber-400 rounded-lg border-t-2 border-amber-500 z-10" />
        </main>

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
                  Puzzle Solved!
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  You successfully sorted all dice blocks onto matching poles!
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

      </div>
    </div>
  );
}
