import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api';

export type AudioRecordingState = 'idle' | 'recording' | 'processing' | 'transcribing_interim' | 'transcribing_final' | 'done';

interface UseAudioRecordingOptions {
    onTranscript?: (text: string, isFinal: boolean) => void;
    chunkDurationMs?: number;
}

export const useAudioRecording = ({
    onTranscript,
    chunkDurationMs = 1500,
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

    // Detect if user is actively speaking
    const isUserSpeaking = useCallback((): boolean => {
        if (!analyserRef.current) return false;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average frequency energy
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        // Threshold for speech detection (adjust based on needs)
        return average > 30;
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

            // Create media recorder
            const mediaRecorder = new MediaRecorder(mediaStream, {
                mimeType: 'audio/webm;codecs=opus',
            });

            mediaRecorderRef.current = mediaRecorder;

            let isFirstChunk = true;

            // Handle data available event
            mediaRecorder.addEventListener('dataavailable', async (event) => {
                if (event.data.size > 0) {
                    const audioBlob = new Blob([event.data], { type: 'audio/webm;codecs=opus' });
                    chunksRef.current.push(audioBlob);

                    // Send interim transcription every chunk
                    if (!isFirstChunk) {
                        await sendAudioChunk(audioBlob, false);
                    }
                    isFirstChunk = false;
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

    // Stop recording and send final chunk
    const stopRecording = useCallback(async () => {
        if (chunkTimerRef.current) {
            clearTimeout(chunkTimerRef.current);
        }

        if (mediaRecorderRef.current?.state === 'recording' || mediaRecorderRef.current?.state === 'paused') {
            mediaRecorderRef.current.stop();

            // Wait for final dataavailable event
            await new Promise((resolve) => {
                const handler = async () => {
                    mediaRecorderRef.current?.removeEventListener('stop', handler);

                    // Combine all chunks for final transcription
                    if (chunksRef.current.length > 0) {
                        const finalBlob = new Blob(chunksRef.current, {
                            type: 'audio/webm;codecs=opus',
                        });
                        await sendAudioChunk(finalBlob, true);
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
