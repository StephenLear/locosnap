from PIL import Image, ImageDraw, ImageFont
import math, os

W, H = 1024, 500
bg = (10, 15, 26)        # #0a0f1a
teal = (0, 212, 170)     # #00D4AA
teal_dim = (0, 100, 80)
teal_faint = (0, 212, 170, 18)
blue = (0, 102, 255)
white = (255, 255, 255)
grey = (80, 100, 120)
grey_light = (140, 160, 180)

img = Image.new("RGB", (W, H), bg)
d = ImageDraw.Draw(img, "RGBA")

# ── Grid lines (blueprint feel) ─────────────────────────────
for x in range(0, W, 40):
    d.line([(x, 0), (x, H)], fill=(0, 212, 170, 12), width=1)
for y in range(0, H, 40):
    d.line([(0, y), (W, y)], fill=(0, 212, 170, 12), width=1)

# ── Glow orb centre-left ────────────────────────────────────
for r in range(180, 0, -1):
    alpha = int(40 * (1 - r / 180))
    d.ellipse([(260 - r, 250 - r), (260 + r, 250 + r)],
              fill=(0, 212, 170, alpha))

# ── Abstract locomotive silhouette (geometric) ──────────────
# Body
d.rectangle([(80, 210), (440, 310)], fill=(18, 28, 46))
d.rectangle([(80, 210), (440, 310)], outline=(0, 212, 170, 80), width=1)

# Cab
d.polygon([(340, 210), (440, 210), (440, 170), (370, 170)],
          fill=(14, 22, 38))
d.polygon([(340, 210), (440, 210), (440, 170), (370, 170)],
          outline=(0, 212, 170, 100), width=1)

# Nose
d.polygon([(80, 210), (80, 310), (50, 300), (50, 220)],
          fill=(14, 22, 38))
d.polygon([(80, 210), (80, 310), (50, 300), (50, 220)],
          outline=(0, 212, 170, 80), width=1)

# Wheels
for cx in [120, 190, 310, 380]:
    d.ellipse([(cx - 28, 295), (cx + 28, 351)], fill=(12, 20, 34))
    d.ellipse([(cx - 28, 295), (cx + 28, 351)], outline=(0, 212, 170, 120), width=2)
    d.ellipse([(cx - 14, 309), (cx + 14, 337)], fill=(0, 212, 170, 40))
    d.ellipse([(cx - 5, 318), (cx + 5, 328)], fill=teal)

# Connecting rod
d.line([(92, 323), (408, 323)], fill=(0, 212, 170, 60), width=2)

# Headlight
d.ellipse([(38, 245), (56, 265)], fill=(0, 212, 170, 160))
d.ellipse([(42, 249), (52, 261)], fill=teal)

# Light beam
for i in range(8):
    alpha = 30 - i * 3
    d.polygon([(38, 250), (38, 260), (0, 280 + i * 4), (0, 230 - i * 4)],
              fill=(0, 212, 170, max(0, alpha)))

# Windows on cab
d.rectangle([(375, 178), (430, 205)], fill=(0, 212, 170, 30))
d.rectangle([(375, 178), (430, 205)], outline=(0, 212, 170, 120), width=1)

# Tech detail lines on body
for y_off in [230, 250, 270, 290]:
    d.line([(100, y_off), (330, y_off)], fill=(0, 212, 170, 25), width=1)

# ── Scan reticle overlay on loco ───────────────────────────
cx, cy, rs = 245, 260, 70
# Corners only (scanner feel)
corner_len = 18
corners = [
    (cx - rs, cy - rs), (cx + rs, cy - rs),
    (cx + rs, cy + rs), (cx - rs, cy + rs)
]
offsets = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
for (bx, by), (ox, oy) in zip(corners, offsets):
    d.line([(bx, by), (bx + ox * corner_len, by)], fill=teal, width=2)
    d.line([(bx, by), (bx, by + oy * corner_len)], fill=teal, width=2)

# Centre crosshair
d.line([(cx - 8, cy), (cx + 8, cy)], fill=teal, width=1)
d.line([(cx, cy - 8), (cx, cy + 8)], fill=teal, width=1)
d.ellipse([(cx - 3, cy - 3), (cx + 3, cy + 3)], fill=teal)

# ── Result card (right side) ────────────────────────────────
card_x, card_y = 510, 100
card_w, card_h = 460, 300

# Card shadow
d.rectangle([(card_x + 4, card_y + 4), (card_x + card_w + 4, card_y + card_h + 4)],
            fill=(0, 0, 0, 80))
# Card bg
d.rectangle([(card_x, card_y), (card_x + card_w, card_y + card_h)],
            fill=(16, 24, 40))
d.rectangle([(card_x, card_y), (card_x + card_w, card_y + card_h)],
            outline=(0, 212, 170, 60), width=1)

# Card top accent bar
d.rectangle([(card_x, card_y), (card_x + card_w, card_y + 3)],
            fill=teal)

# Rarity badge
badge_x = card_x + 20
d.rectangle([(badge_x, card_y + 16), (badge_x + 90, card_y + 34)],
            fill=(0, 212, 170, 30))
d.rectangle([(badge_x, card_y + 16), (badge_x + 90, card_y + 34)],
            outline=(0, 212, 170, 100), width=1)

# Match % circle
match_cx = card_x + card_w - 50
match_cy = card_y + 50
d.ellipse([(match_cx - 30, match_cy - 30), (match_cx + 30, match_cy + 30)],
          fill=(0, 212, 170, 20))
d.ellipse([(match_cx - 30, match_cy - 30), (match_cx + 30, match_cy + 30)],
          outline=(0, 212, 170, 120), width=2)

# Data rows
rows = [
    ("CLASS", "66"),
    ("OPERATOR", "GB Railfreight"),
    ("BUILT", "1998 · Canada"),
    ("IN SERVICE", "249 units"),
]
for i, (label, value) in enumerate(rows):
    ry = card_y + 60 + i * 52
    d.line([(card_x + 20, ry + 44), (card_x + card_w - 20, ry + 44)],
           fill=(0, 212, 170, 20), width=1)

# ── Specs mini-bar at bottom of card ────────────────────────
spec_y = card_y + card_h - 55
d.rectangle([(card_x + 10, spec_y), (card_x + card_w - 10, card_y + card_h - 10)],
            fill=(0, 212, 170, 12))

# ── Corner tech marks on full image ─────────────────────────
margin = 20
corner_s = 24
for (ex, ey), (dx, dy) in [
    ((margin, margin), (1, 1)),
    ((W - margin, margin), (-1, 1)),
    ((W - margin, H - margin), (-1, -1)),
    ((margin, H - margin), (1, -1)),
]:
    d.line([(ex, ey), (ex + dx * corner_s, ey)], fill=(0, 212, 170, 80), width=1)
    d.line([(ex, ey), (ex, ey + dy * corner_s)], fill=(0, 212, 170, 80), width=1)

# ── Now add text using fonts ─────────────────────────────────
# Try system fonts
font_paths = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/SFNSDisplay.ttf",
    "/System/Library/Fonts/SFCompact.ttf",
]

def load_font(size, bold=False):
    for fp in font_paths:
        try:
            return ImageFont.truetype(fp, size)
        except:
            pass
    return ImageFont.load_default()

font_xs    = load_font(11)
font_sm    = load_font(14)
font_md    = load_font(18)
font_lg    = load_font(28)
font_xl    = load_font(42)
font_badge = load_font(10)

# App name — large, left
d.text((80, 60), "LocoSnap", font=font_xl, fill=white)
d.text((80, 108), "AI Train Identification", font=font_sm, fill=(0, 212, 170))

# Tagline bottom-left
d.text((80, H - 50), "Snap. Identify. Collect.", font=font_sm,
       fill=(140, 160, 180))
d.text((80, H - 30), "Available on iOS & Android", font=font_xs,
       fill=(60, 80, 100))

# Badge text
d.text((badge_x + 8, card_y + 19), "UNCOMMON", font=font_badge, fill=teal)

# Match %
d.text((match_cx - 14, match_cy - 10), "95%", font=font_sm, fill=teal)
d.text((match_cx - 10, match_cy + 8), "match", font=font_xs, fill=grey_light)

# Card title
d.text((card_x + 20, card_y + 38), "Class 66", font=font_lg, fill=white)

# Data rows text
label_font = load_font(10)
value_font = load_font(15)
for i, (label, value) in enumerate(rows):
    ry = card_y + 65 + i * 52
    d.text((card_x + 20, ry), label, font=label_font, fill=(0, 212, 170, 180))
    d.text((card_x + 20, ry + 14), value, font=value_font, fill=white)

# Spec bar text
d.text((card_x + 20, spec_y + 8), "65 mph  ·  3,300 HP  ·  Diesel", font=font_xs, fill=grey_light)
d.text((card_x + card_w - 90, spec_y + 8), "GBRf · UK", font=font_xs, fill=grey_light)

out = "/Users/StephenLear/Projects/locosnap/frontend/assets/feature-graphic.png"
img.save(out, "PNG")
print(f"Saved: {out} — {W}x{H}")
