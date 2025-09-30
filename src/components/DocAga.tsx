import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const DocAga = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm Doc Aga, your farm assistant. I can answer questions about livestock health, nutrition, breeding, and management based on proven farming practices. How can I help you today?"
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

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("doc-aga", {
        body: { question: userMessage }
      });

      if (error) throw error;

      const answer = data.answer || "I don't know the answer to that question. Please ask about livestock health, nutrition, breeding, or farm management.";
      
      setMessages(prev => [...prev, { role: "assistant", content: answer }]);

      // Log the query
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("doc_aga_queries").insert({
        user_id: user?.id,
        question: userMessage,
        answer: answer,
        matched_faq_id: data.matched_faq_id || null
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get response from Doc Aga",
        variant: "destructive"
      });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm having trouble answering that right now. Please try again."
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px]">
      <ScrollArea className="flex-1 p-4 space-y-4" ref={scrollRef}>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <Card className={`p-3 max-w-[80%] ${message.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </Card>
            {message.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-secondary" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <Card className="p-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </Card>
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4">
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
            placeholder="Ask about livestock management..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default DocAga;