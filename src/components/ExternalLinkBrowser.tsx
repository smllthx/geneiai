import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw } from 'lucide-react';

export function externalPage(value: string, origin: string) {
  try {
    const url = new URL(value, origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === origin || url.username || url.password) return null;
    // Downloads and authorization keep their own browser context.
    if (/\.(pdf|zip|ged|csv|xlsx?|png|jpe?g|webp|dmg)$/i.test(url.pathname) || url.pathname.includes('/storage/v1/')) return null;
    return url;
  } catch { return null; }
}

export default function ExternalLinkBrowser() {
  const [url, setUrl] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element)?.closest?.('a');
      if (!anchor || anchor.download || anchor.dataset.externalBrowser === 'true') return;
      const target = externalPage(anchor.href, window.location.origin);
      if (!target) return;
      // Native GENEAI handles new windows with WebKit, without an iframe.
      if ((window as any).__GENEAI_NATIVE_BROWSER__) return;
      event.preventDefault(); setUrl(target.href);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return <Dialog open={!!url} onOpenChange={(open) => { if (!open) setUrl(null); }}>
    <DialogContent className="flex h-[85dvh] max-w-5xl flex-col gap-2 p-3 sm:p-4">
      <DialogHeader className="pr-8">
        <DialogTitle>Navegador de GENEAI</DialogTitle>
        <DialogDescription className="truncate">{url ? new URL(url).host : ''}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setRevision((r) => r + 1)}><RefreshCw className="h-4 w-4" /> Recargar</Button>
        <Button size="sm" variant="outline" asChild><a data-external-browser="true" href={url ?? undefined} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Abrir en navegador</a></Button>
      </div>
      <p className="text-xs text-muted-foreground">Si el sitio impide la vista integrada o requiere autorización, usa Abrir en navegador.</p>
      {url && <iframe key={`${revision}:${url}`} title="Página externa" src={url} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" className="min-h-0 flex-1 rounded-lg border bg-white" />}
    </DialogContent>
  </Dialog>;
}
