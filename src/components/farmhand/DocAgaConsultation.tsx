import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Volume2, FileText, ArrowLeft, RotateCcw, WifiOff } from "lucide-react";
import { getConversationId, resetConversationId, CONVERSATION_KEYS, CONVERSATION_TTLS } from "@/lib/localStorage";
import { truncateMessages, useSendCooldown } from "@/lib/chatUtils";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { VoiceRecordButton } from "@/components/ui/VoiceRecordButton";
import { useTTSQueue } from "@/hooks/useTTSQueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { TTSAudioControls } from "@/components/ui/TTSAudioControls";
import { DocAgaFeedbackButtons } from "./DocAgaFeedbackButtons";
import type { FeedbackRating } from "@/hooks/useDocAgaFeedback";

interface Message {
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
  showText?: boolean;
  queryId?: string;
  feedbackRating?: FeedbackRating | null;
}

interface DocAgaConsultationProps {
  initialQuery: string;
  onClose: () => void;
  farmId: string;
}

const DocAgaConsultation = ({ initialQuery, onClose, farmId }: DocAgaConsultationProps) => {
  // Persistent conversation ID (survives page refresh, 1h TTL for consultations)
  const [conversationId] = useState(() => getConversationId(CONVERSATION_KEYS.DOC_AGA_CONSULTATION, CONVERSATION_TTLS.CONSULTATION));
  const { canSend, markSent } = useSendCooldown();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Kumusta! Ako si Dok Aga. Ano ang maitutulong ko sa iyo?"
    },
    {
      role: "user",
      content: initialQuery
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isVoiceInput, setIsVoiceInput] = useState(false);
  
  // TTS Queue for sequential audio playback
  const ttsQueue = useTTSQueue({
    autoPlay: true,
    onError: (error) => {
      console.error('[DocAgaConsultation] TTS Queue error:', error);
    },
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const hasAutoSent = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle Samsung Flip fold/unfold events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Screen folded - pausing operations');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Auto-send initial query on mount
  useEffect(() => {
    if (!hasAutoSent.current && initialQuery) {
      hasAutoSent.current = true;
      handleSendMessage(initialQuery);
    }
  }, []);

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading || !canSend) return;

    if (!messageText) {
      setInput("");
      setMessages(prev => [...prev, { role: "user", content: textToSend }]);
    }
    
    setLoading(true);
    markSent();

    try {
      const DOC_AGA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doc-aga`;
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const resp = await fetch(DOC_AGA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: truncateMessages([
            ...messages.filter(m => m.role !== "assistant" || !m.content.includes("Kumusta! Ako si Dok Aga")),
            { role: "user", content: textToSend }
          ]),
          conversationId
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }
        if (resp.status === 402) {
          throw new Error("Service unavailable. Please contact support.");
        }
        throw new Error("Failed to get response from Dok Aga");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let assistantResponse = "";
      let capturedQueryId: string | null = null;

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            
            // Check for metadata event with queryId
            if (parsed.type === 'metadata' && parsed.queryId) {
              capturedQueryId = parsed.queryId;
              console.log('[DocAgaConsultation] Captured queryId:', capturedQueryId);
              continue;
            }
            
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantResponse += content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantResponse,
                  queryId: capturedQueryId || undefined
                };
                return newMessages;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush - also check for metadata
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            
            // Check for metadata event
            if (parsed.type === 'metadata' && parsed.queryId) {
              capturedQueryId = parsed.queryId;
              continue;
            }
            
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantResponse += content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantResponse,
                  queryId: capturedQueryId || undefined
                };
                return newMessages;
              });
            }
          } catch { /* ignore partial leftovers */ }
        }
      }

      // Update final message with queryId if captured
      if (capturedQueryId) {
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages[newMessages.length - 1]?.role === "assistant") {
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              queryId: capturedQueryId!
            };
          }
          return newMessages;
        });
      }

      // Generate audio for the response
      try {
        const { data: audioData, error: audioError } = await supabase.functions.invoke('text-to-speech', {
          body: { text: assistantResponse }
        });

        if (!audioError && audioData?.audioContent) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(audioData.audioContent), c => c.charCodeAt(0))],
            { type: 'audio/mpeg' }
          );
          const audioUrl = URL.createObjectURL(audioBlob);
          
          // Update the message with audio - preserve queryId
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            newMessages[newMessages.length - 1] = {
              role: "assistant",
              content: assistantResponse,
              audioUrl,
              showText: !isVoiceInput,
              queryId: lastMessage?.queryId || capturedQueryId || undefined
            };
            return newMessages;
          });

          // Only auto-enqueue for voice input
          if (isVoiceInput) {
            const messageId = `msg-${Date.now()}`;
            ttsQueue.enqueue(audioUrl, { messageId });
          }
        }
      } catch (audioError) {
        console.error('Audio generation error:', audioError);
      }

    } catch (error: any) {
      console.error("Dok Aga error:", error);
      showErrorToastLegacy(toast, error, "getting response from Dok Aga");
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1]?.content === "") {
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: "I'm having trouble answering that right now. Please try again."
          };
        }
        return newMessages;
      });
    } finally {
      setLoading(false);
      setIsVoiceInput(false); // Reset voice input state to ensure button returns to normal
    }
  };

  return (
    <Card className="border-2 border-primary/20 flex flex-col h-[600px] sm:h-[650px]">
      <div className="border-b p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="gap-2 min-h-[40px] sm:min-h-[36px]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back</span>
        </Button>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-base sm:text-lg font-semibold">Dok Aga Consultation</h2>
        </div>
      </div>

      {/* Offline Banner — inline, feature-specific "online-only" restriction */}
      {!isOnline && (
        <div className="mx-2 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <WifiOff className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="text-xs text-amber-800">
            <p className="font-medium">Dok Aga requires an internet connection</p>
            <p className="text-amber-600">Kailangan ng internet para magamit si Dok Aga</p>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-2 sm:p-4" ref={scrollRef}>
        <div className="space-y-3 sm:space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-2 sm:gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary" />
                </div>
              )}
              <Card className={`p-2.5 sm:p-3 max-w-[80%] sm:max-w-[85%] ${message.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                {message.role === "assistant" && message.audioUrl && (
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                    <audio src={message.audioUrl} controls className="max-w-full h-8 sm:h-10" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0"
                      onClick={() => {
                        setMessages(prev => prev.map((m, i) => 
                          i === index ? { ...m, showText: !m.showText } : m
                        ));
                      }}
                    >
                      {message.showText ? <Volume2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
                {(message.role === "user" || !message.audioUrl || message.showText === true) && (
                  <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
                
                {/* Feedback buttons for assistant messages with queryId */}
                {message.role === "assistant" && message.queryId && !loading && (
                  <DocAgaFeedbackButtons
                    queryId={message.queryId}
                    initialRating={message.feedbackRating}
                    onFeedbackSubmitted={(rating) => {
                      setMessages(prev => prev.map((m, i) => 
                        i === index ? { ...m, feedbackRating: rating } : m
                      ));
                    }}
                  />
                )}
              </Card>
              {message.role === "user" && (
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-secondary" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 sm:gap-3 justify-start">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary" />
              </div>
              <Card className="p-2.5 sm:p-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-2 sm:p-4 space-y-2 sm:space-y-3">
        {/* TTS Audio Controls */}
        {(ttsQueue.isPlaying || ttsQueue.isPaused || ttsQueue.queueLength > 0) && (
          <TTSAudioControls
            isPlaying={ttsQueue.isPlaying}
            isPaused={ttsQueue.isPaused}
            queueLength={ttsQueue.queueLength}
            volume={ttsQueue.volume}
            onPause={ttsQueue.pause}
            onResume={ttsQueue.resume}
            onSkip={ttsQueue.skip}
            onStop={ttsQueue.stop}
            onVolumeChange={ttsQueue.setVolume}
          />
        )}
        <VoiceRecordButton
          preferRealtime={false}
          showLabel
          showLiveTranscript={false}
          showPreview={false}
          disabled={!isOnline || isUploadingImage || loading}
          onTranscription={(text) => {
            setIsVoiceInput(true);
            handleSendMessage(text);
          }}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsVoiceInput(false);
            handleSendMessage();
          }}
          className="flex gap-1.5 sm:gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isOnline ? "Type your question..." : "Connect to internet to use Dok Aga..."}
            disabled={!isOnline || loading}
            className="flex-1 h-10 sm:h-10 text-sm"
          />
          <Button type="submit" disabled={!isOnline || loading || !canSend || !input.trim()} className="h-10 w-10 sm:w-auto sm:px-4">
            {loading ? <Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin" /> : <Send className="h-5 w-5 sm:h-4 sm:w-4" />}
          </Button>
        </form>
      </div>
    </Card>
  );
};

export default DocAgaConsultation;
