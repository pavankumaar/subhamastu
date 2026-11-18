import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal typing for the browser Web Speech API (Chrome/Android and Safari/iOS expose it, often as webkit-prefixed).
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const speechWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

const errorMessages: Record<string, string> = {
  'not-allowed': 'Microphone is blocked. Allow microphone access for this site in your browser settings.',
  'service-not-allowed': 'Microphone is blocked. Allow microphone access for this site in your browser settings.',
  'no-speech': "Didn't catch that — tap the mic and try again.",
  'audio-capture': 'No microphone found on this device.',
  network: 'Voice input needs an internet connection.',
}

// Speech-to-text for a text box: `onText` receives the box text (what was typed before + what is being said).
export function useSpeechInput(onText: (text: string) => void, lang = 'en-IN') {
  const [isListening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onTextRef = useRef(onText)
  const isSupported = Boolean(getRecognitionConstructor())

  useEffect(() => {
    onTextRef.current = onText
  })

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(''), 5000)
    return () => window.clearTimeout(timer)
  }, [error])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // Discards the recording (e.g. the message was sent): no late result may refill the box.
  const cancel = useCallback(() => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    setListening(false)
    recognition?.abort()
  }, [])

  const start = useCallback(
    (existingText: string) => {
      const Recognition = getRecognitionConstructor()
      if (!Recognition || recognitionRef.current) return
      const recognition = new Recognition()
      recognition.lang = lang
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      const prefix = existingText.trim() ? `${existingText.trim()} ` : ''
      recognition.onresult = (event) => {
        if (recognitionRef.current !== recognition) return
        let transcript = ''
        for (let index = 0; index < event.results.length; index += 1) {
          transcript += event.results[index][0].transcript
        }
        onTextRef.current(`${prefix}${transcript.trim()}`)
      }
      recognition.onerror = (event) => {
        if (recognitionRef.current !== recognition) return
        if (event.error !== 'aborted') setError(errorMessages[event.error] ?? 'Voice input stopped. Please try again.')
      }
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return
        recognitionRef.current = null
        setListening(false)
      }

      recognitionRef.current = recognition
      setError('')
      setListening(true)
      try {
        recognition.start()
      } catch {
        recognitionRef.current = null
        setListening(false)
        setError('Voice input could not start. Please try again.')
      }
    },
    [lang],
  )

  return { isSupported, isListening, error, start, stop, cancel }
}
