# Lichtung identity

## Meaning

This tree owns the Lichtung visual identity: the editable masters under `source/lichtung/` and the exported asset set
under `bundle/lichtung/assets/` that the website and the README consume. It records which roles exist, which
appearances each carries, and where the lettering comes from. It is not a portable Brand Bundle manifest yet; the
identity has not had to cross a repository boundary, so no manifest or validator run is claimed.

## Roles and appearances

| Role | Appearance | Source | Export |
| --- | --- | --- | --- |
| `mark.primary` | `universal` (carries its own night square; checked on near-white and near-black) | `source/lichtung/mark.svg` | `bundle/lichtung/assets/mark/universal.{svg,png}` |
| `wordmark` | `on-dark` | `source/lichtung/wordmark-on-dark.svg` | `bundle/lichtung/assets/wordmark/on-dark.{svg,png}` |
| `wordmark` | `on-light` | `source/lichtung/wordmark-on-light.svg` | `bundle/lichtung/assets/wordmark/on-light.{svg,png}` |
| `icon.favicon` | projection of the mark | generated | `website/public/favicon.svg` plus the raster and touch icons the site build derives |

The mark is a small stacked house in a night square with one window lit. The wordmark sets the name in Caveat
SemiBold outlines (SIL Open Font License 1.1; licence text in `source/lichtung/caveat-OFL.txt`) with the dot on the
`i` replaced by the same lit window. No identity motion exists.

## Export

From `website/`:

```bash
node scripts/export-brand.mjs
```

The script rewrites the bundle and copies the favicon and wordmark into `website/public/`. Both are committed so a
build does not depend on the export step.

Tala drew the mark and composed the wordmark on 2026-11-06. Wolf has not approved the identity; treat it as the
working identity until he does.
