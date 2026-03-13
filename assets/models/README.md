Drop external pet models here (for example `pet.glb`).

The runtime loader in `src/renderer/components/pet/BioPet.tsx` will try to load:

- `assets/models/pet.glb`

If unavailable, KINETIC falls back to the procedural Three.js pet.
