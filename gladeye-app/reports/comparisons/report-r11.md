# Visual comparison — r11

| state | meanAbsDiff | %px>12 | %px>60 | ref luma/σ | cand luma/σ | cand colors | flags |
|---|---|---|---|---|---|---|---|
| work__25pct | 114.91 | 52.16 | 50.91 | 144.92/110.42 | 253.57/16.89 | 60 | LOW-COLOR-COUNT(fallback?) |
| work__50pct | 92.63 | 38.32 | 37.49 | 165.39/120.49 | 250.48/29.22 | 30 | LOW-COLOR-COUNT(fallback?) |
| work__0_top | 45.51 | 32.88 | 29.57 | 178.31/88.74 | 217.92/79.16 | 631 | compared |
| work__75pct | 12.99 | 8.16 | 6.83 | 247.98/36.05 | 247.7/36.67 | 30 | LOW-COLOR-COUNT(fallback?) |
| work__0pct | — | — | — | — | — | — | no-reference |
| work__full | — | — | — | 199.87/95.75 | 211.63/89.28 | 1032 | DIM-MISMATCH ref=1440x7625 can=1440x7721 |
