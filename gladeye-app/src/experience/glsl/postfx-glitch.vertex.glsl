// Extracted verbatim from evidence\source-assets\js\596-40a806be0d0d2bb3.js module 2289 (174 chars, offset 47731)
// Evidence: CONFIRMED-BUNDLE (original site GLSL source, minified bundle string literal)
// Role: vertex shader of the route-transition glitch pass (paired with postfx-glitch.fragment.glsl / module 255)
varying vec2 vUv;

void main() {
	vUv = vec2( uv.x, uv.y );
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}