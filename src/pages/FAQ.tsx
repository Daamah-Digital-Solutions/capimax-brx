import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, Shield } from "lucide-react";
import { faqSections } from "@/data/faq";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";


export default function FAQ() {
  const { language, isRTL } = useLanguage();

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? "rtl" : "ltr"}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === "ar" ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {language === "ar"
              ? "اعثر على إجابات لأسئلتك حول ترميز العقارات والاستثمار والإطار القانوني"
              : "Find answers to your questions about real estate tokenization, investment, and legal framework"}
          </p>
        </div>

        {/* FAQ Sections */}
        <div className="max-w-4xl mx-auto space-y-8">
          {faqSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    {language === "ar" ? section.titleAr : section.titleEn}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <Accordion type="multiple" className="space-y-2">
                    {section.items.map((item, index) => (
                      <AccordionItem
                        key={`${section.id}-${index}`}
                        value={`${section.id}-${index}`}
                        className="border rounded-lg px-4 bg-background"
                      >
                        <AccordionTrigger className="hover:no-underline py-4 text-left">
                          <span className="font-medium text-sm md:text-base">
                            {language === "ar" ? item.questionAr : item.question}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <p className="text-muted-foreground whitespace-pre-line text-sm">
                            {language === "ar" ? item.answerAr : item.answer}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary Card */}
        <Card className="max-w-4xl mx-auto mt-8 bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {language === "ar" ? "ملخص" : "Summary"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {language === "ar"
                    ? "SPV هي العمود الفقري القانوني لنموذج Capy Max RT. تضمن أن العقارات المرمزة ليست مجرد رمز رقمي، بل حق استثماري حقيقي وقابل للتنفيذ قانونياً مدعوم بأصل ملموس ومحمي بالقانون."
                    : "The SPV is the legal backbone of the Capy Max RT model. It ensures that tokenized real estate is not merely a digital token, but a real, legally enforceable investment right backed by a tangible asset and protected by law."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="max-w-4xl mx-auto mt-6">
          <CardContent className="py-6 text-center">
            <h3 className="text-lg font-semibold mb-2">
              {language === "ar" ? "هل لديك المزيد من الأسئلة؟" : "Have More Questions?"}
            </h3>
            <p className="text-muted-foreground mb-2">
              {language === "ar"
                ? "تواصل مع فريق الدعم لدينا على:"
                : "Contact our support team at:"}
            </p>
            <p className="text-primary font-medium">support@capimax.io</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
