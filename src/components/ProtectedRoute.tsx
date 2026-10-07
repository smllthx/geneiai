import SectionPlaceholder from "@/components/SectionPlaceholder";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { hasDevicePasskey, isDeviceUnlocked } from "@/lib/devicePasskey";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SectionPlaceholder session />;
  if (!user) return <Navigate to="/login" replace />;
  if (hasDevicePasskey() && !isDeviceUnlocked()) return <Navigate to="/login?unlock=1" replace />;
  return <>{children}</>;
}
