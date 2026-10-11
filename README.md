# GPS Notary: documentation

*A notary for GPS truth. Detects when your location signal is being faked or jammed, and seals the proof so nobody can edit it later.*

---

## 0. Read this first: an honest reality check

I searched for existing products before building anything. Findings you must know before you pitch:

- **Crowdsourced GPS-interference detection with phones is NOT new.** It exists in research and prototypes: the CrowdShield app (EU Joint Research Centre, tested at Jammertest 2025 in Norway), the GNSSAlarm Android app (described in ION Navigation), and the TORGI app. Crowdsourcing jammer detection has also been discussed for 3GPP mobile standards.
- **Maritime has paid products.** PntGuard (Tschudi Shipping, NAL Research, SGM Technology, launched Oct 2025) alerts crews when a ship's position is falsified, and was piloted with the war-risk insurer DNK. ESA also funds SJAWS (a jamming/spoofing detection and alert system).
- **The problem is real and growing.** IMO, ICAO and ITU issued a joint statement of grave concern about rising jamming and spoofing, and Gulf shipping reports in 2026 describe interference as a persistent operating condition.

**What this means for you:** if you pitch "we detect GPS jamming," a good investor will say "that exists." So we do NOT pitch detection. We pitch the part that is missing:

> **Evidence you can trust, from a phone you already own, with zero install.**

Detection tools tell a crew "something is wrong." Nobody makes it easy to produce a **tamper-evident, independently checkable incident record** that an insurer, a claims adjuster or a regulator can rely on. That is the wedge.

I cannot promise "no one has ever made this." Nobody can. What you can honestly claim is: *"The detection research exists; the evidence layer and the zero-install entry point do not exist as a product that we could find."* Re-run the searches yourself before pitching (Section 9 lists what to search).

---

## 1. The idea in plain words

Your phone's GPS tells you where you are. Attackers can fake that answer (spoofing) or drown it out (jamming).

But your phone also has other senses: an accelerometer that feels movement, and a clock. A faker can fool the GPS, but they cannot easily fool the accelerometer in your hand.

**GPS Notary asks one simple question every second: "Does what GPS says match what the phone physically feels?"**

- GPS says you moved 60 km in one second, but physics says no: **alert**.
- GPS says you drifted 70 m, but the phone has been lying motionless on a table: **alert**.
- GPS time is two minutes off from the phone's own clock: **alert**.

Every alert is written into a log where each entry is locked to the one before it with a digital fingerprint (SHA-256). If anyone edits an old entry, every fingerprint after it breaks. That is the "notary" part.

---

## 2. The killer feature: Reality Check + Sealed Evidence

Two pieces that work as one feature:

1. **Reality Check (motion-sensor cross-check).** Catches the *sneaky* attack: slow drift. A smart spoofer moves your fake position slowly (a few metres per second) so no "teleport" alarm ever fires. Every GPS-only check passes. The phone's motion sensor still feels nothing, so Reality Check catches it. In the demo this is the "wow" moment: press **Slow drift**, watch the jump check stay green while the motion check turns red.
2. **Sealed Evidence.** Every incident is hash-chained. Download the report, hand it to anyone, and they can verify it with the built-in verifier. The **Tamper test** button edits one entry and shows verification failing, which is a great live demo.

---

## 3. What is in this folder

| File | What it is |
|---|---|
| `index.html` | The entire app (one file: page, style, logic). |
| `README.md` | This document. |
| `tests/test_core.js` | Optional: 21 automated checks of the detection logic (run with Node). |

The app has two layers inside `index.html`:
- **CORE** (between `==CORE-START==` and `==CORE-END==`): pure logic. Rules, scoring, hash chain. Easy to test.
- **App**: buttons, map, GPS and sensor reading.

### The checks (rules) it runs

| Rule | Catches | Notes |
|---|---|---|
| JUMP | Teleporting (position moves impossibly fast) | Limit is 20 m/s on foot, 90 m/s in vehicle mode. Ignores jumps smaller than the GPS accuracy, so noisy indoor GPS does not trigger it. |
| STILL_DRIFT | Slow drift while the phone is motionless | Needs 20 s of stillness first. Disabled in vehicle mode (see loopholes). |
| CLOCK_SKEW | Fake GPS time | GPS time vs the phone's own clock, 10 s tolerance. |
| SPEED_MISMATCH | Receiver speed disagrees with measured movement | Only if the device reports speed. |
| TZ_REGION | Location far from the device timezone's region | Low weight, since it may just be travel. Never creates an evidence entry alone. |

**Trust score** starts at 100. Each recent problem subtracts its weight for 30 seconds. 80+ is CONSISTENT, 50-79 SUSPICIOUS, below 50 LIKELY SPOOFED.

---

## 4. Loopholes, and the fix for each

| # | Loophole | Fix (in the prototype or planned) |
|---|---|---|
| 1 | **"Phone in a car looks still to the accelerometer."** A smooth vehicle or ship barely vibrates, so motion check would false-alarm. | **Built.** Mode switch: *Vehicle or boat* disables the motion-vs-GPS rule and relies on jump, clock and speed checks. Planned: fuse accelerometer with gyroscope and magnetometer heading. |
| 2 | **Noisy indoor GPS causes false alarms.** | **Built.** Every threshold scales with the reported accuracy. Tested with a 150 m accuracy wobble: no alarm. |
| 3 | **A browser cannot read raw satellite signal data** (signal strength, AGC). Only a native Android app can. | **Honest limit.** The web app is the zero-install front door and demo. Phase 2 is an Android app using the Android GNSS raw measurements API, which is what the research apps use. |
| 4 | **Evidence can be faked: someone builds a fake chain from scratch.** A hash chain proves *no edits*, not *where it came from*. | **Planned (Phase 2).** Upload each chain head to a server that adds a trusted timestamp, and sign reports with a per-device key plus device attestation. Until then, the report says "integrity only". |
| 5 | **Backdating.** Hash chains do not prove *when*. | **Planned.** Server timestamp anchoring (RFC 3161 style) when the phone is online. |
| 6 | **Faked data poisons a crowd map.** | **Planned.** Only publish a public alert when several independent devices in one area agree. Add reputation scores and outlier rejection. |
| 7 | **Chicken-and-egg: no users, no coverage.** | Start with one vertical in one hotspot (see Section 8). Sell evidence reports to one insurer or fleet before building a public map. |
| 8 | **Privacy: location is sensitive.** | **Built.** Everything runs on the device. Nothing is uploaded. Log is stored only in the browser. Planned: upload only coarse, consented incident data. |
| 9 | **Misuse: could someone use it to learn where jammers are, or to target?** | Detection only. No jamming capability. Publish an ethics and use policy. Get legal advice before publishing interference locations in any country. |
| 10 | **Simulated data could be passed off as real.** | **Built.** Demo-mode events are tagged `simulated: true` inside the sealed log, and the report states it contains simulated events. |
| 11 | **Fake alarms hurt trust more than missed ones.** | Rules are conservative (stillness required, accuracy-scaled). Next step: measure the false-positive rate in a field test and publish it. |
| 12 | **A determined attacker who also fools the motion sensor.** | Very hard remotely (they need physical access to the phone). Phase 2 adds independent evidence: Wi-Fi/cell positions and other nearby phones. |
| 14 | **A fake position that never moves again looks normal after the alert window.** After one teleport, GPS stays at the wrong place, so the checks go quiet. | **Partly built.** The incident stays in the evidence chain, and the status line says "Last alert was N s ago, review the evidence". Planned: latch the alert until the user confirms it, and compare against Wi-Fi and cell positions. |
| 13 | **Competitors add this feature.** | Be faster on the evidence and insurance workflow, and own the data history. Detection alone is easy to copy; trusted records plus relationships are not. |

---

## 5. Build it from scratch (no experience needed)

You need only a computer, internet, and a Google Chrome browser. All tools are free.

### Step 1: Install VS Code
1. Go to **code.visualstudio.com** and download VS Code for your system.
2. Install it with the default options and open it.

### Step 2: Create your project folder
1. On your computer, make a new folder called `gps-notary` (for example on the Desktop).
2. In VS Code choose **File, then Open Folder**, and pick `gps-notary`.

### Step 3: Add the app
1. In VS Code's left panel (Explorer), click the **New File** icon and name it exactly `index.html`.
2. Open the `index.html` I gave you, copy **everything**, and paste it into your new file.
3. Press **Ctrl+S** (Mac: **Cmd+S**) to save.

### Step 4: Run it on your computer
1. Click the **Extensions** icon on the left (four squares).
2. Search **Live Server** (by Ritwick Dey) and click **Install**.
3. Right-click `index.html` in the Explorer and choose **Open with Live Server**.
4. Your browser opens the app. Click **Demo mode**, then try the attack buttons.

If you see a blank map, you may be offline or the map library is blocked. The checks still work.

### Step 5: Put it online (needed for phone GPS)
Phones only allow GPS in a web page that uses **https**. Your computer's local address is not https, so deploy the folder to a free host. Easiest option:
1. Go to **app.netlify.com/drop** (create a free account if it asks).
2. Drag your whole `gps-notary` folder onto the page.
3. You get a `https://something.netlify.app` link. Open it on your phone.

Alternative: create a free GitHub account, make a repository, upload `index.html`, then in **Settings, Pages** turn on GitHub Pages. (Menus on these sites change over time, so follow their on-screen help if a button looks different.)

### Step 6: Test on your phone (real mode)
1. Open the https link on your phone. Choose **I am standing still or on foot**.
2. Tap **Start live check** and allow **location** (and **motion** if asked; iPhones ask).
3. Put the phone on a table and wait. Status should stay **CONSISTENT**. Walk around and it should stay consistent.
4. Honest note: you cannot spoof real GPS legally or safely, so for real-mode testing you mostly prove *no false alarms*. Use Demo mode to show attacks being caught.

### Step 7 (optional): Run the automated tests
1. Install **Node.js** from nodejs.org.
2. In VS Code open **Terminal, New Terminal** and run: `node tests/test_core.js`
3. You should see 21 PASS lines.

---

## 6. How to use the demo

### The dashboard (version 0.2)

| Panel | What it shows |
|---|---|
| Live track | Map with your path. Jumps are drawn as a dashed red line. |
| Trust index | Animated gauge, 0 to 100. Green is consistent, amber suspicious, red likely spoofed. |
| Drift radar | Where GPS says you are, relative to where you started. The dashed amber ring is the allowed drift zone. When the dot leaves it while the phone is still, the motion check fires. |
| Telemetry | Live graphs of measured speed, GPS accuracy, motion sensor, clock offset and distance from start. |
| Reality checks | Each rule with its live status. The motion check shows a countdown while it arms. |
| Incidents and Sealed evidence | Every alert, and the hash chain that locks them. |

### Easiest: press "Play guided demo" (about 75 seconds)

It runs the whole story by itself with on-screen narration: teleport attack, slow-drift attack, clock attack, then verifies the chain. The last line tells you to press **Tamper test**, which edits one entry and shows the blocks breaking in red. Screen-record this for your pitch.

### Manual: "Free demo" with the attack console

1. Click **Free demo**. Status: Consistent, score 100.
2. Click **Slow drift**. After about 20 seconds of the phone being still, the Motion sensor check turns red while the Impossible jump check stays green. Say: *"Every GPS-only detector would miss this. The phone's own motion sensor catches it."*
3. Click **Teleport 60 km**. Score collapses to Likely spoofed.
4. Click **Shift clock 2 min**. The clock check turns red.
5. Scroll to **Sealed evidence**. Click **Verify chain**: Valid.
6. Click **Tamper test**: Tampered, with the exact block where the chain breaks. Say: *"Change one word and the proof falls apart. That is what an insurer can trust."*
7. Click **Download report** and show that it can be verified with **Verify a saved report**.

Demo mode forgets alerts after 12 seconds so the gauge visibly recovers. Live mode uses 30 seconds.

---

## 7. Your roadmap

**Phase 1 (done here, free):** web prototype with Reality Check and Sealed Evidence, demo mode, tests.

**Phase 2 (about 4-8 weeks):**
1. Android app with raw GNSS measurements (signal strength and AGC). Build with Android Studio (free), or Kotlin with an AI assistant's help.
2. Free backend (Supabase or Firebase free tier) to store chain heads and add trusted timestamps.
3. Signed reports (per-device key) and a public "verify this report" web page.
4. Field test: collect real data, measure the false-alarm rate, and publish the numbers.
5. Multi-device agreement for public alerts.

**Phase 3:** pilots with paying customers (Section 8), then a public interference map as the free, growth-driving side.

---

## 8. Pitch material

**One-liner:** "GPS Notary turns any phone into a witness for GPS interference and seals the proof so insurers and operators can trust it."

**Problem:** GPS is being jammed and spoofed on ships, aircraft and drones. Crews get silent wrong positions. When something goes wrong (a collision, an insurance claim, a sanctions dispute), there is no trusted record of what the position signal was doing.

**Solution:** Phones check GPS against their own motion sensors and clock, then hash-chain every incident into a tamper-evident report that anyone can verify.

**Why now:** interference is rising worldwide (IMO/ICAO/ITU statement), insurers are already piloting spoofing tools (the DNK pilot with PntGuard), and phones now expose the raw satellite data needed for deeper detection.

**First customer:** maritime war-risk insurers and operators in interference hotspots (for example Baltic, Gulf, Black Sea routes), then drone operators and logistics fleets. Pick ONE and say it out loud in the pitch.

**Business model:** free app and public verifier (growth); paid evidence reports and API for insurers, operators and fleets; later, enterprise dashboards.

**Competition (say this before they ask):**

| Player | What they do | How you differ |
|---|---|---|
| CrowdShield, GNSSAlarm, TORGI (research apps) | Detect interference on phones | Research prototypes, not a product with an evidence and verification workflow |
| PntGuard | Dedicated bridge hardware for ships, authenticated position via satellite | Costs hardware; you are phone-based, zero-install, and about evidence rather than replacing the position source |
| Flight and ship trackers with interference layers | Coarse maps inferred from aircraft or vessel broadcasts | Not ground-level, not evidence-grade |

**Hard questions to prepare for:**
- *"Isn't this already built?"* Detection research exists; we are building the trusted-evidence and zero-install layer, and here is the demo.
- *"Can't someone just fake your logs?"* A hash chain stops editing, not fabrication. That is why Phase 2 adds server timestamps, device signing and multi-device agreement. (Say this yourself; honesty wins trust.)
- *"Why would a phone detect what dedicated hardware misses?"* It will not catch everything, and we say so. Phones win on scale and zero cost, and the evidence layer works with any detector.
- *"What is the false-alarm rate?"* Rules are conservative and tested on synthetic cases. The Phase 2 field test produces the real number. Do not quote one until you have measured it.

**What to bring:** the live demo link, a 2-minute screen recording, a one-page competitor comparison (you now have the starting table), and **one conversation or letter of interest from a real insurer or operator**. One real user conversation beats ten slides.

**Do not claim:** "first ever", "100% accurate", "military-grade", or a market size you did not source. Always cite where numbers come from.

---

## 9. Re-check the competition before you pitch

Search these terms and read what appears (new products appear fast):
- "crowdsourced GNSS interference app Android"
- "GNSS spoofing evidence insurance"
- "tamper-evident GPS log"
- "CrowdShield Jammertest"
- "GNSSAlarm Android"

If a competitor now offers hash-chained, verifiable incident reports, adjust your wedge (for example, focus on zero-install web access or a specific vertical).

---

## 10. Known limits of this prototype

- Web browsers cannot read raw satellite signals, so this version cannot detect jamming itself, only inconsistencies between GPS, motion and time.
- Motion check needs a device with an accelerometer and a browser that exposes it; desktops will show that check as "not available".
- The timezone check can false-flag real travellers (that is why it never raises an evidence entry alone).
- The evidence log proves *no edits since sealing*, not *who created it* or *when*.
- Only tested on synthetic scenarios and unit tests so far. Real-world accuracy is unmeasured.
- Not a safety-of-life navigation tool. Never use it as your only navigation source.

---

## Sources

- CrowdShield evaluation at Jammertest 2025 (EU Joint Research Centre): https://publications.jrc.ec.europa.eu/repository/handle/JRC144749
- GNSSAlarm and TORGI (ION Navigation): https://navi.ion.org/custom-print/141144
- Participatory phone-based jammer localisation (arXiv): https://arxiv.org/abs/2305.02038
- Crowd-sourced jammer detection and 3GPP (GPS.gov presentation): https://www.gps.gov/cgsic/meetings/2018/maier.pdf
- PntGuard launch: https://www.marinetechnologynews.com/news/maritime-firms-launch-pntguard-654835
- Maritime GNSS interference overview, March 2026: https://www.shipuniverse.com/?p=14403
- ESA NAVISP SJAWS project: https://navisp.esa.int/project/details/411/show
