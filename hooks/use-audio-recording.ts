import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api';

export type AudioRecordingState = 'idle' | 'recording' | 'processing' | 'transcribing_interim' | 'transcribing_final' | 'done' | 'no_audio_detected';

interface UseAudioRecordingOptions {
    onTranscript?: (text: string, isFinal: boolean) => void;
    onNoAudioDetected?: (hasExistingText: boolean) => void;
    hasExistingText?: () => boolean; // Function to check if there's already text in input
    chunkDurationMs?: number;
    silenceTimeoutMs?: number; // Time in ms before showing "no audio detected" (default 5000ms)
}

export const useAudioRecording = ({
    onTranscript,
    onNoAudioDetected,
    hasExistingText,
    chunkDurationMs = 1500,
    silenceTimeoutMs = 5000,
}: UseAudioRecordingOptions = {}) => {
    const [state, setState] = useState<AudioRecordingState>('idle');
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastAudioLevelRef = useRef<number>(0);

    // Monitor audio levels and detect prolonged silence
    const monitorSilence = useCallback(() => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        
        let silenceCounter = 0;
        const checkInterval = setInterval(() => {
            if (!analyserRef.current) {
                clearInterval(checkInterval);
                return;
            }

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            lastAudioLevelRef.current = average;

            // If volume is below threshold (muted/no audio)
            if (average < 5) {
                silenceCounter++;
                // Trigger after N checks (roughly 5 seconds at ~1 check/sec)
                if (silenceCounter > 5) {
                    setState('no_audio_detected');
                    // Only call callback if no existing text (don't show toast if user is editing)
                    const existingText = hasExistingText?.() ?? false;
                    onNoAudioDetected?.(!existingText);
                    clearInterval(checkInterval);
                    return;
                }
            } else {
                silenceCounter = 0; // Reset counter if we detect audio
            }
        }, 1000); // Check every second

        // Cleanup timer
        silenceTimerRef.current = setTimeout(() => clearInterval(checkInterval), 60000); // Stop after 60 seconds
    }, [onNoAudioDetected, hasExistingText]);

    // Detect if user is actively speaking
    const isUserSpeaking = useCallback((): boolean => {
        return lastAudioLevelRef.current > 30;
    }, []);

    // Send audio chunk to STT endpoint
    const sendAudioChunk = useCallback(
        async (audioBlob: Blob, isFinal: boolean) => {
            try {
                setState(isFinal ? 'transcribing_final' : 'transcribing_interim');

                const response = await apiClient.stt(audioBlob, isFinal);

                if (!response || !response.success || !response.data) {
                    throw new Error(response?.error || 'No transcription returned');
                }

                const data = response.data;

                if (data && data.text) {
                    const newText = data.text || '';
                    
                    if (isFinal) {
                        setTranscript(newText);
                        onTranscript?.(newText, true);
                        setState('done');
                    } else {
                        // Interim text overwrites previous interim
                        setTranscript(newText);
                        onTranscript?.(newText, false);
                        setState('transcribing_interim');
                    }
                } else {
                    throw new Error('No transcription returned');
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to transcribe audio';
                setError(errorMsg);
                toast.error(errorMsg);
                setState('idle');
            }
        },
        [onTranscript]
    );

    // Schedule next chunk capture
    const scheduleNextChunk = useCallback(() => {
        if (chunkTimerRef.current) {
            clearTimeout(chunkTimerRef.current);
        }

        chunkTimerRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.pause();
                setTimeout(() => {
                    if (mediaRecorderRef.current?.state === 'paused') {
                        mediaRecorderRef.current.resume();
                        scheduleNextChunk();
                    }
                }, 100);
            }
        }, chunkDurationMs);
    }, [chunkDurationMs]);

    // Start recording
    const startRecording = useCallback(async () => {
        try {
            setError(null);
            setTranscript('');
            chunksRef.current = [];
            setState('recording');

            // Request microphone access
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            streamRef.current = mediaStream;
            setStream(mediaStream);

            // Setup audio context for speech detection
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioContext;

            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(mediaStream);
            source.connect(analyser);
            analyserRef.current = analyser;

            // Start monitoring for prolonged silence (no audio detected)
            monitorSilence();

            // Create media recorder with best supported format
            // Try webm first, fall back to wav if needed
            let options: MediaRecorderOptions = {};
            const supportedTypes = [
                'audio/webm',
                'audio/webm;codecs=opus',
                'audio/wav',
                'audio/mp4'
            ];
            
            for (const mimeType of supportedTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    options.mimeType = mimeType;
                    break;
                }
            }
            
            const mediaRecorder = new MediaRecorder(mediaStream, options);
            mediaRecorderRef.current = mediaRecorder;

            // Collect all chunks for final transcription
            mediaRecorder.addEventListener('dataavailable', (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            });

            mediaRecorder.start(chunkDurationMs);
            scheduleNextChunk();

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to access microphone';
            setError(errorMsg);
            toast.error(errorMsg);
            setState('idle');
            setStream(null);
        }
    }, [sendAudioChunk, scheduleNextChunk, chunkDurationMs]);

    // Stop recording and send final complete recording
    const stopRecording = useCallback(async () => {
        if (chunkTimerRef.current) {
            clearTimeout(chunkTimerRef.current);
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
        }

        if (mediaRecorderRef.current?.state === 'recording' || mediaRecorderRef.current?.state === 'paused') {
            mediaRecorderRef.current.stop();

            // Wait for final dataavailable event
            await new Promise((resolve) => {
                const handler = async () => {
                    mediaRecorderRef.current?.removeEventListener('stop', handler);

                    // Send complete recording for final transcription
                    if (chunksRef.current.length > 0) {
                        // Get the mime type from the recorder or use fallback
                        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
                        const finalBlob = new Blob(chunksRef.current, { type: mimeType });
                        
                        // Only send if we have a reasonable amount of audio (>100ms typical)
                        if (finalBlob.size > 100) {
                            await sendAudioChunk(finalBlob, true);
                        } else {
                            setError('Recording too short');
                            toast.error('Please record at least 1 second of audio');
                            setState('idle');
                        }
                    }

                    resolve(null);
                };

                mediaRecorderRef.current?.addEventListener('stop', handler);
            });
        }

        // Cleanup
        streamRef.current?.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) {
            await audioContextRef.current.close();
        }
        setStream(null);
    }, [sendAudioChunk]);

    // Cancel recording without sending
    const cancelRecording = useCallback(() => {
        if (chunkTimerRef.current) {
            clearTimeout(chunkTimerRef.current);
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
        }

        if (mediaRecorderRef.current?.state === 'recording' || mediaRecorderRef.current?.state === 'paused') {
            mediaRecorderRef.current.stop();
        }

        streamRef.current?.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
        }

        setState('idle');
        setTranscript('');
        chunksRef.current = [];
        setStream(null);
    }, []);

    return {
        state,
        transcript,
        error,
        stream,
        isUserSpeaking,
        startRecording,
        stopRecording,
        cancelRecording,
        reset: () => {
            cancelRecording();
            setTranscript('');
            setError(null);
        },
    };
};
