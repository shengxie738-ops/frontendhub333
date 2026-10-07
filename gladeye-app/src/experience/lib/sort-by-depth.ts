/**
 * `N = (points, camera) => {...}` — the one-off depth sort from
 * `page-4c279de0997d388f.js:6870-7500`.
 *
 * Because the flower `Points` material runs with `depthTest:false`, the blend
 * order *is* the depth order: the original builds a `Uint32` index over every
 * vertex, projects each position by `projectionMatrix * matrixWorldInverse *
 * matrixWorld` and sorts it so the farthest sprite is rasterised first.
 */
import { BufferAttribute, Matrix4, Points, Vector3 } from 'three';

export interface CameraMatrices {
  projectionMatrix: Matrix4;
  matrixWorldInverse: Matrix4;
}

export function sortByCameraDepth(points: Points, camera: CameraMatrices): void {
  const geometry = points.geometry;
  const positionAttr = geometry.getAttribute('position');
  const count = positionAttr.count;

  points.updateWorldMatrix(true, false);

  const viewProjectionWorld = new Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  viewProjectionWorld.multiply(points.matrixWorld);

  if (geometry.getIndex() === null) {
    const identity = new Uint32Array(count);
    for (let i = 0; i < count; i++) identity[i] = i;
    geometry.setIndex(new BufferAttribute(identity, 1));
  }

  const index = geometry.getIndex();
  if (!index) return;

  const scratch = new Vector3();
  const array = positionAttr.array as ArrayLike<number>;
  const keys = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    scratch.fromArray(array as number[], i * 3);
    scratch.applyMatrix4(viewProjectionWorld);
    keys[i] = scratch.z;
  }

  const order: number[] = new Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  order.sort((a, b) => keys[b] - keys[a]);

  const target = index.array as Uint32Array | Uint16Array;
  for (let i = 0; i < count; i++) target[i] = order[i];
  index.needsUpdate = true;
}
