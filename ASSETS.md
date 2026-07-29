# Aeolus asset register

Every non-original visual or data asset shipped by the landing experience is
recorded here. “Generated” assets are deterministic derivatives created by
repository scripts; their source and transformation are listed alongside them.

## Earth event theatre

| Shipped asset | Source | Rights / license | Transformation and use |
| --- | --- | --- | --- |
| `apps/web/public/textures/earth-blue-marble.jpg` | [NASA Earth Observatory — December Blue Marble Next Generation with Topography and Bathymetry](https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg) | NASA imagery; generally not subject to copyright in the United States. Credit NASA. No NASA endorsement is implied. | Resampled to 4096×2048 and JPEG-compressed by `scripts/generate-earth-assets.mjs`. |
| `apps/web/public/textures/earth-night-lights.png` | [NASA Earth Observatory — Black Marble 2016 grayscale map](https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144897/BlackMarble_2016_01deg_gray.jpg) | NASA imagery; generally not subject to copyright in the United States. Credit NASA. No NASA endorsement is implied. | Resampled to 4096×2048, converted to a compressed luminance map, and blended only across the night-side terminator. |
| `apps/web/public/textures/earth-clouds.png` | [`mrdoob/three.js` Earth cloud example texture](https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_clouds_1024.png) | MIT License (`mrdoob/three.js`). | Resampled to 2048×1024 and converted to a compressed opacity map. |
| `apps/web/public/textures/earth-water-mask.png` | Derived from Natural Earth coastlines | Natural Earth public-domain map data. | Deterministic equirectangular ocean mask used for tight water specular response. |
| `apps/web/public/textures/earth-roughness.png` | Derived from Natural Earth coastlines | Natural Earth public-domain map data. | Inverted and range-compressed water mask: matte land, restrained glossy ocean. |
| `apps/web/public/textures/earth-borders.png` | `apps/web/public/data/ne-110m-admin-0-countries.json` | Natural Earth public-domain map data. | Rasterized into the exact same 4096×2048 equirectangular UV space as the albedo so borders cannot drift from coastlines. |
| `apps/web/public/textures/earth-normal.jpg` | NASA Blue Marble Next Generation topography derivative (original source metadata dates the map to 2005) | NASA imagery; generally not subject to copyright in the United States. Credit NASA. | Existing 2048×1024 terrain normal map; used at restrained strength. |
| `apps/web/public/textures/earth-assets.json` | Repository-authored build metadata for the sources above | Project-authored metadata; repository license. | Records source checksums plus the Greenwich, equator/dateline, and Bering Strait projection checkpoints used to verify border/coastline alignment. |
| `apps/web/public/data/ne-110m-admin-0-countries.json` | [Natural Earth Admin 0 Countries](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/) | Natural Earth public-domain map data. | Source GeoJSON for the co-projected country-border raster and ocean mask. |

The `earth-*-mobile` variants carry the same rights as their registered source
rows. `scripts/generate-earth-assets.mjs --mobile-only` deterministically halves
the desktop dimensions; the low-capability tier does not request the cloud map.

NASA source usage follows the [NASA Images and Media Usage
Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). NASA is
credited as the imagery source; Aeolus does not imply NASA endorsement.

## Cabin material library

Higgsfield was authenticated for this pass, but the connected account rejected
CLI generation with `only_mcp_usage_on_trial_is_available` and this runtime did
not expose a callable Higgsfield MCP generation tool. The cabin therefore uses
the brief's CC0 fallback. No Higgsfield credits were consumed.

| Shipped asset family | Source | Rights / license | Transformation and use |
| --- | --- | --- | --- |
| `apps/web/public/textures/cabin/leather-*` | [ambientCG Leather 038](https://ambientcg.com/view?id=Leather038) | Creative Commons CC0 1.0; attribution not required. | 1K color, OpenGL normal, and roughness maps converted to WebP. Used on cognac seat backs, cushions, and ottomans. |
| `apps/web/public/textures/cabin/fabric-*` | [ambientCG Fabric 019](https://ambientcg.com/view?id=Fabric019) | Creative Commons CC0 1.0; attribution not required. | 1K color, OpenGL normal, and roughness maps converted to WebP. Used on high-sheen fabric headrests and throws. |
| `apps/web/public/textures/cabin/carpet-*` | [ambientCG Carpet 001](https://ambientcg.com/view?id=Carpet001) | Creative Commons CC0 1.0; attribution not required. | Downsampled to 512×512 and converted to WebP for the tiled floor and aisle runner. |
| `apps/web/public/textures/cabin/brushed-metal-*` | [ambientCG Metal 012](https://ambientcg.com/view?id=Metal012) | Creative Commons CC0 1.0; attribution not required. | 1K OpenGL normal and roughness maps converted to WebP. Used with gold-tinted physical metal on seat rails, inlays, and aisle trim. |
| `apps/web/public/textures/cabin/sidewall-*` | [ambientCG Plastic 006](https://ambientcg.com/view?id=Plastic006) | Creative Commons CC0 1.0; attribution not required. | 1K OpenGL normal and roughness maps converted to WebP; color is authored in-engine. Used as restrained pebble grain on sidewalls, window reveals, bins, and pod shells. |
| `apps/web/public/textures/cabin/walnut-*` | [ambientCG Wood 027](https://ambientcg.com/view?id=Wood027) | Creative Commons CC0 1.0; attribution not required. | 1K color, OpenGL normal, and roughness maps converted to WebP. Used beneath a clearcoat layer on console and dado surfaces. |

The complete shipped cabin texture library is approximately 1.74 MB. Original
1K JPG packages are intentionally not shipped. Each `*-mobile.webp` file is a
deterministic half-resolution derivative carrying the same CC0 rights, generated
by `scripts/generate-cabin-mobile-assets.mjs`.

## Aircraft and device

| Shipped asset | Source | Rights / license | Transformation and use |
| --- | --- | --- | --- |
| `apps/web/public/models/aeolus-airliner.glb` | Project-generated image-to-3D model created with Meshy from the Aeolus aircraft concept | Creative Commons Attribution 4.0 (CC BY 4.0), the conservative license applied to Meshy free-plan output. Attribution appears in the site footer. | Reoriented, normalized, and upgraded at runtime from standard materials to clear-coated physical aircraft materials. |
| `apps/web/public/images/aeolus-airliner-poster.webp` | Repository-authored render of `aeolus-airliner.glb` | CC BY 4.0 as a derivative of the Meshy aircraft model. | Lightweight first-paint and reduced-motion poster; replaced by the live GLB after load. |
| Procedural cabin geometry and MacBook-style OCC device | Authored in the Aeolus source with Three.js primitives and canvas textures | Project-authored; repository license. No third-party 3D model is embedded. | Instanced cabin geometry, physical hinge, keyboard normal-style canvas texture, aluminum materials, and live DOM dashboard surface. |

Meshy output licensing was checked against the [Meshy ownership
guidance](https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models).
Because the generating account tier is not preserved in repository history, the
more restrictive free-plan CC BY 4.0 terms are applied.
