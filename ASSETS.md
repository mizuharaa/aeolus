# Aeolus asset register

Only the retained globe scene uses assets introduced by the reverted landing
overhaul.

## Earth event theatre

| Shipped asset | Source | Rights / license | Use |
| --- | --- | --- | --- |
| `apps/web/public/textures/earth-blue-marble.jpg` | [NASA Blue Marble Next Generation](https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg) | NASA imagery; generally not subject to US copyright. Credit NASA; no endorsement implied. | Earth albedo, resampled to 4096×2048. |
| `apps/web/public/textures/earth-night-lights.png` | [NASA Black Marble](https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144897/BlackMarble_2016_01deg_gray.jpg) | NASA imagery; generally not subject to US copyright. Credit NASA; no endorsement implied. | Night-side emissive map. |
| `apps/web/public/textures/earth-clouds.png` | [three.js Earth cloud texture](https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_clouds_1024.png) | MIT License. | Optional high-tier cloud layer. |
| `apps/web/public/textures/earth-water-mask.png` | Natural Earth coastlines | Public domain. | Ocean-only specular mask. |
| `apps/web/public/textures/earth-roughness.png` | Natural Earth coastlines | Public domain. | Matte-land/glossy-ocean roughness map. |
| `apps/web/public/textures/earth-borders.png` | `apps/web/public/data/ne-110m-admin-0-countries.json` | Natural Earth public-domain data. | Borders rasterized into the same equirectangular UV space as the albedo. |
| `apps/web/public/textures/earth-normal.jpg` | NASA topography derivative | NASA imagery; generally not subject to US copyright. | Restrained terrain normal map. |
| `apps/web/public/textures/earth-assets.json` | Repository-authored metadata | Project-authored. | Records source checksums and border-alignment checkpoints. |
| `apps/web/public/data/ne-110m-admin-0-countries.json` | [Natural Earth Admin 0 Countries](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/) | Public domain. | Source data for the co-projected border raster and masks. |

The `earth-*-mobile` variants are deterministic half-resolution derivatives
and carry the same rights as their source assets. Generation is documented in
`scripts/generate-earth-assets.mjs`.

NASA usage follows the [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

## Aircraft

| Shipped asset | Source | Rights / license | Use |
| --- | --- | --- | --- |
| `apps/web/public/models/aeolus-airliner.glb` | Project-generated image-to-3D model created with Meshy from the Aeolus aircraft concept | CC BY 4.0, conservatively applying Meshy free-plan terms. | Q-path aircraft prototype, with runtime material refinement. |
| `apps/web/public/images/aeolus-airliner-poster.webp` | Repository-authored render of the Aeolus airliner GLB | CC BY 4.0 as a derivative of the model. | Lightweight poster while the live model loads. |

Meshy terms were checked against its [ownership guidance](https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models).
