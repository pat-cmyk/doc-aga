import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Volume2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import VoiceInterface from "./VoiceInterface";

interface Message {
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
  showText?: boolean;
}

const DocAga = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm Doc Aga, your farm assistant with access to your animal records. I can:\n\n• View animal profiles and health history\n• Search for animals by breed, stage, or characteristics\n• Create health records when you report issues\n• Log milking production data\n• Provide farm management advice\n\nYou can type your question or use voice recording. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading) return;

    if (!messageText) {
      setInput("");
    }
    setMessages(prev => [...prev, { role: "user", content: textToSend }]);
    setLoading(true);

    try {
      const DOC_AGA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doc-aga`;
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      const resp = await fetch(DOC_AGA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: [
            ...messages.filter(m => m.role !== "assistant" || !m.content.includes("Hello! I'm Doc Aga")),
            { role: "user", content: textToSend }
          ]
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
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantResponse
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
                  content: assistantResponse
                };
                return newMessages;
              });
            }
          } catch { /* ignore partial leftovers */ }
        }
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
          
          // Update the message with audio
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: "assistant",
              content: assistantResponse,
              audioUrl,
              showText: false
            };
            return newMessages;
          });

          // Auto-play the audio
          const audio = new Audio(audioUrl);
          audio.play().catch(err => console.error('Audio playback error:', err));
        }
      } catch (audioError) {
        console.error('Audio generation error:', audioError);
      }

      // Log the query
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("doc_aga_queries").insert({
        user_id: user?.id,
        question: textToSend,
        answer: assistantResponse,
      });

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
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <Card className={`p-2.5 max-w-[85%] ${message.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
              {message.role === "assistant" && message.audioUrl && (
                  <div className="flex items-center gap-2 mb-2">
                    <audio src={message.audioUrl} controls className="max-w-full" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setMessages(prev => prev.map((m, i) => 
                          i === index ? { ...m, showText: !m.showText } : m
                        ));
                      }}
                    >
                      {message.showText ? <Volume2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )}
                {(message.role === "user" || !message.audioUrl || message.showText === true) && (
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
              </Card>
              {message.role === "user" && (
                <div className="h-7 w-7 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-3.5 w-3.5 text-secondary" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <Card className="p-2.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-3 space-y-2">
        <VoiceInterface onTranscription={(text) => handleSendMessage(text)} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1 text-sm h-9"
          />
          <Button type="submit" disabled={loading || !input.trim()} size="sm">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default DocAga;