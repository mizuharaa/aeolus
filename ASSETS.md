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

NASA source usage follows the [NASA Images and Media Usage
Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). NASA is
credited as the imagery source; Aeolus does not imply NASA endorsement.
