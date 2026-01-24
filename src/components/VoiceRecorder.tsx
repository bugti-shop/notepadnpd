import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';
import { toast } from 'sonner';
import { VoiceRecording } from '@/types/note';

interface VoiceRecorderProps {
  recordings: VoiceRecording[];
  onRecordingAdd: (recording: VoiceRecording) => void;
  onRecordingDelete: (id: string) => void;
  onInsertAtCursor?: (audioBase64: string, recordingId: string) => void;
  compact?: boolean;
}

export const VoiceRecorder = ({
  recordings,
  onRecordingAdd,
  onRecordingDelete,
  onInsertAtCursor,
  compact = false,
}: VoiceRecorderProps) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

        const reader = new FileReader();
        reader.onloadend = () => {
          const audioBase64 = reader.result as string;
          const recordingId = Date.now().toString();

          const recording: VoiceRecording = {
            id: recordingId,
            audioUrl: audioBase64,
            duration: recordingTime,
            timestamp: new Date(),
          };

          onRecordingAdd(recording);

          if (onInsertAtCursor) {
            onInsertAtCursor(audioBase64, recordingId);
          }

          stream.getTracks().forEach(track => track.stop());
          setRecordingTime(0);
          toast.success(t('toasts.voiceRecordingSaved'));
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error(t('errors.microphoneFailed'));
      console.error(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 w-full">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 w-full text-sm"
          >
            <Mic className="h-4 w-4" />
            {t('noteEditor.recordVoiceNote')}
          </button>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 text-sm text-destructive"
            >
              <Square className="h-4 w-4" />
              {t('voice.stopRecording')}
            </button>
            <span className="text-sm font-mono text-destructive">
              {formatTime(recordingTime)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {!isRecording ? (
        <Button
          type="button"
          onClick={startRecording}
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title={t('noteEditor.recordVoiceNote')}
        >
          <Mic className="h-5 w-5" />
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={stopRecording}
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title="Stop Recording"
          >
            <Square className="h-5 w-5 text-destructive" />
          </Button>
          <span className="text-sm font-mono text-destructive">
            {formatTime(recordingTime)}
          </span>
        </div>
      )}
    </div>
  );
};
