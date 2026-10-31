import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { boundedPermission } from '@/lib/permission-sequence';

export function QrCamera({ onScan }: { onScan: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const active = useRef(false);
  const stopDecoder = useRef<(() => void) | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const stop = () => {
    active.current = false;
    stopDecoder.current?.(); stopDecoder.current = undefined;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = undefined;
  };
  useEffect(() => () => stop(), []);
  const start = async () => {
    stop(); active.current = true; setOpen(true); setStatus('Opening camera…');
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('Camera unavailable. Use the reference below.'); return; }
    try {
      // Start permission directly in the tap, before loading the decoder.
      const requested = navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      void requested.then(value => { if (!active.current) value.getTracks().forEach(track => track.stop()); }).catch(() => {});
      const media = await boundedPermission(() => requested, 15000);
      if (!media) { stop(); setStatus('Camera did not open. Check camera permissions and try again, or use the reference below.'); return; }
      if (!active.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (!active.current || !video.current) { stop(); return; }
      let detected = false;
      const controls = await new BrowserQRCodeReader().decodeFromStream(media, video.current, result => {
        if (!result || !active.current || detected) return;
        detected = true;
        const text = result.getText();
        stop(); setOpen(false);
        navigator.vibrate?.(80);
        onScan(text);
      });
      if (!active.current) controls.stop();
      else { stopDecoder.current = () => controls.stop(); setStatus('Scanning…'); }
    } catch (error) {
      stop();
      setStatus(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access or use the reference below.'
        : 'Camera could not be opened. Try again or use the reference below.');
    }
  };
  return <>
    <Button type="button" className="h-12 w-full" onClick={start}><Camera className="mr-2 h-5 w-5"/>Scan with camera</Button>
    <Dialog open={open} onOpenChange={value => { if (!value) stop(); setOpen(value); }}>
      <DialogContent aria-describedby="camera-status" className="max-w-lg">
        <DialogHeader><DialogTitle>Scan QR code</DialogTitle></DialogHeader>
        <video ref={video} autoPlay muted playsInline aria-label="QR camera view" className="aspect-square w-full rounded-lg bg-muted object-cover"/>
        <p id="camera-status" role="status" className="text-sm text-muted-foreground">{status}</p>
        <Button variant="outline" onClick={() => { stop(); setOpen(false); }}><X className="mr-2 h-4 w-4"/>Use reference instead</Button>
      </DialogContent>
    </Dialog>
  </>;
}