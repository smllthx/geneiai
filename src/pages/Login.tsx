import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import {
  authenticateDevicePasskey,
  hasDevicePasskey,
  isDevicePasskeySupported,
  isDeviceUnlocked,
  markDeviceUnlocked,
} from "@/lib/devicePasskey";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [devicePasskeyReady, setDevicePasskeyReady] = useState(false);
  const [deviceUnlocking, setDeviceUnlocking] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery") || window.location.search.includes("type=recovery");
    setRecoveryMode(isRecovery);
    setDevicePasskeyReady(isDevicePasskeySupported() && hasDevicePasskey());
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (isRecovery) return;
      if (hasDevicePasskey() && !isDeviceUnlocked()) return;
      navigate("/inicio", { replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    markDeviceUnlocked();
    navigate("/inicio", { replace: true });
  };

  const handleDeviceUnlock = async () => {
    setDeviceUnlocking(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Primero ingresa con correo y contraseña en este dispositivo.");
      await authenticateDevicePasskey();
      navigate("/inicio", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "No se pudo desbloquear con Face ID / Touch ID.");
    } finally {
      setDeviceUnlocking(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
        options: { emailRedirectTo: `${window.location.origin}/inicio`, data: { display_name: name } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cuenta creada. Revisa tu correo si se solicita confirmación.");
  };

  const handleEmailRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return toast.error("Escribe tu correo");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
      redirectTo: `${window.location.origin}/login?type=recovery`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Te envié un correo para recuperar la cuenta.");
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error("La nueva contraseña debe tener al menos 8 caracteres.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada");
    markDeviceUnlocked();
    navigate("/inicio", { replace: true });
  };

  const handlePhoneRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryPhone) return toast.error("Escribe tu número con código de país");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: recoveryPhone });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Si tu Supabase tiene SMS activo, recibirás un código de acceso.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size={96} />
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground">GENAIA</h1>
          <p className="mt-1 text-sm text-muted-foreground">Archivo familiar privado</p>
        </div>
        <Card className="archivo-card">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">{recoveryMode ? "Crear nueva contraseña" : "Acceder al archivo"}</CardTitle>
            <CardDescription>{recoveryMode ? "Escribe una contraseña nueva para recuperar tu cuenta." : "Tus datos genealógicos son privados."}</CardDescription>
          </CardHeader>
          <CardContent>
            {recoveryMode ? (
              <form onSubmit={handleNewPassword} className="space-y-4">
                <div><Label>Nueva contraseña</Label><Input type="password" minLength={8} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Guardando…" : "Guardar nueva contraseña"}</Button>
              </form>
            ) : (
            <>
            {devicePasskeyReady && (
              <Button
                type="button"
                variant="outline"
                className="mb-4 w-full gap-2"
                onClick={handleDeviceUnlock}
                disabled={deviceUnlocking}
              >
                <ShieldCheck className="h-4 w-4" />
                {deviceUnlocking ? "Desbloqueando..." : "Desbloquear con Face ID / Touch ID"}
              </Button>
            )}
              <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login">Ingresar</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
                <TabsTrigger value="recover">Recuperar</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div><Label>Correo</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Contraseña</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div><Label>Nombre visible</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div><Label>Correo</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Contraseña</Label><Input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creando…" : "Crear cuenta"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="recover">
                <div className="space-y-5 pt-4">
                  <form onSubmit={handleEmailRecovery} className="space-y-3">
                    <div><Label>Recuperar por correo</Label><Input type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="tu-correo@ejemplo.com" /></div>
                    <Button type="submit" variant="outline" className="w-full gap-2" disabled={loading}>
                      <Mail className="h-4 w-4" /> Enviar correo de recuperación
                    </Button>
                  </form>
                  <form onSubmit={handlePhoneRecovery} className="space-y-3 border-t border-border/60 pt-4">
                    <div><Label>Acceso por número</Label><Input value={recoveryPhone} onChange={(e) => setRecoveryPhone(e.target.value)} placeholder="+56912345678" /></div>
                    <Button type="submit" variant="outline" className="w-full gap-2" disabled={loading}>
                      <Phone className="h-4 w-4" /> Enviar código SMS
                    </Button>
                    <p className="text-[11px] text-muted-foreground">El SMS funciona si el proveedor telefónico está activado en Supabase.</p>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
            </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
