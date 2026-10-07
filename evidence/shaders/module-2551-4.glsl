// Extracted verbatim from evidence\source-assets\js\app\page-4c279de0997d388f.js module 2551 (334 chars)
// Evidence: CONFIRMED-BUNDLE (original site GLSL source, minified bundle string literal)
precision highp float;

uniform float uTime;


varying vec2 vUv;
varying vec3 vPosition;



void main() {
    vec3 pos = position.xyz;
    vec4 modelViewPosition = modelViewMatrix * vec4(pos, 1.0);
    vec4 finalPos = projectionMatrix * modelViewPosition;

    vUv = uv;
    vPosition=position.xyz;

    gl_Position = finalPos;
    
}