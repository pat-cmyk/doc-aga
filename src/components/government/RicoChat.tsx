 import { useState, useEffect, useRef } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Badge } from "@/components/ui/badge";
 import { Loader2, Send, Bot, User, Landmark, Globe, TrendingUp, Activity, AlertTriangle } from "lucide-react";
 import { useToast } from "@/hooks/use-toast";
 import { useSearchParams } from "react-router-dom";
 import ReactMarkdown from "react-markdown";
 
 interface Message {
   role: "user" | "assistant";
   content: string;
 }
 
 type QuickAction = {
   icon: typeof Activity;
   label: string;
   prompt: string;
   color: string;
 };
 
 const quickActions: QuickAction[] = [
   { icon: Globe, label: "National Overview", prompt: "Show me national livestock statistics and regional distribution", color: "text-blue-600" },
   { icon: TrendingUp, label: "Risk Assessment", prompt: "Analyze delivery risks and identify animals needing priority attention", color: "text-orange-600" },
   { icon: Activity, label: "Health Trends", prompt: "Show me health patterns and potential outbreak regions", color: "text-red-600" },
   { icon: AlertTriangle, label: "Audit Check", prompt: "Check for data anomalies and potential compliance issues", color: "text-yellow-600" },
 ];
 
 const RicoChat = () => {
   const [conversationId] = useState(() => crypto.randomUUID());
   const [messages, setMessages] = useState<Message[]>([]);
   const [input, setInput] = useState("");
   const [loading, setLoading] = useState(false);
   
   const scrollRef = useRef<HTMLDivElement>(null);
   const { toast } = useToast();
   const [searchParams] = useSearchParams();
   
   const dataCategory = searchParams.get('data_source') || 'live';
 
   const welcomeMessage = `I'm **RICO** (Reporting & Intelligence Compliance Officer), your livestock sector intelligence analyst.
 
 My approach is **"Audit Defense"** - I validate data integrity and flag potential issues before they become problems.
 
 I can help you:
 • Analyze national/regional livestock statistics
 • Assess delivery risks with Pre-Calving Risk Scores
 • Track health patterns and identify outbreak regions
 • Summarize farmer feedback and priority issues
 • Flag data anomalies and "ghost beneficiary" patterns
 
 What intelligence do you need today?`;
 
   useEffect(() => {
     if (messages.length === 0) {
       setMessages([{ role: "assistant", content: welcomeMessage }]);
     }
   }, []);
 
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
     
     const userMessage: Message = { role: "user", content: textToSend };
     setMessages(prev => [...prev, userMessage]);
     setLoading(true);
 
     try {
       const RICO_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rico`;
       
       const { data: { session } } = await supabase.auth.getSession();
       
       const messagesToSend = [
         ...messages.filter(m => m.role !== "assistant" || !m.content.includes("I'm **RICO**")),
         { role: "user", content: textToSend }
       ];
       
       const resp = await fetch(RICO_URL, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
         },
         body: JSON.stringify({ 
           messages: messagesToSend, 
           dataCategory,
           conversationId 
         }),
       });
 
       if (!resp.ok) {
         if (resp.status === 429) {
           throw new Error("Rate limit exceeded. Please try again in a moment.");
         }
         throw new Error("Failed to get response from RICO");
       }
 
       if (!resp.body) throw new Error("No response body");
 
       const reader = resp.body.getReader();
       const decoder = new TextDecoder();
       let textBuffer = "";
       let streamDone = false;
       let assistantResponse = "";
 
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
           } catch {}
         }
       }
 
     } catch (error: any) {
       console.error("RICO error:", error);
       toast({
         title: "Error",
         description: error.message || "Failed to get response from RICO",
         variant: "destructive"
       });
       setMessages(prev => {
         const newMessages = [...prev];
         if (newMessages[newMessages.length - 1]?.content === "") {
           newMessages[newMessages.length - 1] = {
             role: "assistant",
             content: "I'm having trouble accessing the data right now. Please try again."
           };
         }
         return newMessages;
       });
     } finally {
       setLoading(false);
     }
   };
 
   const handleQuickAction = (prompt: string) => {
     setInput(prompt);
   };
 
   const showQuickActions = messages.length === 1;
 
   return (
     <div className="flex flex-col h-full bg-background">
       {/* Mode Badge */}
       <div className="px-3 py-2 border-b flex items-center gap-2">
         <Badge className="bg-blue-600 text-white hover:bg-blue-700">
           Intelligence Mode
         </Badge>
         <span className="text-xs text-muted-foreground">
           Analyzing {dataCategory === 'demo' ? 'Demo' : 'Live'} Data
         </span>
       </div>
 
       {/* Messages */}
       <ScrollArea className="flex-1 p-3" ref={scrollRef}>
         <div className="space-y-3">
           {messages.map((message, index) => (
             <div
               key={index}
               className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
             >
               {message.role === "assistant" && (
                 <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                   <Landmark className="w-4 h-4 text-white" />
                 </div>
               )}
               <div
                 className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                   message.role === "user"
                     ? "bg-blue-600 text-white"
                     : "bg-muted"
                 }`}
               >
                 {message.role === "assistant" ? (
                   <div className="prose prose-sm dark:prose-invert max-w-none">
                     <ReactMarkdown>{message.content}</ReactMarkdown>
                   </div>
                 ) : (
                   message.content
                 )}
               </div>
               {message.role === "user" && (
                 <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                   <User className="w-4 h-4" />
                 </div>
               )}
             </div>
           ))}
           
           {loading && (
             <div className="flex gap-2 justify-start">
               <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                 <Landmark className="w-4 h-4 text-white" />
               </div>
               <div className="bg-muted rounded-lg px-3 py-2">
                 <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
               </div>
             </div>
           )}
         </div>
       </ScrollArea>
 
       {/* Quick Actions */}
       {showQuickActions && (
         <div className="px-3 pb-2">
           <div className="grid grid-cols-2 gap-2">
             {quickActions.map((action) => (
               <Button
                 key={action.label}
                 variant="outline"
                 size="sm"
                 className="h-auto py-2 px-3 justify-start text-left"
                 onClick={() => handleQuickAction(action.prompt)}
               >
                 <action.icon className={`w-4 h-4 mr-2 ${action.color} flex-shrink-0`} />
                 <span className="text-xs truncate">{action.label}</span>
               </Button>
             ))}
           </div>
         </div>
       )}
 
       {/* Input */}
       <div className="p-3 border-t">
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
             placeholder="Ask RICO for intelligence..."
             disabled={loading}
             className="flex-1 text-sm"
           />
           <Button 
             type="submit" 
             size="icon" 
             disabled={loading || !input.trim()}
             className="bg-blue-600 hover:bg-blue-700"
           >
             <Send className="w-4 h-4" />
           </Button>
         </form>
       </div>
     </div>
   );
 };
 
 export default RicoChat;