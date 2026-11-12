import * as THREE from "three";
import type { Vec3 } from "../math/quantum";
import { blochToWorld } from "./coords";
import {
  LABEL_DISTANCE,
  axisSegments,
  phaseTickSegments,
  sphereWireSegments,
  tickSegments,
  toWorldPositions,
} from "./geometry";
import { COLORS, FONTS } from "./theme";

const LABEL_FONT_PX = 72;
const WORLD_PER_PX = 0.0014;

async function loadMonoFont(): Promise<void> {
  if (!("fonts" in document)) return;
  try {
    await Promise.race([
      document.fonts.load(`${LABEL_FONT_PX}px "Syne Mono"`),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // fall back to the system monospace font
  }
}

function lines(points: readonly Vec3[], color: string, opacity: number, order: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(toWorldPositions(points), 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
  });
  const object = new THREE.LineSegments(geometry, material);
  object.renderOrder = order;
  return object;
}

/** A soft chalk edge: transparent in the middle, faintly visible where the surface grazes the eye. */
function fresnelRim(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(COLORS.tealDeep) },
      uStrength: { value: 0.22 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
        float rim = pow(1.0 - facing, 3.0);
        gl_FragColor = vec4(uColor, rim * uStrength);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), material);
  mesh.renderOrder = 0;
  return mesh;
}

/** Flat, parchment-coloured dial lying in the equatorial plane. */
function phaseDisc(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96),
    new THREE.MeshBasicMaterial({
      color: COLORS.parchment,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2; // CircleGeometry faces +Z; lay it flat
  mesh.renderOrder = 1;
  return mesh;
}

/** A billboard label: flat text that always faces the camera. */
function label(text: string, size: number, color: string): THREE.Sprite {
  const px = LABEL_FONT_PX * size;
  const font = `${px}px ${FONTS.mono}`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 16;
  const height = Math.ceil(px * 1.5);
  canvas.width = width; // resizing resets the context, so set the style again
  canvas.height = height;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.scale.set(width * WORLD_PER_PX, height * WORLD_PER_PX, 1);
  sprite.renderOrder = 10;
  return sprite;
}

const BASIS_LABELS: { text: string; at: Vec3 }[] = [
  { text: "|0⟩", at: [0, 0, LABEL_DISTANCE] },
  { text: "|1⟩", at: [0, 0, -LABEL_DISTANCE] },
  { text: "|+⟩", at: [LABEL_DISTANCE, 0, 0] },
  { text: "|−⟩", at: [-LABEL_DISTANCE, 0, 0] },
  { text: "|+i⟩", at: [0, LABEL_DISTANCE, 0] },
  { text: "|−i⟩", at: [0, -LABEL_DISTANCE, 0] },
];

const AXIS_LABELS: { text: string; at: Vec3 }[] = [
  { text: "x", at: [1.58, 0, 0] },
  { text: "y", at: [0, 1.58, 0] },
  { text: "z", at: [0, 0, 1.58] },
];

/** The static part of the scene: shell, axes, ticks, phase dial and labels. */
export class SphereMesh {
  readonly group = new THREE.Group();

  static async create(): Promise<SphereMesh> {
    await loadMonoFont();
    return new SphereMesh();
  }

  private constructor() {
    this.group.add(
      fresnelRim(),
      phaseDisc(),
      lines(sphereWireSegments(), COLORS.tealDeep, 0.35, 2),
      lines(axisSegments(), COLORS.tealPale, 1, 3),
      lines(tickSegments(), COLORS.tealDeep, 0.8, 4),
      lines(phaseTickSegments(), COLORS.tealDeep, 0.6, 4),
    );
    for (const { text, at } of BASIS_LABELS) {
      const sprite = label(text, 1, COLORS.espresso);
      sprite.position.set(...blochToWorld(at));
      this.group.add(sprite);
    }
    for (const { text, at } of AXIS_LABELS) {
      const sprite = label(text, 0.7, COLORS.tealDeep);
      sprite.position.set(...blochToWorld(at));
      this.group.add(sprite);
    }
  }
}
