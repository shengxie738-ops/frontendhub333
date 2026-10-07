// Extracted verbatim from evidence\source-assets\js\app\page-4c279de0997d388f.js module 5249 (3755 chars)
// Evidence: CONFIRMED-BUNDLE (original site GLSL source, minified bundle string literal)
precision highp float;


varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform float uFadeSpeed;
uniform float uScrollPos;
uniform float uScrollPos2;
uniform float uScrollPos3;
uniform float uMaxAlpha;
uniform float uFlip;
uniform float uPositionOffset;
uniform float uShowRay;

uniform sampler2D uRay1;
uniform sampler2D uRay2;
uniform sampler2D uRay3;
uniform vec2 uScreenResolution;
uniform vec2 uTextureResolution;

uniform float uCamNear;
uniform float uCamFar;

// Simplex 2D noise
//
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float simplex(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec2 scaleUV(float zoomedOutScale, float zoomPct, vec2 uv){

  float scaleFactor1 = zoomedOutScale - (zoomPct * zoomedOutScale);
  // Translate to the middle of the texture, taking downsclae into consideration
  vec2 translatePoint1 = vec2(0.5 , zoomedOutScale * 0.5);
  vec2 translatedUV1 = uv - translatePoint1;
  // Scale the translated coordinates
  vec2 scaledUV1 = translatedUV1 * scaleFactor1;
  // Translate back to the original position
  vec2 scaledAndTranslatedUV1 = scaledUV1 + translatePoint1;

  return scaledAndTranslatedUV1;
}

void main() {

  vec2 uv=vUv;
  float noiseSpeed=0.2;

  float alphaAnimation = simplex((vec2(uScrollPos*noiseSpeed)));
  // map back to 0-1
  alphaAnimation = (alphaAnimation+1.0)*0.5;

  float zoomPct = fract(uScrollPos);


  float amountOfTextures = 3.0;
  float alpha = mod(uTime * uFadeSpeed, amountOfTextures);
  float mixAlpha = fract(alpha);

  vec4 col = vec4(0.0);
  ///////// SCALE THE TEXTURE //////////////////////////////
  // Scale < 1 means scaling up, >1 scaling down
  float zoomedOutScale = 1.9;
  vec2 scaledUV = scaleUV(zoomedOutScale,zoomPct,uv);
  // flip
	float flip = (uFlip + 1.) * 0.5; // between 0 - 1
	scaledUV.x = flip * scaledUV.x + (1. - flip) * (1.0-scaledUV.x);

  scaledUV.x +=uPositionOffset;
  //  uSHowRay is a value of either 1 or something very large in order to render it outside the verts
  scaledUV.x *= uShowRay;
  ///////// END SCALE THE TEXTURE //////////////////////////////

  // you could use smoothstep here!!!!!!!
  if (alpha < 1.0) {

    vec4 color1 = texture2D(uRay1, scaledUV);
    vec4 color2 = texture2D(uRay2, scaledUV );

    col = mix(color1, color2, mixAlpha);

  } else if (alpha < 2.0) {

    vec4 color2 = texture2D(uRay2, scaledUV);
    vec4 color3 = texture2D(uRay3, scaledUV);

    col = mix(color2, color3, mixAlpha);

  } else {

    vec4 color1 = texture2D(uRay1, scaledUV);
    vec4 color3 = texture2D(uRay3, scaledUV);

    col = mix(color3, color1, mixAlpha);

  }

  // multily the alpha based on zoom/scroll, so we start at 0.0
  // map back to 0-1
  float progress =(cos(zoomPct * 6.28) + 1.0) * 0.5;
  col.a *= 1.0 - (min(progress * 1.5,1.0));
  col.a *=  uMaxAlpha;
  // let's show/hide new rays based on a noise boolean
  // col.a *= round(alphaAnimation);

  gl_FragColor = col;

	#include <colorspace_fragment>;
}
