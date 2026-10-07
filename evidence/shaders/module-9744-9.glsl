// Extracted verbatim from evidence\source-assets\js\app\page-4c279de0997d388f.js module 9744 (267 chars)
// Evidence: CONFIRMED-BUNDLE (original site GLSL source, minified bundle string literal)
precision highp float;

uniform float uTime;


varying vec2 vUv;

void main() {
    vUv = uv;
   
    vec4 pos = vec4(position.xyz,0.0);
    pos.w=1.0;
   
    // gl_Position =  pos;
    gl_Position = pos;//projectionMatrix * modelViewMatrix * vec4(position, 1.0);

}