---
name: iconize
description: Extract individual icons from sprite sheets into named, square PNG files organized by category. Point it at a folder containing sprite sheet PNGs and provide icon names.
argument-hint: <folder> [names] [output] [cols]
---
# Iconize — Sprite Sheet Icon Extractor

Extract individual icons from sprite sheet PNGs into cleanly cropped, square, transparent PNG files organized by category subdirectories.

## Prerequisites

- **ImageMagick** (`magick` CLI) must be installed
- **Python 3** with **Pillow** (`pip3 install Pillow`)
- Input images should be transparent PNGs (background already removed)

## Extraction Process

### Step 1 — Scan the folder

1. Read all `.png` files in the provided `folder` path
2. For each image, display it visually and get dimensions via `magick identify`
3. Ask the user to confirm the icon names and grid layout if names weren't provided

### Step 2 — Extract using connected-component analysis

For each sprite sheet, run this extraction pipeline:

```bash
magick <input.png> -alpha extract -threshold 5% \
  -morphology Close Disk:15 \
  -define connected-components:verbose=true \
  -connected-components 8 null:
```

This outputs bounding boxes for each distinct icon region. Parse the output to get `id: WxH+X+Y centroid area` for each component.

**Filter out:**
- Component ID 0 (background)
- Components with area < 5000 (noise/artifacts)

### Step 3 — Merge split components

Some icons (e.g. stethoscope with separate earpieces, dotted elements) may split into multiple components. Merge bounding boxes that overlap or are within `merge_distance=50px` of each other:

```python
# Expand each box by merge_distance, check for overlap
# If two boxes overlap when expanded, merge into one unified bounding box
# Repeat until no more merges occur
```

If a merge causes two clearly separate icons to combine (resulting box much wider than expected), reduce `merge_distance` to 30px and retry.

### Step 4 — Sort into grid order

1. Sort all bounding boxes by Y coordinate (top to bottom)
2. Group into rows using `row_tolerance=200px` (boxes within 200px vertical distance = same row)
3. Sort each row by X coordinate (left to right)
4. Flatten into a single ordered list

### Step 5 — Validate count

Compare found sprites vs expected names count:
- **Match:** Proceed to extraction
- **More found than expected:** Show bounding boxes, ask user which are extras/artifacts
- **Fewer found than expected:** Try smaller `merge_distance` or warn about merged icons

### Step 6 — Crop and square each icon

For each bounding box:

```python
from PIL import Image

# Crop with padding (15px default)
x1 = max(0, bbox_x1 - padding)
y1 = max(0, bbox_y1 - padding)
x2 = min(img.width, bbox_x2 + padding)
y2 = min(img.height, bbox_y2 + padding)
cropped = img.crop((x1, y1, x2, y2))

# Center in a square canvas (transparent background)
size = max(cropped.width, cropped.height)
square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
ox = (size - cropped.width) // 2
oy = (size - cropped.height) // 2
square.paste(cropped, (ox, oy))

square.save(output_path)
```

### Step 7 — Visual verification

After extraction, read and display 3-4 sample icons from different grid positions (first, middle, last, and one random) to verify:
- No neighbor bleed (parts of adjacent icons visible)
- Icon is properly centered in the square
- No clipping of the icon edges

If any icon has neighbor bleed:
1. Identify which icons are too close
2. Re-extract those specific icons with tighter bounding boxes (reduce padding or manually adjust coordinates)
3. Re-verify

### Step 8 — Output summary

Print a table of all extracted icons:

```
| # | Name | Size | Path |
|---|------|------|------|
| 1 | tabs/house | 482x482 | icons/tabs/house.png |
| 2 | tabs/heartbeat | 614x614 | icons/tabs/heartbeat.png |
...
```

## Output Structure

```
<output>/
  <category>/
    <icon-name>.png    # Square, transparent background, centered
  ...
```

If names use slashes (e.g. `tabs/house`), the part before the slash becomes the subdirectory and the part after becomes the filename.

If no names provided, output flat structure: `icons/icon-01.png`, `icons/icon-02.png`, etc.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Icons merging together | Reduce `merge_distance` (try 30, then 20) |
| Icon split into parts | Increase `merge_distance` (try 60, then 80) |
| Neighbor bleed in crop | Reduce `padding` from 15 to 5, or manually specify tighter bbox |
| Too few components found | Lower `-threshold` from 5% to 2%, or check if image has black background (not transparent) |
| Black background instead of transparent | Pre-process: `magick input.png -fuzz 10% -transparent black output.png` |
