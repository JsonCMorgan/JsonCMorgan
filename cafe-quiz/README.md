# Boundry Cafe Drills

Phone-friendly quiz PWA for Jason’s cafe / happy-hour talk track.

## Modes

- **Flashcards** — term → meaning + spoken cafe sentence
- **Multiple choice** — check yourself with short explanations
- **Mixed deck** — both shuffled

Content follows the honest junior framing: Boundry custom stack, CompTIA CC + Security+ focus, no dumps, Boundry ≠ Security Onion.

## Run on your phone

1. Serve this folder over HTTPS or localhost (GitHub Pages, `npx serve`, etc.).
2. Open `index.html` on your phone.
3. **iPhone:** Share → Add to Home Screen  
   **Android:** browser menu → Install app

Offline cache is handled by the service worker after the first visit.

## Local preview

```bash
cd cafe-quiz
python3 -m http.server 8080
```

Then open `http://localhost:8080` (or your machine IP on the phone on the same Wi‑Fi).
