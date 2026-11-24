# Radiography Recorder

Radiography Recorder by ERI: a mobile app for **Android and iPhone** (one codebase), with Firebase as the backend.

Built with Expo (React Native + TypeScript), Expo Router, Reanimated and the Firebase JS SDK.

## What the app does

A tool for a radiography clinic's staff. Everything in the app is in Albanian. After signing in there are three tabs:

| Tab | What it is for |
| --- | --- |
| **Pacientët** | Every patient record (newest first) with search, and a form to add, change and delete a record. |
| **Raporte** | Reports: how many patients each referring doctor sent, per month and per year. |
| **Stoku** | The store room: products with quantities and low-stock warnings, and a list of what has to be bought. |

Sign-in is by email and password (Firebase Authentication, staff only: there is no sign-up screen). The
**Më mbaj mend** ("Remember me") box keeps a person signed in on that device until they press **Dil** (sign out).

**Status:** the login, the design system, the patient records, the reports and the stock tab are done. Nothing has been
tested on a real phone yet, and the Firestore security rules still have to be published (see "Before real use").

## What a record holds

Name and surname, ID card, residence, age, referring doctor, exam type, film type, and the **exam date and time**
(taken automatically when the record is first saved and never changed afterwards, so reports can rely on it).
Referring doctor, exam type and film type are type-or-choose fields: pick a saved value or type a new one (it is remembered when the
record is saved). Their values can be added, renamed and deleted from "Menaxho listën"; saved records keep the text
they were saved with. Required: name and surname (two words), age, exam type, film type.

## Reports

The **Raporte** tab shows, for the chosen month and the whole year of that month, how many patients each referring
doctor sent, and what they sent as simple "exam + film" lines (for example "Gjoksi · 24 × 30 cm: 4"), plus totals
by exam type and by film type. Tap "Muaji" or "Viti" to choose which period the lists show; both totals are always
visible. Different spellings of a doctor ("Dr. Hoxha", "dr hoxha", "Hoxha") count as one, and records with no doctor
are grouped last. The month arrows go back up to 5 years.

The patient list shows the newest 500 records, 10 at a time ("Ngarko edhe 10"); search looks through all of them.
The reports read every record of the year (up to 10,000), so they are not limited by the list.

## Stock

The **Stoku** tab (after Raporte) has two tables at the top:

- **Stoku**: the products in the store room (films, contrast, gloves...). Each has a name, a quantity, a unit
  (for example "kuti") and a minimum. The round **−** and **+** buttons change the quantity at once. When the quantity
  falls to the minimum the product is marked **Pak**; at 0 it is marked **Mbaroi**, and "Shto në listë" puts it on the
  buy list in one tap. Tap a product to change or delete it; "Produkt i ri" adds one; search finds products.
- **Lista për t'u blerë**: what has to be bought. Type a product with its **Sasia** and **Njësia** (they start as 1 and
  "copë") and press "+" to add it; the pencil on a line changes its name, amount or unit. Tap a line when it has been
  bought (it moves to "Të blera"), and "Pastro" removes the bought ones. The tab shows how many are still to buy.
  "Shto në listë" on a low product adds 1 of its unit.

Products live in `stock`, the buy list in `shopping` (both in `firestore.rules`). The lists load the first time the tab opens.

## Run it

```bash
npm install
npx expo start        # then press "a" for Android, "i" for iPhone (needs the Expo Go app), or scan the QR code
```

Firebase settings live in `.env` (copy `.env.example` if it is missing). The sign-in screen needs
**Email/Password** switched on in Firebase console > Authentication > Sign-in method, and at least one user.

While developing you can also sign in with a built-in **demo account**. Its email and password are not in the code: put
`EXPO_PUBLIC_DEMO_EMAIL` and `EXPO_PUBLIC_DEMO_PASSWORD` in your own `.env` (see `.env.example`; `.env` is git-ignored, so
they never reach the repository). Without them there is no demo account. It works without Firebase, only in development
runs (`npm start`, Expo Go, web preview) and never in installed builds. Demo data is stored on that device/browser
only. Real accounts store records in Firestore. Restart `npx expo start` after changing `.env`.

## Checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint
npx expo-doctor
```

## Build (cloud, no Mac or Android Studio needed)

```bash
npx eas-cli@latest build --platform android --profile preview     # installable .apk
npx eas-cli@latest build --platform ios --profile production       # needs an Apple Developer account
```

`.env` is git-ignored, so EAS does not see it. The six public `EXPO_PUBLIC_FIREBASE_*` values are therefore also
listed in `eas.json` (`build.base.env`), which both profiles use. If you ever change them in `.env`, change them
there too. Commit `eas.json` and `google-services.json` before building.

## Before real use (Firebase console)

1. **Authentication > Get started**, then enable **Email/Password** and add your users (Authentication > Users).
2. **Authentication > Settings > User actions**: turn off "Enable create (sign-up)". Otherwise anyone who finds
   the public API key can create an account, and the screen says "Authorized staff only".
3. **Firestore Database > Create database**, then open its **Rules** tab, paste the contents of `firestore.rules`
   and press **Publish**. Records live in `radiographs`, the pick-lists in `settings/options`, the Stoku tab in
   `stock` and `shopping`. Publish the rules again whenever `firestore.rules` changes, or those saves are refused.
4. **The staff list** (the rules need it, otherwise the app can read and save nothing). For every person who signs in:
   copy their **User UID** from Authentication > Users, then in Firestore Database > Data press **Start collection**
   (first time) or **Add document** in the collection `staff`, set **Document ID** to that UID, add one field
   `active` (boolean) = `true`, and save. To remove someone, delete their `staff` document and their user.

## Security

What keeps the data and the phone safe, and what is left for you to watch:

- **Only staff get in.** Sign-in is Firebase Authentication with no sign-up screen, and the database rules also require
  a `staff` document for the person's UID (step 4 above). A stranger with an account, or with the public API key, can
  read and change nothing. The `staff` collection itself cannot be read or changed by the app.
- **The rules check the data.** Only the known fields, with the right types and sizes; the exam date, the creation time
  and the creator of a record can never be changed; everything not listed is closed. `tests/firestore-rules.test.mjs`
  runs 58 checks of this against the Firestore emulator (instructions at its top): run it before publishing new rules.
  `tests/chunked-storage.test.js` does the same for the encrypted sign-in storage (25 checks).
- **The app locks itself.** When a saved sign-in comes back on its own (the app was closed and opened again), and when the
  app returns after more than 30 seconds in the background, a lock screen covers everything until the person proves who
  they are with the phone's own fingerprint, face, or PIN / pattern / password. Typing the password does not trigger it.
  "Dil nga llogaria" on the lock screen signs out. A phone with no screen lock set cannot be locked, so the app stays open
  there (set a screen lock on every phone that runs it). The web version never locks. Screenshots are deliberately not blocked.
- **The saved sign-in is encrypted.** "Më mbaj mend" keeps the Firebase session in the phone's secure store (Android
  Keystore / iPhone Keychain) instead of plain storage, through `src/lib/secureStorage.ts`. After updating from a build
  that used plain storage, everyone signs in once more, and the old plain copy is deleted. On an iPhone the Keychain can
  survive an uninstall, so press "Dil" before removing the app from a phone that will be handed on.
- **No back door.** The demo login exists only in development runs (`__DEV__`) and its email and password live in the
  git-ignored `.env`. The Android and web builds were exported and searched: neither the demo email nor its password is
  inside them. The app has no over-the-air code updates (`expo-updates` is not installed), no web views and no `eval`.
- **The phone is not exposed.** The Android app asks only for `INTERNET`, `VIBRATE` and the two fingerprint permissions
  (`USE_BIOMETRIC`, `USE_FINGERPRINT`, for the lock screen); the "draw over other apps" and storage permissions are
  blocked in `app.json` (`blockedPermissions`). Backups are off (`allowBackup: false`), traffic
  is HTTPS only, and the app's own link (`radiographyrecorder://`) only opens screens behind the sign-in.
- **Public values are not secrets.** The Firebase API key and ids in `eas.json` only name the project (Google says so);
  the rules above are what protect the data. No private key, password or token is in the repository or its history.
- **Known audit warnings.** `npm audit` lists `@grpc/grpc-js` (inside `firebase`) and `minimatch` (a build tool). The
  gRPC code is Node-server code that is not in the phone or web bundle (checked), and the suggested fix would downgrade
  Firebase to version 9 and Expo to 52, so it is deliberately not applied. Look again when Firebase publishes a new 12.x.

Do these in the Firebase and GitHub settings (they cannot be done from the code):

1. Authentication > Settings > User actions: **Enable create (sign-up)** stays OFF, and **Email enumeration
   protection** ON.
2. Use a long, unique password for every account (a short pattern like a name plus digits can be guessed), and change
   any password that was ever shared in a chat or message.
3. Leave the Firebase API key's restrictions as Firebase created them. Do not add "Android apps" or "Websites"
   restrictions in Google Cloud: the app talks to Firebase from JavaScript, which does not send those details, so
   sign-in would stop working.
4. Make the GitHub repository **private** (Settings > General > Danger zone > Change visibility). The app does not need
   it to be public, and a public repository shows attackers how it is built.
5. A lost or stolen phone: delete that person's `staff` document at once (the phone then gets no data), then delete or
   disable their user in Authentication, and keep a screen lock on every phone that runs the app.

## The design

The look comes straight from the logo and is defined once, in `src/theme/`:

| What | Value |
| --- | --- |
| Canvas | `#191919` (the logo's own background) |
| Brand gradient | `#43D5D1` (top of the lungs) to `#21B2E8` (base), always top to bottom |
| Text | `#F9F9F9`, Poppins (Bold / SemiBold / Regular / Light, as in the logo) |

Idea: a dark reading room with a light-box. The logo is the "film": on arrival a scan beam exposes the lungs,
then they breathe and a small light orbits along the logo's own ring (slipping behind the lungs on the far side).
The `R` and `L` corner markers at the top frame each screen like a radiograph viewer (the lead marker `R` sits
on the left, as on a real chest film).

Reuse these for every new screen:

- `Screen` (backdrop + safe areas), `HudBar`, `Card`
- `GlowField`, `GradientButton`, `Banner`, `AppText`, `Icon`
- `BrandHero` (animated logo) and `Wordmark`
- `src/constants/strings.ts` holds all user-facing text (one file to translate)

Motion respects the phone's "reduce motion" setting. `src/components/brand/logoPaths.ts` is generated from the
logo and should not be edited by hand.

## Structure

```
src/app/            screens (Expo Router): _layout (fonts, splash, sign-in gate), login, index (records list), record (add/change/delete), reports, stock
src/utils/          reports.ts (the counting behind the Raporte tab), stock.ts (low-stock rule, sorting), text.ts, dates.ts ...
src/components/     brand/ (logo hero), ui/ (reusable pieces, incl. ComboField = type-or-choose field), stock/ (the two Stoku tables) and lock/ (the fingerprint / PIN lock screen)
src/context/        AuthContext (Firebase Auth + the development demo account), RecordsContext (records + pick-lists), StockContext (stock + buy list)
src/lib/            firebase.ts (Auth + Firestore setup), storage.ts (shared read/write helpers), records.ts and stock.ts (reads/writes), demoAccount.ts (development-only demo sign-in, credentials from .env), secureStorage.ts (encrypted saved sign-in), deviceLock.ts (the phone's unlock prompt)
src/theme/          colors, typography, spacing, motion
```
