<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Swapping the cover mural (`public/cover-wall.jpg`)

The landing page ("/") is not a static image: `components/cover/deck.tsx`
projects a live LCD readout and three invisible transport hit-areas onto the
mural, positioned in % of the image's intrinsic size. Any new artwork needs
those coordinates remeasured, then verified visually. The loop:

1. Convert the art to JPEG and drop it in as `public/cover-wall.jpg`
   (`sips -s format jpeg -s formatOptions 72 in.png --out public/cover-wall.jpg`).
2. Update `IMG_W`/`IMG_H` in `deck.tsx` to the new image's pixel size.
3. Measure the painted LCD text block and the << / play / >> buttons in image
   pixels (crop regions with `sips -c H W --cropOffset Y X` and eyeball them),
   convert to % of IMG_W/IMG_H, and update `.cv-lcd`, `.cv-prev`, `.cv-play`,
   `.cv-next`. Keep the `.cv-lcd` mask over the painted text only — inside the
   screen's black area so its solid background blends — and leave decorative
   screen art (e.g. the spectrum analyzer) unmasked.
4. Verify against the running app:
   - `npx playwright install chromium` (one-time)
   - `SOLOSTEREO_DB_PATH=data/demo.db npm run dev`
   - `SOLOSTEREO_URL=http://localhost:3000 npx tsx scripts/cover-shot.ts out.png`
     screenshots "/" at the mural's aspect ratio.
   Crop the shot around the LCD and buttons and check: no ghost of the painted
   text outside the mask, no mask edge overhanging the screen bezel, hit-areas
   on the painted buttons. Iterate step 3 until clean.
