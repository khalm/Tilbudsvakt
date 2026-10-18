# Tilbudsvakt

**Skriv hva du trenger, så følger Tilbudsvakt med på tilbud og varsler deg.**
Håndklær, teskjeer, ved, kaffe, kattemat – både dagligvarer og alt annet.

👉 App: **https://khalm.github.io/tilbudsvakt/** (installer den fra menyen i Chrome: «Legg til på startskjermen»)

## Slik virker det

1. **Legg til et ønske** i appen. Ønsket lagres som et issue med etiketten `ønske` i dette repoet.
2. **To ganger om dagen** (og med en gang du legger til eller endrer et ønske) kjører
   GitHub Actions `scripts/sjekk.mjs`, som søker i:
   - **eTilbudsavis/Tjek** – kundeaviser fra dagligvare, Europris, Jula, Clas Ohlson, byggvare m.m. Ingen nøkkel.
   - **Kassalapp** – dagligvarer med prishistorikk. Valgfritt, krever gratis nøkkel (se under).
3. **Varsel**: nye tilbud postes som kommentar på ønsket → push-varsel i GitHub-appen.
   Valgfritt også via [ntfy](https://ntfy.sh).
4. **Kjøpt?** Lukk ønsket, så stopper varslene.

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

Mangler et synonym? Legg det til i `lib/synonymer.js`, eller skriv det under «Andre ord» på ønsket.

## Felt i et ønske (issue-teksten)

```
Makspris: 200
Andre ord: frottéklut, gjestehåndkle
Unngå: papir, stativ
Butikker: Europris, Jysk
```
Alle feltene er valgfrie og kan endres når som helst.

## Oppsett (alt gratis)

- **Kassalapp (dagligvarer med prishistorikk):** lag nøkkel på https://kassal.app/api og legg den som
  repo-secret `KASSALAPP_API_SECRET` (Settings → Secrets and variables → Actions).
- **ntfy (valgfritt):** finn på et hemmelig emnenavn, legg det som secret `NTFY_TOPIC`
  og abonner på samme navn i ntfy-appen.
- **Varsler i GitHub-appen:** slå på push for «Issues»/«Participating» i GitHub-appen på telefonen.

## Utvikling

```
npm test          # tester matcheren
npm run sjekk     # kjører sjekken (trenger GITHUB_TOKEN)
```
Versjonen står i `package.json`, `app.js` (`VERSJON`) og `sw.js` (`CACHE`) – oppdater alle tre.
