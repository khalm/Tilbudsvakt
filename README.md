# Tilbudsvakt

**Skriv hva du trenger, så følger Tilbudsvakt med på tilbud og varsler deg.**
Håndklær, teskjeer, ved, kaffe, kattemat – både dagligvarer og alt annet.

👉 App: se `config.json` (adressen settes når appen publiseres). Installer den fra Chrome-menyen: «Legg til på startskjermen».

## Slik virker det

1. **Legg til et ønske** i appen. Ønskelisten lagres i en gratis Cloudflare Worker (ingen innlogging;
   listen er knyttet til en kode du kan bruke på flere telefoner).
2. **Med en gang** sjekker appen om det er tilbud nå.
3. **Hver tredje time** kjører GitHub Actions `scripts/sjekk.mjs`, som søker i:
   - **eTilbudsavis/Tjek** – kundeaviser fra dagligvare, Europris, Jula, Clas Ohlson, byggvare m.m.
   - **Kassalapp** – dagligvarer med prishistorikk.
4. **Varsel fra Tilbudsvakt** på telefonen (Web Push) når noe nytt dukker opp – også når appen er lukket.
5. **Kjøpt?** Trykk «Kjøpt / fjern».

### Oppbygging
- `worker/index.js` – Cloudflare Worker: serverer appen og API-et (ønsker, push, søk).
- `.github/workflows/deploy.yml` – publiserer Worker-en ved hver endring (lager KV-lagring og workers.dev-adresse selv).
- `.github/workflows/sjekk.yml` + `scripts/sjekk.mjs` – planlagt sjekk og varsler.
- `lib/` – matcher, synonymer, forslag og tilbudsformat (brukes både i appen og i sjekken).

## Synonymer – du trenger ikke vite hva butikken kaller det

`lib/matcher.js` sørger for at et ønske om **håndkle** også treffer
*håndklede, håndduk, håndklær, badehåndkle, frotté-håndkle, Håndkleet* – men **ikke** *håndklestativ* eller *tørkepapir*.

| Teknikk | Eksempel |
|---|---|
| Synonymgrupper (`lib/synonymer.js`) | håndkle → håndklede, håndduk, håndklær |
| Bøyninger | teskje / teskjeer / teskjer / teskjeene |
| Sammensatte ord (siste ledd teller) | bjørkeved ✔, vedovn ✘ |
| Æøå og aksenter | handkle = håndkle, frotte = frotté |
| Skrivefeil | håndklde → håndkle |
| Unngå-ord | «Unngå: papir» fjerner tørkepapir |

Mangler et synonym? Appen foreslår flere søkeord under hvert ønske, **mest sannsynlige først**:
1. Ord du selv har lagt til på lignende ønsker tidligere (lært)
2. Synonymer fra norsk Wiktionary og ConceptNet
3. Nabogrupper i synonymlisten (badelaken → strandlaken) og samme siste ledd (teskje → spiseskje)

Trykk på forslagene du vil ha og velg «Søk også etter valgte» eller «Unngå valgte».
Trykk × på et søkeord for å fjerne det (↺ angrer).

## Oppsett (alt gratis)

- **Kassalapp (dagligvarer med prishistorikk):** lag nøkkel på https://kassal.app/api og legg den som
  repo-secret `KASSALAPP_API_SECRET` (Settings → Secrets and variables → Actions).
- **ntfy (valgfritt):** finn på et hemmelig emnenavn, legg det som secret `NTFY_TOPIC`
  og abonner på samme navn i ntfy-appen.
- **Cloudflare:** repo-secret `CLOUDFLARE_API_TOKEN` (malen «Edit Cloudflare Workers»).
- **Push-varsler:** repo-secret `VAPID_PRIVATE_KEY` (den offentlige nøkkelen står i `app.js` og `scripts/sjekk.mjs`).

## Utvikling

```
npm test          # tester matcheren
npm run sjekk     # kjører sjekken (trenger GITHUB_TOKEN)
```
Versjonen står i `package.json`, `app.js` (`VERSJON`), `index.html` og `sw.js` (`CACHE`) – oppdater alle.
