import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChat } from '@/utils/RealtimeAudio';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceInterfaceProps {
  onSpeakingChange: (speaking: boolean) => void;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ onSpeakingChange }) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatRef = useRef<RealtimeChat | null>(null);

  const handleMessage = (event: any) => {
    console.log('Voice event:', event.type);
    
    // Handle different event types
    if (event.type === 'response.audio.delta') {
      setIsSpeaking(true);
      onSpeakingChange(true);
    } else if (event.type === 'response.audio.done') {
      setIsSpeaking(false);
      onSpeakingChange(false);
    } else if (event.type === 'input_audio_buffer.speech_started') {
      console.log('User started speaking');
    } else if (event.type === 'input_audio_buffer.speech_stopped') {
      console.log('User stopped speaking');
    } else if (event.type === 'error') {
      console.error('Voice error:', event);
      toast({
        title: "Voice Error",
        description: event.error?.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const startConversation = async () => {
    try {
      setIsConnecting(true);
      
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      chatRef.current = new RealtimeChat(handleMessage);
      await chatRef.current.init();
      
      setIsConnected(true);
      setIsConnecting(false);
      
      toast({
        title: "Voice Connected",
        description: "You can now speak with Doc Aga",
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      setIsConnecting(false);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : 'Failed to start voice conversation',
        variant: "destructive",
      });
    }
  };

  const endConversation = () => {
    chatRef.current?.disconnect();
    setIsConnected(false);
    setIsSpeaking(false);
    onSpeakingChange(false);
    
    toast({
      title: "Voice Disconnected",
      description: "Voice conversation ended",
    });
  };

  useEffect(() => {
    return () => {
      chatRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 p-4 border-t bg-muted/30">
      {!isConnected ? (
        <Button 
          onClick={startConversation}
          disabled={isConnecting}
          className="gap-2"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Start Voice Conversation
            </>
          )}
        </Button>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isSpeaking ? (
              <div className="flex items-center gap-2 text-sm text-primary">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Doc Aga is speaking...
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mic className="h-4 w-4 text-primary" />
                Listening...
              </div>
            )}
          </div>
          <Button 
            onClick={endConversation}
            variant="destructive"
            size="sm"
            className="gap-2"
          >
            <MicOff className="h-4 w-4" />
            End Voice
          </Button>
        </div>
      )}
    </div>
  );
};

export default VoiceInterface;
