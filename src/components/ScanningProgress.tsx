import { motion } from "motion/react";
import { useEffect, useState } from "react";

const SCAN_MESSAGES = [
  "Cloning AST structure...",
  "Hunting down unhandled promises...",
  "Verifying UI shell boundaries...",
  "Running reality-check heuristics...",
  "Detecting fake mock data logic...",
  "Evaluating enterprise readiness...",
  "Compiling brutal summary...",
];

export function ScanningProgress({ status }: { status?: string }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    let messageCount = SCAN_MESSAGES.length;
    let initialIndex = status === 'analyzing' ? 2 : 0;
    setMsgIndex(initialIndex);
    
    // Smoothly cycle through messages based on phase
    const interval = setInterval(() => {
      setMsgIndex((prev) => {
         if (status === 'fetching') {
            return prev < 2 ? prev + 1 : 0;
         } else {
            return prev < messageCount - 1 ? prev + 1 : 2;
         }
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [status]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 w-full max-w-2xl mx-auto min-h-[400px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full relative h-[400px] border border-zinc-800 bg-zinc-900/50 rounded-xl p-8 flex flex-col items-center justify-center overflow-hidden shadow-2xl"
      >
        <div className="absolute inset-0 scanner-sweep pointer-events-none opacity-20"></div>

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          className="w-16 h-16 border-t-2 border-emerald-500 rounded-full mb-8 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]"
        ></motion.div>

        <div className="h-6 overflow-hidden drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
          <motion.div
            key={msgIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="text-zinc-400 font-mono text-sm tracking-tight text-center"
          >
            &gt; {SCAN_MESSAGES[msgIndex]}
          </motion.div>
        </div>

        <div className="mt-8 w-full max-w-xs bg-zinc-800 rounded-full h-1 overflow-visible relative">
          <motion.div
            className="bg-emerald-500 h-full drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] rounded-full relative z-10"
            initial={{ width: "0%" }}
            animate={{ width: `${((msgIndex + 1) / SCAN_MESSAGES.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 bg-emerald-500 blur-sm opacity-50"></div>
          </motion.div>
        </div>
      </motion.div>

      <style>{`
        .scanner-sweep {
          background: linear-gradient(to bottom, transparent, rgba(16, 185, 129, 0.2), transparent);
          animation: sweep 3s infinite linear;
        }
        @keyframes sweep {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
}
