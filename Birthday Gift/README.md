# 🎂 Birthday Memory Museum

Turn someone's photos into a **3D museum** they can walk through on their phone.

They open a link. They're standing in a quiet gallery. As they scroll, photos of the two of you drift past on the walls, each with a little caption. Music plays. At the end of the corridor there's a birthday cake with candles still lit — and they blow into their phone's microphone to put them out. Then your letter appears.

You build the gift on your computer. You send one link. That's it.

---

## Do I need to know how to code?

**No.** Not one bit.

You will type a few lines into a black window. You don't need to understand them — just copy them exactly as written. If you can follow a recipe, you can do this.

You'll need about **30 minutes** the first time.

---

## What you need before starting

- A Windows PC or a Mac
- An internet connection
- The photos and videos you want to use
- A song, if you want music (optional)

That's all. You do **not** need VS Code, or any programmer tools, or a paid account anywhere.

---

# Part 1 — Install Node.js (one time only)

Node.js is a free program that lets your computer run this project. You install it once and never think about it again.

### Step 1.1 — Download it

Go to **[nodejs.org](https://nodejs.org)**

You'll see a big green download button that says something like **"Download Node.js (LTS)"**. LTS means "the stable one" — that's the one you want. Click it.

> **Note:** This project was tested on Node.js version 22. Any version from 20 upward is fine. Always pick the **LTS** button, never the one labelled "Current".

### Step 1.2 — Install it

Open the file you just downloaded and click **Next → Next → Install**. Accept everything it suggests. Don't change any settings.

If Windows asks *"Do you want to allow this app to make changes?"* — click **Yes**.

If you see a checkbox about "Tools for Native Modules", you can leave it unchecked. You don't need it.

### Step 1.3 — Restart your computer

Please actually do this. Node.js needs a restart to become usable everywhere, and skipping it causes the single most common problem people hit later ("node is not recognised").

### Step 1.4 — Check it worked

Open the black typing window:

- **On Windows:** Press the `Windows` key, type `cmd`, press `Enter`.
- **On Mac:** Press `Cmd` + `Space`, type `terminal`, press `Enter`.

This window is called the **Terminal**. It's just a place where you type instructions instead of clicking them. You'll use it a few times.

Type this and press `Enter`:

```bash
node -v
```

You should see something like `v22.19.0`. The exact numbers don't matter as long as the first number is 20 or higher.

**If it says "node is not recognised"** — Node.js didn't install properly, or you skipped the restart. Restart your computer and try again. If it still fails, reinstall Node.js.

---

# Part 2 — Set up the project (one time only)

### Step 2.1 — Put the project folder somewhere easy

You should have a folder called **`Birthday Gift`**. Move it somewhere simple and easy to find, like your **Desktop** or your **Documents** folder.

**Important:** Avoid folder names with unusual symbols in them (`#`, `%`, `&`). Spaces are fine.

### Step 2.2 — Open the Terminal *inside* that folder

This is the one step people find fiddly, so here are three ways to do it. Any of them works.

**Windows — the easy way:**
1. Open the `Birthday Gift` folder in File Explorer so you can see `package.json` inside it.
2. Right-click on any empty white space inside the folder.
3. Choose **"Open in Terminal"**.

**Windows — if you don't see that option:**
1. Open the `Birthday Gift` folder.
2. Click on the **address bar** at the top (the strip showing the folder path).
3. Type `cmd` over it and press `Enter`.

**Mac:**
1. Right-click the `Birthday Gift` folder.
2. Choose **Services → New Terminal at Folder**.

**How to know you did it right:** The text at the start of the line in your Terminal should end with `Birthday Gift`. Something like:

```
D:\Desktop\Birthday Gift>
```

If it ends with your username instead, you're in the wrong place. Try again.

### Step 2.3 — Install the project's parts

Type this and press `Enter`:

```bash
npm install
```

Now wait. This downloads everything the project needs — around 30 seconds to 3 minutes depending on your internet.

You'll see a lot of text scrolling past. **This is normal.** You may also see warnings in yellow, and lines mentioning `deprecated`. **Those are normal too** — ignore them completely.

You'll know it finished when you can type again, and you see a line like `added 240 packages`.

**Only worry if you see the word `ERR!` in red.** Jump to [Problems and fixes](#problems-and-fixes) at the bottom.

> **Good news:** everything needed to shrink photos and convert videos comes bundled in this step. You do **not** need to install Photoshop, FFmpeg, or anything else separately.

---

# Part 3 — Open the Studio and build your gift

The **Studio** is your workshop. It's where you add photos, write the letter and pick the music. It runs entirely on your own computer.

### Step 3.1 — Start it

In the same Terminal window, type:

```bash
npm run studio
```

You'll see:

```
Birthday Gift Studio -> http://localhost:4321
```

### Step 3.2 — Open it in your browser

Open Chrome (or Edge, or Firefox) and go to:

**http://localhost:4321**

The Studio appears. 🎉

### ⚠️ Two important things about the Terminal

1. **Leave the Terminal window open.** It's running the Studio. If you close it, the Studio stops working and your browser page goes blank. Just push it behind your browser.

2. **To stop the Studio later,** click the Terminal window and press `Ctrl` + `C`. To start it again, type `npm run studio` again.

Your work is saved automatically as you go, so stopping and restarting never loses anything.

### Step 3.3 — Fill in the gift

Work down the panel on the left. The preview on the right updates as you go.

**Who is it for?**
Type the birthday person's name. Up to 40 characters. This appears on the cake and in the final message — the gift won't publish until you set it.

**Photos & videos**
Drag your pictures onto the drop area, or click it to browse.

- **Up to 16 items** in total. This isn't stinginess — it's what keeps the museum smooth on an average phone.
- **Maximum 3 videos.** More than that and phones start to stutter, so the Studio will stop you.
- Photos are hung alternately on the left and right walls automatically.
- Give each one a **caption** (up to 80 characters) — a few words, an inside joke, a date. These float beside the photo as the visitor walks past.
- Drag the items in the list to reorder them. The order is the order they'll be walked past, so this is your storytelling — put the best one last, right before the cake.

Your originals are never touched or moved. The Studio makes its own optimised copies.

**Background music**
Click **Choose a track** and pick an MP3 or M4A. Use the volume slider to set the level.

The room's lights react to the music — they pulse and change colour on the beat, and coloured light spills across the polished floor. A song with a clear rhythm looks noticeably better than something ambient.

> Phones and browsers refuse to play sound until the visitor taps the screen. That's a rule built into every phone, not a bug here — the gift opens with a "tap to begin" screen, which takes care of it.

**The letter**
The message revealed after the candles go out. Up to 1200 characters. This is the heart of the gift — take your time.

**Candles**
Up to 12. A nice touch is to match their age if it's 12 or under, otherwise just pick a number you like.

### Step 3.4 — Test it properly

Above the preview there are buttons: **Auto / Low-end phone / Mid phone / Desktop**, and a **Desktop / Phone** switch.

Use them. Your computer is almost certainly nicer than the phone this will be opened on. Click **Low-end phone** and check it still looks good and moves smoothly.

### Step 3.5 — Fix anything it flags

If a red box appears listing problems, the **Export & Publish** button stays greyed out until you deal with them. You might see:

| Message | What to do |
|---|---|
| *Add at least one photo before publishing.* | Add a photo. |
| *Set the birthday person's name.* | Fill in the name field. |
| *4 videos is more than a phone can decode smoothly — keep it to 3.* | Remove a video, so you have 3 or fewer. |
| *The corridor holds 16 frames — remove a few.* | Remove some photos. |

---

# Part 4 — Publish it and get your link

Now you turn your gift into a real website with a real link.

### Step 4.1 — Export

Click the **Export & Publish** button at the bottom of the panel.

The button changes to **"Building..."**. Give it up to a minute — it's shrinking every photo into several sizes so the gift loads fast on a phone.

When it's done you'll see a card saying **"Ready to publish"**, telling you how many frames were built and the total size.

### Step 4.2 — Get your link with Netlify Drop

**Netlify** is a free service that puts websites online. You don't need an account to try it, and you don't need to pay.

Click the button that says **Download & drag to Netlify Drop**.

Two things happen at once:
1. A file called **`gift.zip`** downloads to your Downloads folder.
2. A new browser tab opens at **[app.netlify.com/drop](https://app.netlify.com/drop)**.

Now:

1. Open your **Downloads** folder next to the browser window.
2. **Drag `gift.zip`** out of Downloads and drop it onto the big dashed box on the Netlify page.
3. Wait about 30 seconds while it uploads.

Netlify shows you a link, something like:

```
https://spontaneous-cupcake-8f2a1c.netlify.app
```

**That's your gift.** Open it and try it yourself.

> **Do not unzip `gift.zip` first.** Netlify wants the zip exactly as it is.

### Step 4.3 — 🔴 Claim the site so it doesn't disappear

**This is the most important step on the page. Please don't skip it.**

A site dropped without an account is **temporary**. Netlify will eventually delete it, and your link will die — possibly before the birthday.

On the page showing your new link, look for **"Claim site"** or a prompt to sign up. Click it and make a free account (signing in with GitHub, GitLab or an email address all work).

Once claimed, the site is permanently yours and the link keeps working.

### Step 4.4 — Give the link a nicer name (optional)

`spontaneous-cupcake-8f2a1c` isn't very romantic. Once you've claimed the site:

1. In Netlify, open your site.
2. Go to **Site configuration → Site details**.
3. Click **Change site name**.
4. Type something like `happy-birthday-rahul`.

Your link becomes:

```
https://happy-birthday-rahul.netlify.app
```

Much better. The old link keeps working too.

### Step 4.5 — Test on a real phone before you send it

Do this. It takes two minutes and it's the difference between a gift that lands and one that doesn't.

Just open the link on your own phone. Check that:

- The photos load
- The music starts after you tap
- Scrolling is smooth
- **Blowing on the microphone puts the candles out**

That last one is worth testing properly, because it's the moment the whole gift is built around. Blow steadily across the bottom of the phone, the way you'd blow out a real candle. Tapping a candle also works, as a backup for anyone whose microphone is blocked or denied.

**Send it in a normal message.** WhatsApp, Instagram, iMessage — any of them. The link is all they need. Nothing to install.

---

## Extra: publishing straight from the Studio

Optional, and only worth it if you expect to make several gifts. It skips the download-and-drag entirely.

Install Netlify's command-line tool once. In a Terminal (any folder is fine):

```bash
npm install -g netlify-cli
```

Then log in — this opens your browser:

```bash
netlify login
```

Now go back to the Studio and click **Export & Publish** again. You'll see a new button: **Publish now**. Click it, and about 30 seconds later your link appears right there in the Studio, no dragging involved.

If this doesn't work for any reason, the drag-and-drop route is always still there. Nothing is lost.

---

## Making changes after publishing

Very common. You spot a typo in the letter, or find a better photo.

1. Start the Studio again (`npm run studio`) and make your changes.
2. Click **Export & Publish** again.
3. Drop the new `gift.zip` into Netlify.

To keep **the same link**, go to your existing site in Netlify first, open its **Deploys** tab, and drop the new zip there — not onto the Drop homepage, which would create a brand new site with a different link.

---

## Problems and fixes

### "node is not recognised" / "npm is not recognised"

Node.js isn't installed, or you didn't restart after installing. Restart your computer. If it still happens, reinstall from [nodejs.org](https://nodejs.org) and pick the **LTS** version.

### "Port is already in use" / "EADDRINUSE"

The Studio is already running in another Terminal window you forgot about. Either switch to that window and use it, or close all Terminal windows and start fresh with `npm run studio`.

### localhost:4321 won't open, or says "can't reach this page"

Check the Terminal window is still open and still shows the `Birthday Gift Studio ->` line. If you closed it, or pressed `Ctrl` + `C`, the Studio has stopped — just run `npm run studio` again.

Also check the address carefully: `localhost:4321`, not `localhost:4321/index.html` or `https://`.

### `npm install` fails with red `ERR!` lines

Usually the internet dropped mid-download. Check your connection and run `npm install` again — it's safe to repeat as many times as you like.

If it keeps failing, delete the `node_modules` folder inside `Birthday Gift` and run `npm install` once more.

### The Export & Publish button is greyed out

There's a red box of problems above it. Fix those first — see [Step 3.5](#step-35--fix-anything-it-flags).

### A video won't upload, or looks broken

Try converting it to **MP4** first, and keep it short — 10 to 15 seconds is plenty. Long videos are the main cause of stutter on phones. Remember the limit is 3 videos.

### No music on the phone

The visitor has to **tap the screen first** — every phone browser blocks sound until they do. If it still won't play, check the phone isn't on silent, and that you actually picked a track in the Studio.

### Blowing doesn't put the candles out

- The browser must have been **allowed** to use the microphone. Look for the permission popup and tap Allow. If it was dismissed, reload the page.
- Blow **steadily across** the bottom of the phone rather than hard at the screen.
- On a laptop with no microphone, nothing will happen — that's expected. **Tapping each candle** always works as a fallback.

### It's slow or stuttery on a phone

The gift already lowers its own quality automatically on weaker phones, so this is uncommon. If it happens:

- Remove a video or two — videos cost the most by far.
- Use fewer photos.
- Ask them to close their other browser tabs.

---

## For the curious: what's in the folder

You never need to touch any of this, but in case you're wondering:

| Folder / file | What it is |
|---|---|
| `studio/` | The workshop screen you use to build the gift |
| `src/` | The 3D museum itself — the room, cake, lights, camera |
| `server/` | Runs the Studio and shrinks your photos and videos |
| `gifts/current/` | Your work in progress, saved automatically |
| `dist/` | The finished website, rebuilt each time you export |
| `gift.zip` | The finished website in one file — this is what you drag to Netlify |
| `package.json` | The list of parts `npm install` fetches |

And the commands, all of which are run inside the `Birthday Gift` folder:

| Command | What it does |
|---|---|
| `npm install` | Fetches the project's parts. Once, at the start. |
| `npm run studio` | Opens the Studio at http://localhost:4321. **This is the one you'll use.** |
| `npm run build` | Builds the site by hand. The Export button does this for you. |
| `npm run dev` | For developers only — runs the museum on its own at http://localhost:3000 |

---

## A few notes on privacy

- The Studio runs only on your own computer. Nothing leaves it while you're building.
- The **only** moment anything is uploaded is when you drag `gift.zip` to Netlify, or press **Publish now** — both of which you trigger yourself, deliberately.
- Once published, the link is **public to anyone who has it**. It isn't listed or searchable anywhere, but treat it as you'd treat any link: whoever you send it to can forward it. Bear that in mind with the photos and the letter you choose.

---

Made with care. Go make someone's day. 🎉
