import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Mic, Check, RotateCcw, Play, Loader2, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TRAINING_PHRASES, TrainingPhrase } from "@/lib/voiceTrainingPhrases";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

type LanguageFilter = 'all' | 'english' | 'tagalog' | 'taglish';

export function VoiceTrainingSession() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordedSamples, setRecordedSamples] = useState(0);
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('all');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Filter phrases based on selected language
  const filteredPhrases = useMemo(() => {
    if (languageFilter === 'all') return TRAINING_PHRASES;
    return TRAINING_PHRASES.filter(p => p.language === languageFilter);
  }, [languageFilter]);

  const currentPhrase = filteredPhrases[currentIndex] || filteredPhrases[0];
  const totalPhrases = filteredPhrases.length;
  const progress = totalPhrases > 0 ? (recordedSamples / totalPhrases) * 100 : 0;

  // Reset index when filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setRecordedSamples(0);
    setAudioBlob(null);
  }, [languageFilter]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    }
  };

  const reRecord = () => {
    setAudioBlob(null);
  };

  const uploadSample = async () => {
    if (!audioBlob) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload audio to storage
      const fileName = `${user.id}/${currentPhrase.id}-${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('voice-training-samples')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('voice-training-samples')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from('voice_training_samples')
        .insert({
          user_id: user.id,
          sample_text: currentPhrase.text,
          language: currentPhrase.language,
          audio_url: publicUrl
        });

      if (dbError) throw dbError;

      // Move to next phrase
      setRecordedSamples(prev => prev + 1);
      setAudioBlob(null);

      if (currentIndex < filteredPhrases.length - 1) {
        setCurrentIndex(prev => prev + 1);
        toast({
          title: "Sample Saved",
          description: `${recordedSamples + 1} of ${filteredPhrases.length} completed`
        });
      } else {
        // All phrases completed
        await supabase
          .from('profiles')
          .update({ voice_training_completed: true })
          .eq('id', user.id);

        toast({
          title: "Training Complete! 🎉",
          description: "Your voice profile has been created successfully"
        });
        
        navigate('/');
      }
    } catch (error) {
      console.error('Error uploading sample:', error);
      toast({
        title: "Upload Failed",
        description: "Could not save recording. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSkip = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ voice_training_skipped: true })
          .eq('id', user.id);
      }
      navigate('/');
    } catch (error) {
      console.error('Error skipping training:', error);
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      <audio ref={audioRef} className="hidden" />
      
      {/* Header */}
      <div className="max-w-2xl mx-auto w-full space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Voice Training</h1>
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            <X className="h-4 w-4 mr-2" />
            Skip
          </Button>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{recordedSamples} of {totalPhrases} completed</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-2xl w-full p-8">
          <div className="space-y-8">
            {/* Language Filter Tabs */}
            <Tabs value={languageFilter} onValueChange={(v) => setLanguageFilter(v as LanguageFilter)} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="english">🇬🇧 English</TabsTrigger>
                <TabsTrigger value="tagalog">🇵🇭 Tagalog</TabsTrigger>
                <TabsTrigger value="taglish">🔀 Taglish</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Language Badge */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">
                {currentPhrase?.language === 'english' ? '🇬🇧' : currentPhrase?.language === 'taglish' ? '🔀' : '🇵🇭'}
              </span>
              <span className="text-sm font-medium capitalize text-muted-foreground">
                {currentPhrase?.language === 'taglish' ? 'Taglish (Mixed)' : currentPhrase?.language}
              </span>
            </div>

            {/* Phrase to Read */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {currentPhrase?.language === 'taglish' ? 'Read naturally with mixed language:' : 'Please read:'}
              </p>
              <p className="text-3xl font-semibold leading-relaxed">
                {currentPhrase?.text}
              </p>
            </div>

            {/* Recording Controls */}
            <div className="flex flex-col items-center gap-4">
              {!audioBlob ? (
                <>
                  <Button
                    size="lg"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-32 h-32 rounded-full ${
                      isRecording ? 'animate-pulse bg-destructive hover:bg-destructive' : ''
                    }`}
                  >
                    <Mic className="h-12 w-12" />
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {isRecording ? 'Recording... Tap to stop' : 'Tap to record'}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={playRecording}
                      className="w-20 h-20 rounded-full"
                    >
                      <Play className="h-8 w-8" />
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={reRecord}
                      className="w-20 h-20 rounded-full"
                    >
                      <RotateCcw className="h-8 w-8" />
                    </Button>
                    <Button
                      size="lg"
                      onClick={uploadSample}
                      disabled={isUploading}
                      className="w-20 h-20 rounded-full bg-primary"
                    >
                      {isUploading ? (
                        <Loader2 className="h-8 w-8 animate-spin" />
                      ) : (
                        <Check className="h-8 w-8" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Play, Re-record, or Save
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
