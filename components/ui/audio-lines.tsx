"use client";

import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export interface AudioLinesIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
  setStream: (stream: MediaStream | null) => void;
}

interface AudioLinesIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  stream?: MediaStream | null;
}

const AudioLinesIcon = forwardRef<AudioLinesIconHandle, AudioLinesIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, stream: externalStream = null, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);
    const streamRef = useRef<MediaStream | null>(externalStream);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationRef = useRef<number>(0);
    const frequencyDataRef = useRef<Uint8Array | null>(null);
    const isHoveringRef = useRef(false);
    const [audioFrequencies, setAudioFrequencies] = useState<number[]>([0, 0, 0, 0, 0]);

    // Initialize audio context when stream changes
    useEffect(() => {
      if (externalStream) {
        streamRef.current = externalStream;
        initializeAudioContext(externalStream);
      }
    }, [externalStream]);

    const initializeAudioContext = useCallback((stream: MediaStream) => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyser);
        analyserRef.current = analyser;

        frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        startAudioAnalysis();
      } catch (err) {
        console.error("Failed to initialize audio context:", err);
      }
    }, []);

    const startAudioAnalysis = useCallback(() => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      const analyze = () => {
        if (analyserRef.current && frequencyDataRef.current) {
          analyserRef.current.getByteFrequencyData(
            frequencyDataRef.current as any
          );

          const barCount = 5;
          const frequencies: number[] = [];

          for (let i = 0; i < barCount; i++) {
            const idx = Math.floor((i / barCount) * frequencyDataRef.current.length);
            const frequency = (frequencyDataRef.current[idx] || 0) / 255;
            frequencies.push(Math.max(0.1, frequency));
          }

          setAudioFrequencies(frequencies);
        }

        animationRef.current = requestAnimationFrame(analyze);
      };

      analyze();
    }, []);

    useImperativeHandle(ref, () => ({
      startAnimation: () => {
        isControlledRef.current = true;
        if (analyserRef.current) {
          startAudioAnalysis();
        } else {
          controls.start("animate");
        }
      },
      stopAnimation: () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        setAudioFrequencies([0, 0, 0, 0, 0]);
        controls.start("normal");
      },
      setStream: (newStream: MediaStream | null) => {
        streamRef.current = newStream;
        if (newStream) {
          initializeAudioContext(newStream);
        } else {
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          setAudioFrequencies([0, 0, 0, 0, 0]);
        }
      },
    }));

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        isHoveringRef.current = true;
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        isHoveringRef.current = false;
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    // Generate SVG paths based on audio frequencies
    const generatePath = (baseHeight: number, frequency: number): string => {
      const midY = 12;
      const maxHeight = baseHeight * frequency;
      const topY = midY - maxHeight;
      const bottomY = midY + maxHeight;
      return `M${0} ${topY}L${0} ${bottomY}`;
    };

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Static left edge */}
          <path d="M2 10v3" />

          {/* Animated frequency bars */}
          <motion.path
            animate={controls}
            d={analyserRef.current ? generatePath(6, audioFrequencies[0]) : "M6 6v11"}
            variants={{
              normal: { d: "M6 6v11" },
              animate: {
                d: ["M6 6v11", "M6 10v3", "M6 6v11"],
                transition: {
                  duration: 1.5,
                  repeat: Number.POSITIVE_INFINITY,
                },
              },
            }}
          />
          <motion.path
            animate={controls}
            d={analyserRef.current ? generatePath(9, audioFrequencies[1]) : "M10 3v18"}
            variants={{
              normal: { d: "M10 3v18" },
              animate: {
                d: ["M10 3v18", "M10 9v5", "M10 3v18"],
                transition: {
                  duration: 1,
                  repeat: Number.POSITIVE_INFINITY,
                },
              },
            }}
          />
          <motion.path
            animate={controls}
            d={analyserRef.current ? generatePath(7, audioFrequencies[2]) : "M14 8v7"}
            variants={{
              normal: { d: "M14 8v7" },
              animate: {
                d: ["M14 8v7", "M14 6v11", "M14 8v7"],
                transition: {
                  duration: 0.8,
                  repeat: Number.POSITIVE_INFINITY,
                },
              },
            }}
          />
          <motion.path
            animate={controls}
            d={analyserRef.current ? generatePath(8, audioFrequencies[3]) : "M18 5v13"}
            variants={{
              normal: { d: "M18 5v13" },
              animate: {
                d: ["M18 5v13", "M18 7v9", "M18 5v13"],
                transition: {
                  duration: 1.5,
                  repeat: Number.POSITIVE_INFINITY,
                },
              },
            }}
          />

          {/* Static right edge */}
          <path d="M22 10v3" />
        </svg>
      </div>
    );
  }
);

AudioLinesIcon.displayName = "AudioLinesIcon";

export { AudioLinesIcon };
