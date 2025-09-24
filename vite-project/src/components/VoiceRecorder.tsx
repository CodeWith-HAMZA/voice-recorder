import React, { useState, useRef, useEffect } from 'react';
import './VoiceRecorder.css';

interface Recording {
  id: string;
  name: string;
  audioBlob: Blob;
  duration: number;
  timestamp: Date;
}

const VoiceRecorder: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentRecording, setCurrentRecording] = useState<Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      streamRef.current = stream;
      
      // Try different MIME types for better browser compatibility
      let mimeType = '';
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav',
        'audio/ogg;codecs=opus'
      ];
      
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      console.log('Using MIME type:', mimeType || 'default');
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Data chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = () => {
        // Use the same MIME type that was used for recording
        const blobType = mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        
        console.log('Recording stopped, blob created:', audioBlob.size, 'bytes, type:', blobType);
        
        // Test if the blob is valid by creating a URL
        const testUrl = URL.createObjectURL(audioBlob);
        console.log('Test URL created:', testUrl);
        
        const newRecording: Recording = {
          id: Date.now().toString(),
          name: `Recording ${recordings.length + 1}`,
          audioBlob,
          duration: recordingDuration,
          timestamp: new Date()
        };

        setRecordings(prev => [...prev, newRecording]);
        setCurrentRecording(newRecording);
        setRecordingDuration(0);
        
        // Clean up test URL
        URL.revokeObjectURL(testUrl);
      };

      mediaRecorder.start(1000); // Collect data every 1 second for better compatibility
      setIsRecording(true);
      setIsPaused(false);

      // Start duration counter
      intervalRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        // Resume duration counter
        intervalRef.current = window.setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const playRecording = (recording: Recording) => {
    console.log('Attempting to play recording:', recording);
    console.log('Blob size:', recording.audioBlob.size, 'bytes');
    console.log('Blob type:', recording.audioBlob.type);
    
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audioUrl = URL.createObjectURL(recording.audioBlob);
    console.log('Created audio URL:', audioUrl);
    
    const audio = new Audio();
    audioRef.current = audio;
    
    // Set audio properties for better compatibility
    audio.preload = 'auto';
    audio.controls = false;
    
    // Set up event listeners
    audio.onloadstart = () => {
      console.log('Audio loading started');
    };

    audio.onloadedmetadata = () => {
      console.log('Audio metadata loaded, duration:', audio.duration);
    };

    audio.oncanplay = () => {
      console.log('Audio can play');
    };

    audio.oncanplaythrough = () => {
      console.log('Audio can play through');
    };

    audio.onplay = () => {
      console.log('Audio started playing');
      setIsPlaying(true);
      setPlayingId(recording.id);
    };

    audio.onpause = () => {
      console.log('Audio paused');
    };

    audio.onended = () => {
      console.log('Audio playback ended');
      setIsPlaying(false);
      setPlayingId(null);
      URL.revokeObjectURL(audioUrl);
    };

    audio.onerror = (e) => {
      console.error('Audio playback error:', e);
      console.error('Audio error details:', audio.error);
      console.error('Audio network state:', audio.networkState);
      console.error('Audio ready state:', audio.readyState);
      
      // Try fallback method
      console.log('Trying fallback playback method...');
      tryFallbackPlayback(recording, audioUrl);
    };

    audio.onstalled = () => {
      console.log('Audio stalled');
    };

    audio.onwaiting = () => {
      console.log('Audio waiting');
    };

    // Set the source and try to play
    audio.src = audioUrl;
    
    // Wait a bit for the audio to load, then try to play
    setTimeout(() => {
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        console.error('Audio src:', audio.src);
        console.error('Audio currentSrc:', audio.currentSrc);
        tryFallbackPlayback(recording, audioUrl);
      });
    }, 100);
  };

  const tryFallbackPlayback = (recording: Recording, audioUrl: string) => {
    console.log('Trying fallback playback method...');
    
    // Create a new audio element with different approach
    const fallbackAudio = new Audio();
    fallbackAudio.preload = 'metadata';
    
    fallbackAudio.oncanplay = () => {
      console.log('Fallback audio can play');
      fallbackAudio.play().then(() => {
        console.log('Fallback audio started playing');
        setIsPlaying(true);
        setPlayingId(recording.id);
        audioRef.current = fallbackAudio;
      }).catch(error => {
        console.error('Fallback audio play failed:', error);
        setIsPlaying(false);
        setPlayingId(null);
        URL.revokeObjectURL(audioUrl);
      });
    };
    
    fallbackAudio.onended = () => {
      console.log('Fallback audio ended');
      setIsPlaying(false);
      setPlayingId(null);
      URL.revokeObjectURL(audioUrl);
    };
    
    fallbackAudio.onerror = (e) => {
      console.error('Fallback audio error:', e);
      setIsPlaying(false);
      setPlayingId(null);
      URL.revokeObjectURL(audioUrl);
    };
    
    fallbackAudio.src = audioUrl;
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setPlayingId(null);
    }
  };

  const deleteRecording = (id: string) => {
    setRecordings(prev => prev.filter(recording => recording.id !== id));
    if (currentRecording?.id === id) {
      setCurrentRecording(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };

  return (
    <div className="voice-recorder">
      <div className="recorder-header">
        <h1>🎤 Voice Recorder</h1>
        <p>Record and play back your voice messages</p>
        <div className="debug-info">
          <p>Browser: {navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Other'}</p>
          <p>MediaRecorder supported: {typeof MediaRecorder !== 'undefined' ? 'Yes' : 'No'}</p>
        </div>
      </div>

      <div className="recorder-controls">
        <div className="recording-status">
          {isRecording && (
            <div className="recording-indicator">
              <div className="pulse-dot"></div>
              <span>{isPaused ? 'Paused' : 'Recording'}</span>
              <span className="duration">{formatTime(recordingDuration)}</span>
            </div>
          )}
        </div>

        <div className="control-buttons">
          {!isRecording ? (
            <button 
              className="record-btn"
              onClick={startRecording}
            >
              🎤 Start Recording
            </button>
          ) : (
            <div className="recording-controls">
              <button 
                className="pause-btn"
                onClick={pauseRecording}
              >
                {isPaused ? '▶️ Resume' : '⏸️ Pause'}
              </button>
              <button 
                className="stop-btn"
                onClick={stopRecording}
              >
                ⏹️ Stop
              </button>
            </div>
          )}
        </div>
      </div>

      {currentRecording && (
        <div className="current-recording">
          <h3>Latest Recording</h3>
          <div className="recording-item">
            <div className="recording-info">
              <span className="recording-name">{currentRecording.name}</span>
              <span className="recording-duration">{formatTime(currentRecording.duration)}</span>
            </div>
            <div className="recording-actions">
              <button 
                className="play-btn"
                onClick={() => playRecording(currentRecording)}
                disabled={isPlaying && playingId === currentRecording.id}
              >
                {isPlaying && playingId === currentRecording.id ? '⏸️ Playing' : '▶️ Play'}
              </button>
              <button 
                className="delete-btn"
                onClick={() => deleteRecording(currentRecording.id)}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {recordings.length > 0 && (
        <div className="recordings-list">
          <h3>All Recordings ({recordings.length})</h3>
          <div className="recordings-grid">
            {recordings.map((recording) => (
              <div key={recording.id} className="recording-item">
                <div className="recording-info">
                  <span className="recording-name">{recording.name}</span>
                  <span className="recording-duration">{formatTime(recording.duration)}</span>
                  <span className="recording-date">{formatDate(recording.timestamp)}</span>
                </div>
                <div className="recording-actions">
                  <button 
                    className="play-btn"
                    onClick={() => playRecording(recording)}
                    disabled={isPlaying && playingId === recording.id}
                  >
                    {isPlaying && playingId === recording.id ? '⏸️ Playing' : '▶️ Play'}
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => deleteRecording(recording.id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPlaying && (
        <div className="playback-controls">
          <button className="stop-playback-btn" onClick={stopPlayback}>
            ⏹️ Stop Playback
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
