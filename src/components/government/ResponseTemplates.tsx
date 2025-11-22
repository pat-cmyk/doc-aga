import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Copy } from "lucide-react";
import { toast } from "sonner";

const defaultTemplates = [
  {
    id: "vet_support",
    category: "veterinary_support",
    name: "Veterinary Support - Scheduled Visit",
    template: "Thank you for reaching out. We have scheduled a veterinary visit to your farm on [DATE]. Our team will assess your [LIVESTOCK_TYPE] and provide appropriate treatment. Please prepare any health records you have available.",
  },
  {
    id: "training_scheduled",
    category: "training_request",
    name: "Training Request - Session Confirmed",
    template: "Your training request has been approved. A session on [TOPIC] will be conducted at [LOCATION] on [DATE]. Materials will be provided. Please confirm your attendance.",
  },
  {
    id: "financial_assist",
    category: "financial_assistance",
    name: "Financial Assistance - Application Received",
    template: "We have received your application for financial assistance. Your case (Reference #[REF_NUMBER]) is under review. You will be notified within 10 working days. Required documents: [DOCUMENTS].",
  },
  {
    id: "disease_outbreak",
    category: "disease_outbreak",
    name: "Disease Outbreak - Immediate Action",
    template: "URGENT: We have received your disease outbreak report. Our veterinary team has been dispatched to [LOCATION]. Please isolate affected animals immediately. Do not transport animals. Further instructions will follow.",
  },
  {
    id: "feed_shortage",
    category: "feed_shortage",
    name: "Feed Shortage - Supply Coordination",
    template: "We acknowledge your feed shortage concern. We are coordinating with suppliers to deliver [FEED_TYPE] to [MUNICIPALITY]. Expected delivery: [DATE]. Emergency allocation: [QUANTITY] kg available for critical cases.",
  },
  {
    id: "infrastructure",
    category: "infrastructure",
    name: "Infrastructure - Assessment Scheduled",
    template: "Your infrastructure concern regarding [ISSUE] has been noted. An assessment team will visit [LOCATION] on [DATE]. Please ensure site access is available. Photos/documentation would be helpful.",
  },
  {
    id: "policy_concern",
    category: "policy_concern",
    name: "Policy Concern - Under Review",
    template: "Thank you for your policy feedback regarding [POLICY_NAME]. Your concerns about [SPECIFIC_ISSUE] have been forwarded to the policy review committee. We will update you on any developments.",
  },
  {
    id: "market_access",
    category: "market_access",
    name: "Market Access - Buyer Connection",
    template: "We can help connect you with buyers for your [PRODUCT]. We have forwarded your details to [BUYER_NAME/COOPERATIVE]. Contact: [PHONE]. Expected response within 3 days.",
  },
];

export const ResponseTemplates = () => {
  const [templates] = useState(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  const handleCopyTemplate = (template: any) => {
    navigator.clipboard.writeText(template.template);
    toast.success("Template copied to clipboard");
  };

  const categoryLabels: Record<string, string> = {
    policy_concern: "Policy",
    market_access: "Market",
    veterinary_support: "Veterinary",
    training_request: "Training",
    infrastructure: "Infrastructure",
    financial_assistance: "Financial",
    emergency_support: "Emergency",
    disease_outbreak: "Disease",
    feed_shortage: "Feed",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Response Templates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="p-3 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedTemplate(template)}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{template.name}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {categoryLabels[template.category]}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyTemplate(template);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {template.template}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {selectedTemplate && (
          <Card className="p-4 bg-muted/50">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{selectedTemplate.name}</p>
                <Button size="sm" onClick={() => handleCopyTemplate(selectedTemplate)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Template
                </Button>
              </div>
              <Textarea
                value={selectedTemplate.template}
                readOnly
                rows={5}
                className="bg-background"
              />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Placeholders you can customize:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>[DATE] - Visit/event date</li>
                  <li>[LOCATION] - Farm/municipality name</li>
                  <li>[LIVESTOCK_TYPE] - Animal type (cattle, carabao, etc.)</li>
                  <li>[TOPIC] - Training subject</li>
                  <li>[REF_NUMBER] - Application reference number</li>
                  <li>[QUANTITY] - Feed amount or allocation</li>
                </ul>
              </div>
            </div>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};
