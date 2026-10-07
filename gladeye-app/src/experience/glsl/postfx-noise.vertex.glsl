// Extracted verbatim from evidence\source-assets\js\596-40a806be0d0d2bb3.js module 5593 (186 chars, offset 52212)
// Evidence: CONFIRMED-BUNDLE (original site GLSL source, minified bundle string literal)
// Role: vertex shader of the custom noise/"split" post-processing pass (paired with postfx-noise.fragment.glsl / module 4291)
precision highp float;
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}