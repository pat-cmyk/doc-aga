import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, Bot, User, Volume2, FileText, Activity, BarChart3, DollarSign, Users, Search, AlertCircle, TrendingUp, Mic, MessageSquare, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VoiceRecordButton } from "./ui/VoiceRecordButton";
import { useTTSQueue } from "@/hooks/useTTSQueue";
import { TTSAudioControls } from "@/components/ui/TTSAudioControls";
import { useRole } from "@/hooks/useRole";
import { useGovernmentAccess } from "@/hooks/useGovernmentAccess";
import { getDocAgaPreferences, setPreferredInputMethod, type InputMethod } from "@/lib/localStorage";
import { useLocation } from "react-router-dom";

interface Message {
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
  showText?: boolean;
  imageUrl?: string;
  intent?: string;
}

type QuickAction = {
  icon: typeof Activity;
  label: string;
  prompt: string;
  color: string;
};

const DocAga = () => {
  // Generate stable conversation ID for this session
  const [conversationId] = useState(() => crypto.randomUUID());
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm Doc Aga, your farm assistant with access to your animal records. I can:\n\n• View animal profiles and health history\n• Search for animals by breed, stage, or characteristics\n• Create health records when you report issues\n• Log milking production data\n• **Query historical data** (milk production, weights, health - any date!)\n• Provide farm management advice\n\nYou can type your question, attach an image, or use voice recording. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isVoiceInput, setIsVoiceInput] = useState(false);
  
  // TTS Queue for sequential audio playback
  const ttsQueue = useTTSQueue({
    autoPlay: true,
    onError: (error) => {
      console.error('[DocAga] TTS Queue error:', error);
    },
  });
  const [currentIntent, setCurrentIntent] = useState<string>("query");
  const [inputMethod, setInputMethod] = useState<InputMethod>(() => {
    return getDocAgaPreferences().preferredInputMethod;
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { roles, hasRole } = useRole();
  const { hasAccess: hasGovernmentAccess } = useGovernmentAccess();
  const location = useLocation();
  
  // Detect if user is on government dashboard
  const isGovernmentContext = hasGovernmentAccess && location.pathname.startsWith('/government');

  // Quick actions based on role
  const getQuickActions = (): QuickAction[] => {
    if (hasRole('farmhand')) {
      return [
        { icon: Activity, label: "Log Activity", prompt: "I want to log an activity", color: "text-blue-600" },
        { icon: Search, label: "Find Animal", prompt: "Help me find an animal", color: "text-purple-600" },
        { icon: AlertCircle, label: "Report Issue", prompt: "I need to report a health issue", color: "text-red-600" },
        { icon: TrendingUp, label: "View Tasks", prompt: "What are my tasks today?", color: "text-green-600" },
      ];
    }
    // farmer_owner and farm managers
    return [
      { icon: Activity, label: "Record Activity", prompt: "I want to record an activity", color: "text-blue-600" },
      { icon: BarChart3, label: "View Farm Stats", prompt: "Show me my farm statistics", color: "text-green-600" },
      { icon: DollarSign, label: "Log Expense", prompt: "I want to log an expense", color: "text-yellow-600" },
      { icon: Users, label: "Check Team", prompt: "Show me my team status", color: "text-purple-600" },
    ];
  };

  const quickActions = getQuickActions();

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

  // Backup image preview to sessionStorage for fold transitions
  useEffect(() => {
    if (imagePreview) {
      sessionStorage.setItem('docaga_temp_image', imagePreview);
    } else {
      sessionStorage.removeItem('docaga_temp_image');
    }
  }, [imagePreview]);

  // Restore image preview on mount
  useEffect(() => {
    const savedImage = sessionStorage.getItem('docaga_temp_image');
    if (savedImage) {
      setImagePreview(savedImage);
    }
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('doc-aga-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Use signed URL for private bucket (expires in 1 hour - enough for AI processing)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('doc-aga-images')
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error("Failed to generate secure image URL");
      }

      return signedUrlData.signedUrl;
    } catch (error: any) {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload image",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsUploadingImage(false);
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  const parseIntent = (text: string): string | null => {
    const intentMatch = text.match(/\[INTENT:\s*(\w+)\]/);
    if (intentMatch) {
      return intentMatch[1];
    }
    return null;
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if ((!textToSend && !selectedImage) || loading || isUploadingImage) return;

    let uploadedImageUrl: string | null = null;

    // Upload image FIRST and wait for completion
    if (selectedImage) {
      uploadedImageUrl = await uploadImage(selectedImage);
      if (!uploadedImageUrl) return; // Stop if upload failed
    }

    if (!messageText) {
      setInput("");
    }
    
    const userMessage: Message = { 
      role: "user", 
      content: textToSend || "Attached an image"
    };
    if (uploadedImageUrl) {
      userMessage.imageUrl = uploadedImageUrl;
    }
    
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const DOC_AGA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doc-aga`;
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      const messagesToSend = [
        ...messages.filter(m => m.role !== "assistant" || !m.content.includes("Hello! I'm Doc Aga")),
        { 
          role: "user", 
          content: textToSend,
          ...(uploadedImageUrl && { imageUrl: uploadedImageUrl })
        }
      ];
      
      const resp = await fetch(DOC_AGA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: messagesToSend, 
          context: isGovernmentContext ? 'government' : 'farmer',
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
        throw new Error("Failed to get response from Doc Aga");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let assistantResponse = "";
      let detectedIntent: string | null = null;

      // Add placeholder for assistant message
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
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantResponse += content;
              
              // Try to parse intent from first chunk
              if (!detectedIntent && assistantResponse.length < 200) {
                detectedIntent = parseIntent(assistantResponse);
                if (detectedIntent) {
                  setCurrentIntent(detectedIntent);
                }
              }
              
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantResponse,
                  intent: detectedIntent || undefined
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

      // Final flush
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
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantResponse += content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantResponse,
                  intent: detectedIntent || undefined
                };
                return newMessages;
              });
            }
          } catch { /* ignore partial leftovers */ }
        }
      }

      // Handle intent-based behavior
      if (detectedIntent === "instruction") {
        toast({
          title: "Activity Logged",
          description: "Your activity has been recorded successfully",
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
          
          // Update the message with audio - show text first for typed input, audio first for voice input
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: "assistant",
              content: assistantResponse,
              audioUrl,
              showText: !isVoiceInput,
              intent: detectedIntent || undefined
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
      console.error("Doc Aga error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to get response from Doc Aga",
        variant: "destructive"
      });
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

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
  };

  const handleInputMethodChange = (method: InputMethod) => {
    setInputMethod(method);
    setPreferredInputMethod(method);
  };

  // Show quick actions only if chat has just the welcome message
  const showQuickActions = messages.length === 1;

  const getModeLabel = () => {
    switch (currentIntent) {
      case "instruction": return "Recording Mode";
      case "analytics": return "Analysis Mode";
      case "data_entry": return "Data Entry Mode";
      default: return "Query Mode";
    }
  };

  const getModeColor = () => {
    switch (currentIntent) {
      case "instruction": return "bg-blue-500";
      case "analytics": return "bg-green-500";
      case "data_entry": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Mode Indicator and Input Tabs */}
      <div className="border-b px-3 py-2 space-y-2">
        <div className="flex items-center justify-between">
          <Badge className={`${getModeColor()} text-white`}>
            {getModeLabel()}
          </Badge>
        </div>
        <Tabs value={inputMethod} onValueChange={(v) => handleInputMethodChange(v as InputMethod)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="voice" className="text-xs">
              <Mic className="h-3.5 w-3.5 mr-1" />
              Voice
            </TabsTrigger>
            <TabsTrigger value="image" className="text-xs">
              <ImageIcon className="h-3.5 w-3.5 mr-1" />
              Image
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1 p-2 sm:p-3" ref={scrollRef}>
        <div className="space-y-2 sm:space-y-3">
          {/* Quick Actions */}
          {showQuickActions && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {quickActions.map((action, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="h-auto p-3 flex flex-col items-center gap-2 hover:bg-accent"
                  onClick={() => handleQuickAction(action.prompt)}
                >
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                  <span className="text-xs font-medium text-center">{action.label}</span>
                </Button>
              ))}
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-1.5 sm:gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary" />
                </div>
              )}
              <Card className={`p-2.5 sm:p-3 max-w-[80%] sm:max-w-[85%] ${message.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                {message.imageUrl && (
                  <img 
                    src={message.imageUrl} 
                    alt="Attached" 
                    className="max-w-full h-auto rounded mb-2 max-h-48 sm:max-h-64 object-contain"
                  />
                )}
                {message.role === "assistant" && message.audioUrl && (
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                    <audio src={message.audioUrl} controls className="max-w-full h-8 sm:h-10" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 sm:h-7 sm:w-7 p-0 flex-shrink-0"
                      onClick={() => {
                        setMessages(prev => prev.map((m, i) => 
                          i === index ? { ...m, showText: !m.showText } : m
                        ));
                      }}
                    >
                      {message.showText ? <Volume2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <FileText className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
                    </Button>
                  </div>
                )}
                {(message.role === "user" || !message.audioUrl || message.showText === true) && (
                  <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
              </Card>
              {message.role === "user" && (
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-secondary" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-1.5 sm:gap-2 justify-start">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary" />
              </div>
              <Card className="p-2.5 sm:p-3">
                <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin text-primary" />
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-2 sm:p-3 pb-safe space-y-2">
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
        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-16 sm:h-20 rounded" />
            <Button
              size="sm"
              variant="destructive"
              className="absolute -top-1 -right-1 h-6 w-6 sm:h-5 sm:w-5 p-0 rounded-full text-xs"
              onClick={() => {
                setSelectedImage(null);
                setImagePreview(null);
              }}
            >
              ×
            </Button>
          </div>
        )}

        {/* Conditional input based on selected method */}
        {inputMethod === "voice" ? (
          <div className="flex items-center justify-center p-4 border-t-0 bg-muted/30">
            <VoiceRecordButton 
              onTranscription={(text) => {
                setIsVoiceInput(true);
                handleSendMessage(text);
              }} 
              disabled={isUploadingImage || loading}
              preferRealtime={false}
              showLabel={true}
              showLiveTranscript={false}
              showPreview={false}
              size="md"
              variant="secondary"
              idleLabel="Speak to Doc Aga"
              recordingLabel="Stop & Send"
            />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsVoiceInput(false);
              handleSendMessage();
            }}
            className="flex gap-1.5 sm:gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {inputMethod === "image" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || isUploadingImage}
                className="h-10 w-10 sm:h-9 sm:w-9 p-0 flex-shrink-0"
              >
                <FileText className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            )}
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={loading || isUploadingImage}
              className="flex-1 text-sm h-10 sm:h-9"
            />
            <Button type="submit" disabled={loading || isUploadingImage || (!input.trim() && !selectedImage)} size="sm" className="h-10 w-10 sm:h-9 sm:w-auto sm:px-3">
              {loading ? <Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin" /> : <Send className="h-5 w-5 sm:h-4 sm:w-4" />}
            </Button>
          </form>
        )}

        {isUploadingImage && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading image...
          </div>
        )}
      </div>
    </div>
  );
};

export default DocAga;
