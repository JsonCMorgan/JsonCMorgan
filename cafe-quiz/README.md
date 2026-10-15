# Boundry Cafe Drills

Phone-friendly quiz PWA for Jasonâ€™s cafe / happy-hour talk track.

## Modes

- **Flashcards** â€” term â†’ meaning + spoken cafe sentence
- **Multiple choice** â€” check yourself with short explanations
- **Mixed deck** â€” both shuffled

Content follows the honest junior framing: Boundry custom stack, CompTIA CC + Security+ focus, no dumps, Boundry â‰  Security Onion.

## Phone URL (cellular / cafe Wi-Fi)

**https://jsoncmorgan.github.io/JsonCMorgan/cafe-quiz/**

Works on cellular. After first open: Share → Add to Home Screen (then often works offline too).

## Run on your phone

1. Serve this folder over HTTPS or localhost (GitHub Pages, `npx serve`, etc.).
2. Open `index.html` on your phone.
3. **iPhone:** Share â†’ Add to Home Screen  
   **Android:** browser menu â†’ Install app

Offline cache is handled by the service worker after the first visit.

## Local preview

```bash
cd cafe-quiz
python3 -m http.server 8080
```

Then open `http://localhost:8080` (or your machine IP on the phone on the same Wiâ€‘Fi).

