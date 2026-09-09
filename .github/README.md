# Molecular Teaching Atlas

Interactive, evidence-linked educational visualizations of molecular biology and cellular immunotherapy.

## Website

- **[MYCN × FGFR1 Molecular Teaching Atlas](https://egaber.github.io/molecular-atlas/)** — 3D molecular mechanisms, gene expression, signaling, and public experimental structures.
- **[CAR-T vs CAR-NK Immunotherapy Visualization](https://egaber.github.io/molecular-atlas/immunotherapy-simulation.html)** — schematic immune-cell interactions.
- **[Drugs & Targets](https://egaber.github.io/molecular-atlas/drug-atlas.html)** — searchable drug mechanisms, direct molecular targets, neuroblastoma evidence boundaries, and a zoomable contributor-supplied alteration-frequency chart.
- **[Inside the Paper](https://egaber.github.io/molecular-atlas/cytotherapy-atlas.html)** — an interactive, source-mapped guide to the reported five-person quadruple-immunotherapy study.

These are educational illustrations, not patient-specific models, validated biological simulations, treatment recommendations, or efficacy comparisons. References, evidence limitations, and safety context are included in the pages.

## Run locally

Open any HTML page in a modern browser. The molecular and immunotherapy pages require WebGL and internet access for pinned visualization libraries served by jsDelivr and, in the molecular viewer, public PDB structures from RCSB. Inside the Paper uses an allowlisted local copy of Three.js and links to the publisher rather than redistributing article facsimiles. The drug page uses native HTML/SVG with no remote runtime dependencies; keep its explicitly allowlisted chart asset alongside it for offline viewing.

The supplied chart is preserved without redrawing or numerical transcription. Its gene, cohort, query and original citation have not been supplied, so the page labels that provenance gap explicitly. Do not relabel it as an FGFR1/MYCN chart or use it as a response-rate chart without the original source.

## Publishing

Pushes to `main` automatically deploy to GitHub Pages through GitHub Actions. A manual deployment is also available from the Actions tab. The deployment copies only the four allowlisted educational HTML pages and their explicit runtime assets into the site artifact, and uses the molecular atlas as the homepage. Review changed public content before committing or publishing.

The Git allowlist deliberately excludes all other workspace content. Do not force-add private files or replace the allowlist with a broad upload. No private medical documents or case notes belong in this repository or its deployment artifact.