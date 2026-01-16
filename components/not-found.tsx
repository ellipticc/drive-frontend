"use client";

import { IconRocket, IconArrowLeft } from "@tabler/icons-react";
import { motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#020617] text-slate-50 selection:bg-indigo-500/30">
      {/* Space Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated Background Orbs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
            x: [0, 100, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-48 -left-48 size-[800px] rounded-full bg-indigo-600/10 blur-[150px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.15, 0.3, 0.15],
            x: [0, -80, 0],
            y: [0, 100, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-96 -right-48 size-[900px] rounded-full bg-purple-600/10 blur-[180px]"
        />

        {/* Star Particles */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.2) 1px, transparent 0)',
          backgroundSize: '48px 48px'
        }} />

        {/* Floating Space Dust */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: Math.random() * 2000 - 1000,
              y: Math.random() * 2000 - 1000,
              opacity: Math.random() * 0.5
            }}
            animate={{
              x: Math.random() * 2000 - 1000,
              y: Math.random() * 2000 - 1000,
              opacity: [0.2, 0.5, 0.2]
            }}
            transition={{
              duration: 20 + Math.random() * 20,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute size-1 bg-white rounded-full blur-[1px]"
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-4xl px-8 text-center">
        {/* Main Illustration Wrapper */}
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-12"
        >
          {/* Subtle Glow Behind Image */}
          <div className="absolute inset-0 bg-indigo-500/10 blur-[100px] rounded-full scale-75 translate-y-12" />

          <motion.div
            animate={{
              y: [0, -25, 0],
              rotate: [-1.5, 1.5, -1.5]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="relative"
          >
            <Image
              src="/404.svg"
              alt="Lost in Space Illustration"
              width={750}
              height={500}
              priority
              className="drop-shadow-[0_30px_60px_rgba(79,70,229,0.25)] select-none pointer-events-none"
            />
          </motion.div>
        </motion.div>

        {/* Content Section */}
        <div className="space-y-8 max-w-xl mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-4"
          >
            <h1 className="text-5xl md:text-7xl font-[950] tracking-tighter text-white drop-shadow-2xl">
              Lost in Space?
            </h1>
            <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed">
              It looks like you&apos;ve drifted away from the mothership.
              Even the best pioneers lose their transmission sometimes.
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4"
          >
            <Button
              asChild
              size="lg"
              className="h-14 px-10 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] transition-all hover:-translate-y-1 active:scale-[0.98]"
            >
              <Link href="/" className="flex items-center gap-3">
                <IconRocket className="size-6 stroke-[2.5]" />
                Take me back to my files!
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-14 px-10 rounded-2xl border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white font-bold backdrop-blur-xl transition-all active:scale-[0.98]"
            >
              <Link href="/" className="flex items-center gap-3">
                <IconArrowLeft className="size-6 stroke-[2.5]" />
                Abort Mission
              </Link>
            </Button>
          </motion.div>
        </div>

        {/* Gigantic Background 404 Text */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.03, scale: 1 }}
          transition={{ delay: 0.8, duration: 2.5 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-[1000] text-[40vw] text-white pointer-events-none select-none -z-10 leading-none"
        >
          404
        </motion.div>
      </div>

      {/* Floating Indicators / UI Elements */}
      <div className="absolute bottom-12 left-12 hidden lg:flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500/50">
        <div className="size-2 rounded-full bg-indigo-500 animate-pulse" />
        Connection Lost... Searching for Drive
      </div>
    </div>
  );
}
