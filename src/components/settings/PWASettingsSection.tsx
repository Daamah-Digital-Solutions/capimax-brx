import { useState, useEffect } from "react";
import { Save, Smartphone, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePWASettings, useUpdatePWASettings } from "@/hooks/usePWASettings";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export function PWASettingsSection() {
  const { data: settings, isLoading } = usePWASettings();
  const updateSettings = useUpdatePWASettings();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    app_name: "",
    app_short_name: "",
    app_description: "",
    install_prompt_enabled: true,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        app_name: settings.app_name,
        app_short_name: settings.app_short_name,
        app_description: settings.app_description,
        install_prompt_enabled: settings.install_prompt_enabled,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(formData);
      toast.success(t("pwa.settingsSaved"));
    } catch (error) {
      toast.error(t("pwa.settingsError"));
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{t("pwa.settingsTitle")}</CardTitle>
            <CardDescription>{t("pwa.settingsDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Install Prompt Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">{t("pwa.enableInstallPrompt")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("pwa.enableInstallPromptDesc")}
            </p>
          </div>
          <Switch
            checked={formData.install_prompt_enabled}
            onCheckedChange={(checked) => 
              setFormData(prev => ({ ...prev, install_prompt_enabled: checked }))
            }
          />
        </div>

        {/* App Name */}
        <div className="space-y-2">
          <Label htmlFor="app_name">{t("pwa.appName")}</Label>
          <Input
            id="app_name"
            value={formData.app_name}
            onChange={(e) => setFormData(prev => ({ ...prev, app_name: e.target.value }))}
            placeholder="Capimax BRX"
          />
          <p className="text-xs text-muted-foreground">{t("pwa.appNameDesc")}</p>
        </div>

        {/* Short Name */}
        <div className="space-y-2">
          <Label htmlFor="app_short_name">{t("pwa.shortName")}</Label>
          <Input
            id="app_short_name"
            value={formData.app_short_name}
            onChange={(e) => setFormData(prev => ({ ...prev, app_short_name: e.target.value }))}
            placeholder="Capimax"
            maxLength={12}
          />
          <p className="text-xs text-muted-foreground">{t("pwa.shortNameDesc")}</p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="app_description">{t("pwa.appDescription")}</Label>
          <Input
            id="app_description"
            value={formData.app_description}
            onChange={(e) => setFormData(prev => ({ ...prev, app_description: e.target.value }))}
            placeholder="Real Estate Tokenization Platform"
          />
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={updateSettings.isPending}
          className="w-full gap-2"
        >
          {updateSettings.isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {t("pwa.saveSettings")}
        </Button>
      </CardContent>
    </Card>
  );
}
