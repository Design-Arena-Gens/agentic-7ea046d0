'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import styles from './voiceover-studio.module.css';

type Recording = {
  id: string;
  url: string;
  createdAt: number;
  duration: number;
};

type VoiceProfile = {
  id: string;
  label: string;
  description: string;
  suggestions: string[];
};

const voiceProfiles: VoiceProfile[] = [
  {
    id: 'brand-story',
    label: 'Brand Story',
    description: 'Warm, trustworthy, and aspirational – perfect for promo videos.',
    suggestions: ['Lead with empathy', 'Highlight transformation', 'Close with a clear CTA'],
  },
  {
    id: 'explainer',
    label: 'Explainer',
    description: 'Clear, upbeat, and slightly faster pacing for tutorials or explainers.',
    suggestions: ['Keep sentences short', 'Use positive verbs', 'End each section with a recap'],
  },
  {
    id: 'narrative',
    label: 'Narrative',
    description: 'Calm, cinematic, and immersive for storytelling or podcasts.',
    suggestions: ['Paint vivid imagery', 'Lean into pauses', 'Resolve with an emotional beat'],
  },
];

const scriptIdeas = [
  {
    title: 'Product Launch Opener',
    script:
      'Introducing the next chapter in effortless productivity. Meet Lumen – your intelligent co-creator that transforms raw ideas into polished, share-ready stories.',
  },
  {
    title: 'Podcast Intro',
    script:
      "You are listening to 'Momentum Mondays', the show where founders, makers, and dreamers unpack the habits that keep them moving forward.",
  },
  {
    title: 'Educational Hook',
    script:
      'Did you know 73% of learners retain more when they hear information aloud? Let’s turn your slides into a compelling audio experience.',
  },
];

const defaultScript = `Hey there! Welcome to your voiceover studio. Drop in your script, fine-tune the tone, and choose a voice that fits your story. Ready when you are.`;

export default function VoiceoverStudio() {
  const [script, setScript] = useState(defaultScript);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [pitch, setPitch] = useState(1);
  const [rate, setRate] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [activeProfile, setActiveProfile] = useState<VoiceProfile>(voiceProfiles[0]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStartRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const speechOk = 'speechSynthesis' in window;
    setSpeechSupported(speechOk);
    setRecordingSupported('mediaDevices' in navigator);

    if (!speechOk) {
      return;
    }

    const synth = window.speechSynthesis;

    const updateVoices = () => {
      const loadedVoices = synth.getVoices();
      setVoices(loadedVoices);
      if (!selectedVoice && loadedVoices.length) {
        const preferred = loadedVoices.find((voice) => /en\-IN|en\-US/.test(voice.lang));
        setSelectedVoice(preferred?.name || loadedVoices[0].name);
      }
    };

    synth.addEventListener('voiceschanged', updateVoices);
    updateVoices();

    return () => {
      synth.removeEventListener('voiceschanged', updateVoices);
    };
  }, [selectedVoice]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recordings.forEach((recording) => URL.revokeObjectURL(recording.url));
    };
  }, [recordings]);

  const speak = () => {
    if (!speechSupported || !script.trim()) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(script);
    utterance.pitch = pitch;
    utterance.rate = rate;

    const voice = voices.find((v) => v.name === selectedVoice);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const cancelSpeech = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const requestRecordingStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const durationMs = recordStartRef.current ? Date.now() - recordStartRef.current : 0;
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setRecordings((prev) => [
        {
          id: `${Date.now()}`,
          url,
          createdAt: Date.now(),
          duration: durationMs,
        },
        ...prev,
      ]);
      audioChunksRef.current = [];
      recordStartRef.current = null;
    };

    recorder.start();
    recordStartRef.current = Date.now();
    setIsRecording(true);
  };

  const toggleRecording = async () => {
    if (!recordingSupported) {
      return;
    }

    if (!isRecording) {
      try {
        await requestRecordingStream();
      } catch (error) {
        console.error('Unable to access microphone', error);
      }
      return;
    }

    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
  };

  const formattedDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const speakingHint = useMemo(() => {
    if (!speechSupported) {
      return 'Speech synthesis is not supported in this browser.';
    }
    if (!script.trim()) {
      return 'Add some text to preview the voiceover.';
    }
    return isSpeaking ? 'Playing voiceover preview…' : 'Ready to preview.';
  }, [speechSupported, script, isSpeaking]);

  const wordCount = useMemo(() => {
    if (!script.trim()) {
      return 0;
    }
    return script.trim().split(/\s+/).length;
  }, [script]);

  const handlePickIdea = (text: string) => {
    setScript(text);
  };

  const clearScript = () => setScript('');

  const deleteRecording = (id: string) => {
    setRecordings((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const downloadRecording = (id: string) => {
    const recording = recordings.find((item) => item.id === id);
    if (!recording) return;
    const anchor = document.createElement('a');
    anchor.href = recording.url;
    anchor.download = `voiceover-${id}.webm`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <main className={styles.wrapper}>
      <header className={styles.hero}>
        <div>
          <span className={styles.tag}>Voiceover Studio</span>
          <h1>Mujhe voiceover karni hai? Sab yahin se hoga.</h1>
          <p>
            Write, rehearse, and record professional-quality voiceovers in the browser. Craft scripts, audition
            natural voices, and capture your own takes without breaking flow.
          </p>
        </div>
        <div className={styles.heroCard}>
          <div className={styles.heroMeter}>
            <span className={clsx(styles.pulse, isSpeaking && styles.pulseActive)} />
            <span>{speakingHint}</span>
          </div>
          <div className={styles.heroStats}>
            <div>
              <strong>{wordCount}</strong>
              <small>Words</small>
            </div>
            <div>
              <strong>{(wordCount / rate || 0).toFixed(1)}</strong>
              <small>Est. secs</small>
            </div>
            <div>
              <strong>{recordings.length}</strong>
              <small>Tracks</small>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.grid}>
        <section className={styles.primary}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Script Editor</h2>
                <p>Drop your copy, tweak the tone, and rehearse loops in seconds.</p>
              </div>
              <div className={styles.sectionActions}>
                <button className={styles.secondaryButton} onClick={() => handlePickIdea(defaultScript)}>
                  Reset
                </button>
                <button className={styles.mutedButton} onClick={clearScript}>
                  Clear
                </button>
              </div>
            </div>
            <textarea
              className={styles.textArea}
              value={script}
              onChange={(event) => setScript(event.target.value)}
              placeholder="Type or paste your voiceover script..."
              rows={12}
            />
            <div className={styles.metaRow}>
              <span>{wordCount} words</span>
              <span>Pitch {pitch.toFixed(1)} · Speed {rate.toFixed(1)}x</span>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Voice Preview</h2>
                <p>Select a voice, adjust pitch & pace, then audition your script.</p>
              </div>
            </div>

            <div className={styles.controlGrid}>
              <label className={styles.controlGroup}>
                <span>Voice</span>
                <select value={selectedVoice} onChange={(event) => setSelectedVoice(event.target.value)}>
                  {voices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} · {voice.lang}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.controlGroup}>
                <span>Pitch {pitch.toFixed(1)}</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={pitch}
                  onChange={(event) => setPitch(parseFloat(event.target.value))}
                />
              </label>

              <label className={styles.controlGroup}>
                <span>Speed {rate.toFixed(1)}x</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={rate}
                  onChange={(event) => setRate(parseFloat(event.target.value))}
                />
              </label>
            </div>

            <div className={styles.buttonRow}>
              <button className={styles.primaryButton} onClick={speak} disabled={!speechSupported || isSpeaking}>
                Preview Voiceover
              </button>
              <button className={styles.secondaryButton} onClick={cancelSpeech} disabled={!isSpeaking}>
                Stop Preview
              </button>
            </div>
            {!speechSupported && <p className={styles.hint}>Speech synthesis is not supported on this device.</p>}
          </div>
        </section>

        <aside className={styles.secondary}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Voice Palette</h2>
                <p>Pick a vibe, then match it with the perfect read.</p>
              </div>
            </div>
            <div className={styles.profileList}>
              {voiceProfiles.map((profile) => (
                <button
                  key={profile.id}
                  className={clsx(styles.profileCard, profile.id === activeProfile.id && styles.profileCardActive)}
                  onClick={() => setActiveProfile(profile)}
                >
                  <div>
                    <strong>{profile.label}</strong>
                    <p>{profile.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <ul className={styles.suggestionList}>
              {activeProfile.suggestions.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Script Starters</h2>
                <p>Grab a template to jump-start your next take.</p>
              </div>
            </div>
            <div className={styles.ideaList}>
              {scriptIdeas.map((idea) => (
                <article key={idea.title} className={styles.ideaCard}>
                  <div>
                    <strong>{idea.title}</strong>
                    <p>{idea.script}</p>
                  </div>
                  <button className={styles.secondaryButton} onClick={() => handlePickIdea(idea.script)}>
                    Use Script
                  </button>
                </article>
              ))}
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Recording Booth</h2>
                <p>Capture your own performance and review takes instantly.</p>
              </div>
            </div>
            <div className={styles.recordingControls}>
              <button
                className={clsx(styles.primaryButton, styles.fullWidth, isRecording && styles.dangerButton)}
                onClick={toggleRecording}
                disabled={!recordingSupported}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
              {!recordingSupported && <p className={styles.hint}>Microphone access is not supported in this browser.</p>}
            </div>
            <div className={styles.recordingList}>
              {recordings.length === 0 ? (
                <p className={styles.hint}>Your takes will appear here with playback and downloads.</p>
              ) : (
                recordings.map((track) => (
                  <div key={track.id} className={styles.recordingItem}>
                    <div className={styles.recordingMeta}>
                      <strong>Take {new Date(track.createdAt).toLocaleTimeString()}</strong>
                      <span>{formattedDuration(track.duration)}</span>
                    </div>
                    <audio className={styles.audio} controls src={track.url} />
                    <div className={styles.recordingActions}>
                      <button className={styles.secondaryButton} onClick={() => downloadRecording(track.id)}>
                        Download
                      </button>
                      <button className={styles.mutedButton} onClick={() => deleteRecording(track.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
