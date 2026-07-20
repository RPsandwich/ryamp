Drop any PNG/JPG/GIF/WebP image in this folder and it automatically shows up
as a banner preset in the app -- no code changes needed. See
`src/skins/banners.ts` for how the auto-discovery works.

Filename becomes the display label: dashes/underscores turn into spaces and
each word gets capitalized. e.g. `sailor-moon.png` -> "Sailor Moon".

Recommended source aspect ratio: wide, roughly 16:5 to 3:1. The banner
displays at a fixed 16:5 aspect ratio using object-fit: cover with
object-position: center top, so:
  - Wider/shorter source images will show in full.
  - Taller/narrower ones get cropped from the sides and bottom (top stays
    anchored, to keep a character's face in frame).
