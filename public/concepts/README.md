# Solo Stereo — homepage motion studies

Three local-only design alternatives, added after syncing master to `15afa7acc9758a4e50d21aec638165dce5366f6b` on September 5, 2026. The existing homepage is unchanged.

Open `/concepts/index.html` on the running Solo Stereo app. The page also opens directly from disk for motion/design comparison; archive links require the app server.

- **Liquid Core** (`#core`): black aluminum receiver with continuously morphing 3D green metaballs inside the smoked-glass display. The power button, volume dial, and gallery pulse button trigger a burst of energy.
- **Living Tape** (`#tape`, revised): a horizontally level translucent green cassette seated inside a black vintage stereo. The paper label shows only the current sample song title and artist, updates every nine seconds, and scrolls names that exceed the label width. The reels contain moving green fluid. The deck transport buttons and controls below it navigate tracks or open the archive. On narrow screens the artwork crops toward the cassette bay.
- **Signal Bloom** (`#bloom`): the current graffiti mural with a flowing organic ring in the stereo screen and a moving tuner signal.

The receiver and cassette are original generated artwork. `assets/mural.jpg` is the existing project artwork. No original artwork was replaced.

The readouts cycle through five explicitly labeled sample tracks every nine seconds. This is ambient animation, not live playback or audio-reactive analysis. The gallery never contacts Spotify or changes listening history. The archive links lead to the existing `/overview` page.

Motion has a visible pause/resume control, starts paused when reduced motion is preferred, and rendering stops while the document is hidden. Only the visible concept renders, capped at 30 frames per second and 800 canvas pixels across. WebGL failure falls back to moving CSS gradients. No dependencies, build step, external fonts, or remote assets are needed for the concepts themselves.

## Files

- `index.html`: all three homepage compositions and the comparison toolbar.
- `concepts.css`: responsive layouts, hardware overlays, and fallback motion.
- `concepts.js`: WebGL fluid effects, gallery switching, recent-track rotation, pause and energy controls.
- `assets/`: two generated hardware images and the existing mural.

These are review concepts, not a replacement homepage. Choose a direction before integrating it into `components/cover/deck.tsx`.

## Living Tape — stereo-only revision

Open `/concepts/tape-options.html` to compare three continuous material animations. The comparison toolbar is outside the homepage. `/concepts/tape.html?motion=mercury` (or `ink`, `aurora`) contains only the branded stereo, its tape label, and invisible controls aligned to the painted transport buttons. The only link into the archive is the stereo's physical play button. The old gallery's Living Tape selection now opens this clean view.

`solo stereo` is engraved into the new `assets/living-tape-branded.png` artwork. No floating title, subtitle, footer, navigation, or separate entry button appears on the title page. Track + artist text is smaller, scales down further when needed, and never scrolls or truncates. Sample tracks still advance every nine seconds. The square stop button pauses/resumes motion; previous/next controls change the sample track.

The former separate circular shader masks and rotating decorative disks are replaced by one shared flowing field across the cassette cavity, clipped around the paper label and opaque reel hubs. Variations:

- **Liquid Mercury:** reflective viscous folds and moving caustics.
- **Green Ink:** broad diffusion plumes without hard contours.
- **Aurora Gel:** silky, continuous ribbons carried by the liquid field.

`tape.js` and `tape.css` are independent of the older gallery. They honor reduced motion, suspend rendering in hidden tabs, cap GPU resolution and rendering rate, and include a CSS fallback. These are ambient effects, not a physical fluid solver or live audio visualizer. The live application homepage and Spotify data remain unchanged.

### Stereo meter cleanup

Liquid Mercury remains the selected/default direction. The painted meter graphics are covered by a precisely positioned opaque readout within the existing metal bezel. `stereo-meter.css` supplies a single consistent decibel scale and two labeled, 32-segment L/R meters with held peak markers. Both channels use correlated ambient envelopes, quick attack and slower release rather than random frame-by-frame flicker. They share the cassette's animation clock, hidden-tab suspension, reduced-motion preference, and stop/resume button. No microphone, Spotify playback, or actual audio levels are read.
