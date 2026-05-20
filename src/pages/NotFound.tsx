import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Esta sección no existe o fue movida.</p>
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          <Link to="/inicio" className="text-primary underline hover:text-primary/90">Ir a Inicio</Link>
          <Link to="/arbol" className="text-primary underline hover:text-primary/90">Ver árbol</Link>
          <Link to="/investigacion" className="text-primary underline hover:text-primary/90">Investigación</Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
