# Molecular Teaching Atlas

Interactive, evidence-linked educational visualizations of molecular biology and cellular immunotherapy.

## Website

- **[MYCN × FGFR1 Molecular Teaching Atlas](https://egaber.github.io/molecular-atlas/)** — 3D molecular mechanisms, gene expression, signaling, and public experimental structures.
- **[CAR-T vs CAR-NK Immunotherapy Visualization](https://egaber.github.io/molecular-atlas/immunotherapy-simulation.html)** — schematic immune-cell interactions.

These are educational illustrations, not patient-specific models, validated biological simulations, treatment recommendations, or efficacy comparisons. References, evidence limitations, and safety context are included in the pages.

## Run locally

Open either HTML page in a modern browser with WebGL support. Internet access is required for the pinned visualization libraries served by jsDelivr and, in the molecular viewer, public PDB structures from RCSB.

## Publishing

Pushes to `main` automatically deploy to GitHub Pages through GitHub Actions. A manual deployment is also available from the Actions tab. The deployment copies only the two reviewed HTML pages into the site artifact and uses the molecular atlas as the homepage.

The Git allowlist deliberately excludes all other workspace content. Do not force-add private files or replace the allowlist with a broad upload. No private medical documents or case notes belong in this repository or its deployment artifact.