import { useEffect, useRef, useState } from "react";
import { Mic, Square, Check, X, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Rec = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

const getRecognition = (): (new () => Rec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Mic button: speech is transcribed into a review box; nothing changes the field until the technician approves. */
export function VoiceDictation({ value, onApply, disabled, label }: { value: string; onApply: (text: string) => void; disabled?: boolean; label: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<Rec | null>(null);

  useEffect(() => { setSupported(!!getRecognition()); return () => rec.current?.abort(); }, []);
  if (!supported || disabled) return null;

  const start = () => {
    const R = getRecognition(); if (!R) return;
    const r = new R();
    r.lang = navigator.language || "en-GB"; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let fin = "", mid = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]!; if (res.isFinal) fin += res[0].transcript; else mid += res[0].transcript; }
      if (fin) setDraft((d) => `${d ?? ""}${d ? " " : ""}${fin.trim()}`);
      setInterim(mid);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone access was blocked. Allow it in your browser settings." : "Couldn't hear that — try again.");
    r.onend = () => { setListening(false); setInterim(""); };
    setError(""); setDraft((d) => d ?? ""); rec.current = r; r.start(); setListening(true);
  };
  const stop = () => rec.current?.stop();
  const close = () => { rec.current?.abort(); setDraft(null); setInterim(""); setError(""); };
  const apply = (mode: "append" | "replace") => {
    const t = (draft ?? "").trim(); if (!t) return;
    onApply(mode === "replace" || !value.trim() ? t : `${value.trimEnd()}\n${t}`); close();
  };

  return (
    <div className="mt-1.5">
      {draft === null ? (
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={start} aria-label={`Dictate ${label}`}><Mic className="mr-1 h-4 w-4" />Dictate</Button>
      ) : (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {listening ? <><span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />Listening… speak now</> : "Check the text, edit if needed, then approve."}
          </div>
          <Textarea rows={3} value={draft + (interim ? ` ${interim}` : "")} onChange={(e) => setDraft(e.target.value)} readOnly={listening} placeholder="Your words appear here" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {listening ? <Button type="button" size="sm" variant="secondary" onClick={stop}><Square className="mr-1 h-3.5 w-3.5" />Stop</Button>
              : <Button type="button" size="sm" variant="outline" onClick={start}><Mic className="mr-1 h-3.5 w-3.5" />Keep talking</Button>}
            <Button type="button" size="sm" disabled={listening || !draft?.trim()} onClick={() => apply("append")}><Check className="mr-1 h-3.5 w-3.5" />{value.trim() ? "Approve & add" : "Approve"}</Button>
            {value.trim() && <Button type="button" size="sm" variant="outline" disabled={listening || !draft?.trim()} onClick={() => apply("replace")}><Replace className="mr-1 h-3.5 w-3.5" />Replace</Button>}
            <Button type="button" size="sm" variant="ghost" onClick={close}><X className="mr-1 h-3.5 w-3.5" />Discard</Button>
          </div>
        </div>
      )}
    </div>
  );
}
