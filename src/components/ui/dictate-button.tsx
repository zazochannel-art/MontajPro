"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Tipurile pentru Web Speech API; nu sunt în lib.dom. */
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Dictare pentru câmpurile de text.
 *
 * Pe șantier, cu mănuși, vorbitul bate tastatura. Unde API-ul lipsește (iOS
 * Safari), butonul nu apare deloc: acolo dictarea există oricum în tastatură.
 */
export function DictateButton({
  onText,
  className,
}: {
  onText: (text: string) => void;
  className?: string;
}) {
  // Disponibilitatea o citim ca stare externă: pe server nu există, pe client
  // da, iar `useSyncExternalStore` face trecerea fără nepotriviri la hidratare.
  const supported = useSyncExternalStore(
    () => () => {},
    () => getRecognition() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognition.current?.stop(), []);

  const toggle = useCallback(() => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return;

    const instance = new Ctor();
    instance.lang = "ro-RO";
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript;
      }
      if (text.trim()) onText(text.trim());
    };
    instance.onerror = () => {
      setListening(false);
      toast.error("Nu am auzit nimic");
    };
    instance.onend = () => setListening(false);

    recognition.current = instance;
    setListening(true);
    instance.start();
  }, [listening, onText]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Oprește dictarea" : "Dictează"}
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-xl border transition-colors md:size-11",
        listening
          ? "border-red-500/40 bg-red-500/15 text-red-300"
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {listening ? (
        <MicOff className="size-4 animate-pulse" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}
