# The report cover

Every report, single run or `/gtm on`, opens with a cover page designed for that report by Fable 5.1. Dispatch it as a sub-agent with `model: "fable"` once the report JSON exists, so the cover can quote the real verdict. Run it in parallel with anything else still running; the cover only needs the title, the verdict and the list of runs.

## Brief to send the cover agent

Fill the brackets and send it as written:

> Why: [who reads this report and why]. Page one is a cover you design. It must be beautiful, and it sets the standard for every /gtm report.
>
> You own exactly one file: [<gtm>/cover.html, or <gtm>/<skill-name>.cover.html for a single run]. Write an HTML fragment (no html, head or body tags) that the renderer pastes before the report.
>
> Contract:
> - Root `<section class="cover cover-fable">`, then one `<style>` block with every selector scoped under `.cover-fable`. The renderer sizes `.cover` as an A4 panel on screen (aspect-ratio 210/297, rounded, overflow hidden) and as exactly 210mm × 297mm with zero margin in print. Lay out with percentages, mm or container-relative units so screen and print match. Nothing may overflow or be cut off.
> - Black and white only (#111, #fff, greys). No colour, gradients, images, external URLs or scripts. Set `print-color-adjust: exact` on the root.
> - Fonts: only "Geist" (300 to 700) and "Geist Mono" (400, 500), already loaded. No handwritten, script or serif faces, no scribbles or wobbly outlines.
> - One strong abstract idea in inline SVG is welcome, geometric and minimal, drawn from what the report is about.
> - Text, exactly these facts and nothing invented: title [title]; kicker [e.g. Go-to-market review, or the sub-command name]; verdict [score and headline]; [the runs included, for /gtm on]; date [date]; footer [Prepared with /gtm for <project>].
> - No em or en dashes, no curly quotes, no "AI", sentence case. Labels never wrap: white-space nowrap, size down if needed.
>
> Check your work: render a scratch copy with `node ~/.claude/skills/gtm/scripts/render-report.mjs [spec] <scratch>.html --pdf <scratch>.pdf` and look at page 1 of the PDF with the Read tool. Edit no file but yours.

## Wiring

- Put `"cover": "<cover file name>"` in the report JSON (relative to the JSON).
- If the cover agent fails or returns nothing usable, leave `cover` out: the renderer draws a plain black cover from the title and summary, and the report still ships.
- Read page 1 of the final PDF yourself before handing over. If the cover is cut off or shrunk, send the agent one fix with what is wrong; after that use the plain cover.
