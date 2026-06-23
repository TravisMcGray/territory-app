# HexCapture: Launch Goals
### "Ship it before you perfect it. Perfect it before anyone leaves."

---

## Vision
A fitness territory game for Android where every walk and run becomes a battle for real-world hexagons.
The app must feel alive, exciting, and shareable. It must make people want to open it daily.

---

## ⚠️ Competitor Alert
**INTVL is a direct competitor.** Same core mechanic: GPS territory capture on a real map.
4.7/5 App Store, 750,000+ downloads. Their top weaknesses are your biggest opportunities:
- GPS runs silently fail or get rejected with no explanation → **HexCapture must communicate failures immediately**
- Territory colors are confusing → **HexCapture's T1-T4 neon tier system is a visual advantage**
- No accessible support → **HexCapture must have a real support channel from day one**
- Strava sync is one-way only → **HexCapture can win users frustrated with INTVL**

---

## Bare Minimum Before Play Store Submission

### 1. Performance
- Cold start to usable app in under 3 seconds
- No "frozen" spinner screens. Show a loading animation that feels intentional, not broken
- Map tiles and hex data load progressively (show something immediately, fill in the rest)
- Smooth 60fps scrolling and transitions throughout
- *(From research: GPS battery drain is a top uninstall trigger, so optimize background location usage)*

### 2. GPS & Data Integrity: Non-Negotiable
- If a run fails to save, the user is told BEFORE they close the app, never a silent failure
- If GPS loses signal mid-activity, show a visible indicator, never let them finish a run only to find out it didn't count
- Rejected or failed runs must explain WHY in plain language (INTVL's black-box rejection destroys trust)
- All captured territory must visually confirm on the map before the activity closes
- *(From research: INTVL loses users specifically because runs disappear silently; this is your #1 technical differentiator)*

### 3. Onboarding: Create an Early Win
- Guided walkthrough on first launch: what hexagons are, how to capture them, what tiers mean
- Do NOT just explain. Let them interact. Show a simulated hex lighting up. Let them tap it.
- The first walkthrough must deliver an emotional win before the user ever goes outside
- Skippable after the first meaningful step for users who want to dive straight in
- *(From research: Runna's detailed onboarding quiz is the most praised feature across all 5 apps.
  Pokemon Go's zero-guidance onboarding is one of its most cited failure points.)*

### 4. Navigation & UI/UX
- Bottom tab bar: Map · Feed · Log Activity · Leaderboard · Profile
- Clean, minimal, nothing cluttered
- Every screen has a clear purpose and a clear next action
- No feature requires more than 3 taps to reach from anywhere in the app
- *(From research: MapMyRun's "lots of menus and submenus" is a repeated onboarding complaint)*

### 5. Cinematic Loading / Globe Experience
- App open → universe pulls toward earth → earth rotates into your location
- Live hex shields and your location visible on the rotating globe
- Tapping a nav item pulls the globe into your location and transitions to that screen
- Must be skippable after first use, to respect repeat users' time
- Fallback for lower-end Android devices: simpler animation, same brand feel

### 6. Activity Experience: Must Feel Alive
- Route line draws in a random bold color (Paper.io style) as you move
- Each hex captured pulses and explodes into color in real time as you step through it
- If your route forms a closed loop, small hexagons stream toward the center and lock in
- Running counter overlaid on screen showing hex count captured this session (× counter, animated)
- Haptic feedback: subtle vibration every time a hex is captured
- Clear GPS signal indicator always visible during an activity
- *(From research: no app in the category currently delivers a "alive" activity experience; this is your gap to own)*

### 7. Activity Recap: The Moment That Makes People Share
- On "Finish," a cinematic recap plays:
  - Starts at the beginning of the route
  - Replays the path: every hex captured along the way explodes into color
  - Counter increments with each hex pop
  - Longer routes get accelerated playback so it never drags
- Final screen: clean stat card (distance, time, hexes captured, tier progress, new territory %)
- Confetti animation: celebrate every activity regardless of how short
- Shareable: one tap generates a clean image card with stats, via the native Android share sheet
- *(From research: Pattern 5 across all 5 apps: the post-run recap is the most underinvested,
  highest-leverage moment in the entire fitness app category. No app does this well. Own it.)*

### 8. Profile
- Visually compelling: feels like a trophy room, not a settings page
- Shows: territory count, tier badge, activity history, total distance, total hexes, join date
- Profile photo upload
- Shareable profile link: send it to a friend, they see your stats and map
- Profile photo displayed on your hex shields on the map; opt-in, T3+ tiles only to avoid visual clutter
- *(Gating profile photos to T3+ makes it a reward, not noise)*

### 9. Social & Discovery
- Global username search in Leaderboard
- Follow system: follow users, see their activity in your feed
- Kudos: one-tap reaction on any activity
- Live activity ticker at the bottom of screen: "TrailKing92 just completed a 2.4mi walk · 3 min ago"
  (friends/followed users only; irrelevant notifications are a top uninstall trigger)
- Quick share from activity recap via native Android share sheet
- *(From research: asynchronous competitive mechanics (territory steals, leaderboard rank changes)
  outperform active social mechanics that require mutual participation. Design social around territory events.)*

### 10. Map
- Your captured hexes clearly visible with T1-T4 neon tier colors
- Others' hexes clearly distinguished visually: no color confusion between yours, theirs, uncaptured
- Your location dot always centered and accurate
- Shield/profile photo on T3+ hexes (opt-in)
- Smooth pan, zoom, rotation, no lag
- *(From research: INTVL's territory color confusion is a cited weakness; your tier color system
  is a direct visual advantage if it stays clear and consistent)*

### 11. Notifications: Territorial Events Only
- "Someone just captured one of your hexes" with username + location
- "Your rank changed" with a delta (moved up 3 spots)
- "[Friend] just finished a run near you"
- Weekly summary: tiles owned, rank change, miles logged
- ALL notification types individually toggleable in settings; default: on for territory events, off for social
- *(From research: notification spam is a universal top-5 complaint across all 5 apps.
  Strava has a community thread titled "please turn off these silly new notifications."
  Notifications should be actionable, not informational.)*

### 12. Support Channel
- A real way to contact support from inside the app, not a bot, not an email that goes nowhere
- Clear in-app FAQ covering: "my run didn't save," "my hex didn't register," "GPS was wrong"
- *(From research: INTVL and MapMyRun both rated poorly specifically for having no accessible support.
  This is a trust issue, not a nice-to-have.)*

---

## Monetization Principles: Protect Trust
- The free tier must be genuinely usable, not a crippled demo
- Never move a feature that launched free behind a paywall retroactively
- If a paid tier is introduced, grandfather existing users at their current access level
- *(From research: Strava's retroactive paywall on Year in Sport caused measurable community trust collapse.
  Pokemon Go's monetization is the #1 cited reason for player attrition. This pattern kills apps.)*

---

## Privacy Defaults
- New users default to: activity routes private, profile private
- Users opt IN to public visibility, not opt OUT
- GPS data must not be transmitted when the app is closed
- *(From research: Strava's Flyby feature defaulted to public and exposed user location patterns to strangers.
  Required a community backlash to fix. Default to private, always.)*

---

## Post-Launch: Do Not Build Yet
- iOS App Store submission
- Streak system (daily activity rewards)
- Seasonal events / limited-time hex challenges
- Clan/team territory mode
- In-app messaging between users
- Apple Watch / Wear OS companion
- Web dashboard for reviewing past routes in detail
- Training plan feature (Runna-style coaching)
- In-app purchases / monetization tier

---

## Explicitly Out of Scope for v1
- Any feature not listed in the bare minimum section above
- Web-based GPS tracking (browser limitation; native app only)
- iOS launch
- Any partnership or external integration beyond native Android

---

## Technical Non-Negotiables
- Background GPS must work when screen is locked
- Battery usage must be reasonable during activity tracking; benchmark against INTVL and Strava
- Crash reporting in place before launch (Firebase Crashlytics or equivalent)
- GPS failure modes must be handled gracefully and communicated to the user in real time
- Data security audit before public launch (MongoDB access, API rate limiting, location data privacy)
- GDPR / privacy policy in place; GPS data is legally sensitive in multiple jurisdictions
- All captured data must persist locally as a backup before syncing to server
  (so a network failure mid-run does not equal data loss)

---

## The Rule
> If a feature is not on the bare minimum list, it does not get built until everything above it ships.
> Cool ideas go in Post-Launch. They are not forgotten; they are protected from scope creep.

---

## Nike Run Club: Additional Research

### What NRC Does INSANELY WELL
- **Completely free, zero paywalls** is the single biggest differentiator vs every competitor. Users cite this constantly. Structured coaching, training plans, guided runs, all free. Sets the bar for what "free" should mean.
- **Audio guided runs with named coaches**: ~300 guided runs featuring Coach Bennett, Eliud Kipchoge, Shalane Flanagan. Users develop parasocial bonds with specific coaches by name. This is the #1 cited retention driver. People stay because of Coach Bennett, not because of the app.
- **Onboarding scored 8.5/10, best in category**: "First Run" guided experience delivers immediate coaching value before the user has taken a single real step outside. Frictionless: download → 3 questions → running. This is the industry benchmark.
- **Identity building**: color-coded progression system ("The Sponsored Athlete" concept) makes users feel like they're on a professional training journey, not just logging miles.
- **Shoe mileage tracking**: tracks when shoes need replacing. Simple, useful, unique. Creates a habit that ties users to the app even on rest days.

### What Could Be Optimized
- **The Graduation Cliff, NRC's core vulnerability**: the app is so good at making beginners into runners that it creates the very users who will eventually leave it. Advanced runners need data depth NRC doesn't have. When users' need for data exceeds their need for encouragement, they graduate to Garmin or Strava and never come back. NRC has no answer for this.
- **Audio coaching gets repetitive**: same coaches, same phrases. Users report "excessive talking" and "not enough silent time." No way to reduce coaching frequency by session type.
- **Training plans are static**: plans don't adapt dynamically to your performance. If you have a great week or a terrible week, the plan stays the same. Runna solves this; NRC doesn't.
- **GPS overcounts distance**: frequently logs more distance than actually covered (one reported case: 3 miles shown as 3.5 miles). Inconsistent enough to undermine trust in the data.
- **Wearable sync issues**: works well with Apple Watch but struggles with Garmin, Suunto, Coros. Non-Apple users hit sync failures, lost runs, and constant sign-outs. This is a significant Android/Google market problem.
- **Social layer is weak**: no segments, no spatial competition, no territory mechanics. Relies on internal motivation rather than competitive FOMO. Vulnerable to friend groups standardizing on Strava instead.
- **Data loss on sync**: runs that don't upload, workouts lost to cache corruption, GPS straight-lining gaps where signal dropped. Silent failures with no user notification.

### What Should Be Removed
- **The implicit "graduate and leave" design**: NRC currently has no depth tier for advanced runners. The app trains users to outgrow it with nothing to keep them. A retention layer for experienced runners is missing by design. Either build it or explicitly design a handoff. Don't just let users drift.
- **Excessive mid-run audio on easy efforts**: coaching every few minutes during long slow runs is reported as grating. Context-aware coaching frequency (quiet on easy days, active on interval days) would significantly improve the experience.

### What This Means for HexCapture
- **HexCapture has no Graduation Cliff**: territory is infinite. There is always more land to claim, higher tiers to earn, more rivals to beat. This is a structural retention advantage NRC can never have.
- **The First Run concept is the onboarding standard**: HexCapture's interactive onboarding must deliver an emotional win before the user's first real activity, same as NRC's guided first run. This is the benchmark.
- **Free must mean free**: NRC proved that a completely free, full-featured app builds the largest user base fastest. If HexCapture adds paid tiers, the core game must remain 100% free.
- **Named personality in the app**: NRC's Coach Bennett is a person users feel connected to. HexCapture could build an equivalent through the app's voice and personality, even without a real person, the app itself should feel like it has a character.

---

## What the Research Taught Us: Summary
1. **Paywalls kill trust faster than any other single decision.** Keep the free tier genuinely useful.
2. **Onboarding is where every competitor fails.** An interactive first win before the first real run is your edge.
3. **Asynchronous competition drives retention.** Territory steals, rank changes: passive triggers that create urgency.
4. **The post-run recap is completely unowned in this category.** The cinematic recap IS the product.
5. **Silent GPS failures are unforgivable.** Tell users immediately, every time.
6. **Notification spam causes uninstalls.** Every notification must be tied to a territory event.
7. **INTVL is your direct competitor.** Their weaknesses are your roadmap.

---

*Last updated: 2026-04-25*
*Built by Travis McGray with Claude*
*Research sourced from: Strava Community Hub, RepReturn, BarBend, Gadgets & Wearables, Dexerto,*
*Screen Rant, Game Rant, UXPin, Snaptroid, INSCMagazine, mostly.media, UX Collective,*
*Digital Trends, Garage Gym Reviews, Nikmat Substack, SportSteps, JustUseApp*
